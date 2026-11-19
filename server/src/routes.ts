import { Router } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';

import {
  User,
  Pet,
  Health,
  CareTask,
  Listing,
  AdoptionRequest,
  Post,
  Report,
  Product,
  Cart,
  Favorite,
  Order,
  AIConversation,
} from './models';

import {
  auth,
  adminOnly,
  crud,
  h,
  httpError,
  ok,
  token,
} from './lib';

const r = Router();

const sha = (s: string) =>
  crypto.createHash('sha256').update(s).digest('hex');

const pub = (u: {
  _id: unknown;
  name: string;
  email: string;
  role: string;
}) => ({
  id: String(u._id),
  name: u.name,
  email: u.email,
  role: u.role,
});

// =====================================================
// AUTH
// =====================================================

const a = Router();

const creds = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
});

a.post('/register', h(async (q, s) => {
  const b = creds.parse(q.body);

  if (await User.exists({ email: b.email.toLowerCase() })) {
    throw httpError(409, 'Email already registered');
  }

  const u = await User.create({
    name: b.name,
    email: b.email,
    password: await bcrypt.hash(b.password, 12),
  });

  ok(s.status(201), {
    token: token(u.id),
    user: pub(u),
  });
}));

a.post('/login', h(async (q, s) => {
  const b = z.object({
    email: z.string().email(),
    password: z.string().min(1),
  }).parse(q.body);

  const u = await User.findOne({
    email: b.email.toLowerCase(),
  }).select('+password');

  if (!u || !(await bcrypt.compare(b.password, u.password))) {
    throw httpError(401, 'Invalid email or password');
  }

  if (!u.active) {
    throw httpError(403, 'Account disabled');
  }

  ok(s, {
    token: token(u.id),
    user: pub(u),
  });
}));

a.post('/forgot', h(async (q, s) => {
  const { email } = z.object({
    email: z.string().email(),
  }).parse(q.body);

  const u = await User.findOne({
    email: email.toLowerCase(),
  });

  if (u) {
    const t = crypto.randomBytes(32).toString('hex');

    u.resetHash = sha(t);
    u.resetExp = new Date(Date.now() + 3600_000);

    await u.save();

    if (process.env.NODE_ENV !== 'production') {
      console.log(
        `[dev] reset link: ${process.env.CLIENT_URL || 'http://localhost:5173'}/reset/${t}`
      );
    }
  }

  ok(s, {
    message: 'If this email exists, a reset link has been generated.',
  });
}));

a.post('/reset', h(async (q, s) => {
  const b = z.object({
    token: z.string(),
    password: z.string().min(8),
  }).parse(q.body);

  const u = await User.findOne({
    resetHash: sha(b.token),
    resetExp: { $gt: new Date() },
  });

  if (!u) {
    throw httpError(400, 'Reset link is invalid or expired');
  }

  u.password = await bcrypt.hash(b.password, 12);
  u.resetHash = undefined;
  u.resetExp = undefined;

  await u.save();

  ok(s, { message: 'Password updated' });
}));

a.get('/me', auth, h(async (q, s) => {
  ok(s, pub(q.user));
}));

a.put('/me', auth, h(async (q, s) => {
  const b = z.object({
    name: z.string().min(2),
  }).parse(q.body);

  q.user.name = b.name;
  await q.user.save();

  ok(s, pub(q.user));
}));

r.use('/auth', a);

// =====================================================
// DASHBOARD STATS
// =====================================================

r.get('/stats', auth, h(async (q, s) => {
  const o = q.user.id;
  const now = new Date();

  const end = new Date();
  end.setHours(23, 59, 59, 999);

  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const [pets, appts, pending, today, vaccines] =
    await Promise.all([
      Pet.find({ owner: o }).sort('-createdAt'),

      Health.find({
        owner: o,
        kind: 'appointment',
        status: 'scheduled',
        date: { $gte: now },
      })
        .sort('date')
        .limit(5)
        .populate('pet', 'name'),

      CareTask.countDocuments({
        owner: o,
        done: false,
      }),

      CareTask.find({
        owner: o,
        dueAt: { $gte: start, $lte: end },
      })
        .sort('dueAt')
        .populate('pet', 'name'),

      Health.find({
        owner: o,
        kind: 'vaccination',
        nextDate: { $gte: now },
      })
        .sort('nextDate')
        .limit(5)
        .populate('pet', 'name'),
    ]);

  ok(s, {
    pets,
    appointments: appts,
    pendingTasks: pending,
    today,
    vaccinations: vaccines,
  });
}));

// =====================================================
// PETS / HEALTH / CARE
// =====================================================

r.use('/pets', crud(Pet, {
  filters: ['species'],
}));

r.use('/health', crud(Health, {
  filters: ['pet', 'kind', 'status'],
  date: 'date',
}));

const care = Router();

care.post('/:id/complete', auth, h(async (q, s) => {
  const t = await CareTask.findOne({
    _id: q.params.id,
    owner: q.user.id,
  });

  if (!t) {
    throw httpError(404, 'Not found');
  }

  t.done = true;
  await t.save();

  const days = ({
    daily: 1,
    weekly: 7,
    monthly: 30,
  } as Record<string, number>)[t.repeat || 'none'];

  if (days) {
    await CareTask.create({
      owner: t.owner,
      pet: t.pet,
      title: t.title,
      category: t.category,
      description: t.description,
      repeat: t.repeat,
      dueAt: new Date(+t.dueAt + days * 864e5),
    });
  }

  ok(s, t);
}));

r.use('/care', care, crud(CareTask, {
  filters: ['pet', 'category', 'done'],
  date: 'dueAt',
}));

// =====================================================
// ADOPTION
// =====================================================

const adReq = Router();

adReq.use(auth);

adReq.get('/mine', h(async (q, s) => {
  ok(
    s,
    await AdoptionRequest.find({
      requester: q.user.id,
    })
      .sort('-createdAt')
      .populate('listing', 'name species photo')
  );
}));

adReq.get('/incoming', h(async (q, s) => {
  const ids = (
    await Listing.find({
      owner: q.user.id,
    }).select('_id')
  ).map(l => l._id);

  ok(
    s,
    await AdoptionRequest.find({
      listing: { $in: ids },
    })
      .sort('-createdAt')
      .populate('listing', 'name')
      .populate('requester', 'name email')
  );
}));

adReq.post('/:listingId', h(async (q, s) => {
  const l = await Listing.findOne({
    _id: q.params.listingId,
    status: 'approved',
  });

  if (!l) {
    throw httpError(404, 'Listing not available');
  }

  if (String(l.owner) === q.user.id) {
    throw httpError(400, 'You cannot adopt your own listing');
  }

  if (await AdoptionRequest.exists({
    listing: l._id,
    requester: q.user.id,
    status: 'pending',
  })) {
    throw httpError(409, 'You already have a pending request');
  }

  ok(s.status(201), await AdoptionRequest.create({
    listing: l._id,
    requester: q.user.id,
    message: String(q.body.message || '').slice(0, 1000),
  }));
}));

adReq.put('/:id/cancel', h(async (q, s) => {
  const d = await AdoptionRequest.findOneAndUpdate(
    {
      _id: q.params.id,
      requester: q.user.id,
      status: 'pending',
    },
    {
      status: 'cancelled',
    },
    {
      new: true,
    }
  );

  if (!d) {
    throw httpError(404, 'No pending request found');
  }

  ok(s, d);
}));

adReq.put('/:id/status', h(async (q, s) => {
  const st = z.enum(['approved', 'rejected']).parse(q.body.status);

  const d = await AdoptionRequest.findOne({
    _id: q.params.id,
    status: 'pending',
  });

  const l = d && await Listing.findOne({
    _id: d.listing,
    owner: q.user.id,
  });

  if (!d || !l) {
    throw httpError(404, 'Request not found');
  }

  d.status = st;
  await d.save();

  if (st === 'approved') {
    l.status = 'adopted';
    await l.save();
  }

  ok(s, d);
}));

r.use('/adoption/requests', adReq);

r.use('/adoption', crud(Listing, {
  pub: () => ({ status: 'approved' }),
  lock: ['status'],
  filters: ['species', 'location', 'gender'],
  pop: 'owner',
}));

// =====================================================
// COMMUNITY
// =====================================================

const com = Router();

com.use(auth);

const getPost = async (id: string) => {
  const p = await Post.findOne({
    _id: id,
    hidden: false,
  });

  if (!p) {
    throw httpError(404, 'Post not found');
  }

  return p;
};

com.post('/:id/like', h(async (q, s) => {
  const p = await getPost(q.params.id);

  const i = p.likes.findIndex(
    u => String(u) === q.user.id
  );

  if (i >= 0) {
    p.likes.splice(i, 1);
  } else {
    p.likes.push(q.user._id);
  }

  await p.save();

  ok(s, {
    liked: i < 0,
    likes: p.likes.length,
  });
}));

com.post('/:id/comments', h(async (q, s) => {
  const text = z.string().min(1).max(500).parse(q.body.text);

  const p = await getPost(q.params.id);

  p.comments.push({
    owner: q.user._id,
    text,
  } as never);

  await p.save();

  ok(s.status(201), p.comments);
}));

com.delete('/:id/comments/:cid', h(async (q, s) => {
  const p = await getPost(q.params.id);

  const c = p.comments.find(
    x => String(x._id) === q.params.cid
  );

  if (!c) {
    throw httpError(404, 'Comment not found');
  }

  if (
    String(c.owner) !== q.user.id &&
    q.user.role !== 'admin'
  ) {
    throw httpError(403, 'Not allowed');
  }

  p.comments = p.comments.filter(
    x => x !== c
  ) as typeof p.comments;

  await p.save();

  ok(s, { deleted: true });
}));

com.post('/:id/report', h(async (q, s) => {
  const reason = z.string().min(3).max(300).parse(q.body.reason);

  await getPost(q.params.id);

  ok(s.status(201), await Report.create({
    post: q.params.id,
    reporter: q.user.id,
    reason,
  }));
}));

r.use('/community', com, crud(Post, {
  pub: () => ({ hidden: false }),
  lock: ['likes', 'comments', 'hidden'],
  pop: 'owner',
}));

// =====================================================
// STORE / PRODUCTS
// =====================================================

r.use('/products', crud(Product, {
  pub: () => ({ active: true }),
  adminWrite: true,
  filters: ['category'],
}));

// =====================================================
// CART
// =====================================================

const cart = Router();

cart.use(auth);

const cartOut = async (u: string) =>
  (await Cart.findOne({ user: u }).populate('items.product')) || {
    items: [],
  };

cart.get('/', h(async (q, s) => {
  ok(s, await cartOut(q.user.id));
}));

cart.put('/items', h(async (q, s) => {
  const b = z.object({
    product: z.string(),
    qty: z.number().int().min(0),
  }).parse(q.body);

  const p = await Product.findOne({
    _id: b.product,
    active: true,
  });

  if (!p) {
    throw httpError(404, 'Product not found');
  }

  if (b.qty > p.stock) {
    throw httpError(400, `Only ${p.stock} in stock`);
  }

  const c = (await Cart.findOne({
    user: q.user.id,
  })) || new Cart({
    user: q.user.id,
    items: [],
  });

  const it = c.items.find(
    i => String(i.product) === b.product
  );

  if (it) {
    if (b.qty === 0) {
      c.items = c.items.filter(
        i => i !== it
      ) as typeof c.items;
    } else {
      it.qty = b.qty;
    }
  } else if (b.qty > 0) {
    c.items.push({
      product: p._id,
      qty: b.qty,
    });
  }

  await c.save();

  ok(s, await cartOut(q.user.id));
}));

r.use('/cart', cart);

// =====================================================
// ORDERS
// =====================================================

const ord = Router();

ord.use(auth);

ord.get('/', h(async (q, s) => {
  ok(
    s,
    await Order.find({
      user: q.user.id,
    }).sort('-createdAt')
  );
}));

ord.post('/checkout', h(async (q, s) => {
  const c = await Cart.findOne({
    user: q.user.id,
  }).populate<{
    items: {
      product: InstanceType<typeof Product>;
      qty: number;
    }[];
  }>('items.product');

  if (!c || !c.items.length) {
    throw httpError(400, 'Your cart is empty');
  }

  const done: {
    id: unknown;
    qty: number;
  }[] = [];

  const lines: {
    product: unknown;
    name: string;
    price: number;
    qty: number;
  }[] = [];

  try {
    for (const i of c.items) {
      const upd = await Product.updateOne(
        {
          _id: i.product._id,
          active: true,
          stock: { $gte: i.qty },
        },
        {
          $inc: { stock: -i.qty },
        }
      );

      if (!upd.modifiedCount) {
        throw httpError(
          409,
          `Not enough stock for ${i.product.name}`
        );
      }

      done.push({
        id: i.product._id,
        qty: i.qty,
      });

      lines.push({
        product: i.product._id,
        name: i.product.name,
        price: i.product.price,
        qty: i.qty,
      });
    }
  } catch (e) {
    for (const d of done) {
      await Product.updateOne(
        { _id: d.id },
        { $inc: { stock: d.qty } }
      );
    }

    throw e;
  }

  const o = await Order.create({
    user: q.user.id,
    items: lines,
    total: lines.reduce(
      (t, l) => t + l.price * l.qty,
      0
    ),
    demo: true,
  });

  c.items = [] as unknown as typeof c.items;

  await c.save();

  ok(s.status(201), o);
}));

r.use('/orders', ord);

// =====================================================
// FAVORITES
// =====================================================

const fav = Router();

fav.use(auth);

fav.get('/', h(async (q, s) => {
  ok(
    s,
    await Favorite.find({
      user: q.user.id,
    }).populate('product')
  );
}));

fav.post('/:productId', h(async (q, s) => {
  const f = await Favorite.findOneAndDelete({
    user: q.user.id,
    product: q.params.productId,
  });

  if (!f) {
    await Favorite.create({
      user: q.user.id,
      product: q.params.productId,
    });
  }

  ok(s, { favorite: !f });
}));

r.use('/favorites', fav);

// =====================================================
// AI ASSISTANT - GROQ
// =====================================================

const SYSTEM = `You are PetCare Assistant, a friendly pet-care guide inside the PETCARE app.

Give general information only.

You are not a veterinarian:
- Never diagnose.
- Never prescribe medication or dosages.
- Never advise ignoring symptoms.
- Never recommend therapeutic or medical diets.

For concerning symptoms, advise contacting a veterinarian.
For emergencies, advise urgent veterinary care.
If asked to explain terms from a veterinary record, explain them simply and say a vet should interpret results.
Suggested care routines are suggestions only.
Visual breed identification is always uncertain.

Be friendly, clear, practical, and concise.`;

const ai = Router();

ai.use(
  auth,
  rateLimit({
    windowMs: 60_000,
    limit: 15,
    message: {
      success: false,
      message: 'Too many AI requests, slow down.',
    },
  })
);

ai.get('/conversations/:id', h(async (q, s) => {
  const conversation = await AIConversation.findOne({
    _id: q.params.id,
    user: q.user.id,
  });

  ok(s, conversation);
}));

ai.post('/chat', h(async (q, s) => {
  const b = z.object({
    message: z.string().trim().min(1).max(2000),
    conversationId: z.string().optional(),
    petId: z.string().optional(),
  }).parse(q.body);

  const apiKey = process.env.GROQ_API_KEY?.trim();

  if (!apiKey) {
    throw httpError(
      503,
      'The AI assistant is not configured. Set GROQ_API_KEY in server/.env.'
    );
  }

  const conv = (
    b.conversationId &&
    await AIConversation.findOne({
      _id: b.conversationId,
      user: q.user.id,
    })
  ) || new AIConversation({
    user: q.user.id,
    messages: [],
  });

  let ctx = '';

  if (b.petId) {
    const p = await Pet.findOne({
      _id: b.petId,
      owner: q.user.id,
    });

    if (p) {
      ctx = `
Pet shared by the user:
Name: ${p.name}
Species: ${p.species}
Breed: ${p.breed || 'unknown'}
Weight: ${p.weight || 'unknown'} kg
Birth date: ${p.birthDate?.toISOString().slice(0, 10) || 'unknown'}.
`;
    }
  }

  conv.messages.push({
    role: 'user',
    content: b.message,
  });

  const model =
    process.env.GROQ_MODEL?.trim() ||
    'openai/gpt-oss-120b';

  const resp = await fetch(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: SYSTEM + ctx,
          },
          ...conv.messages.slice(-20).map(m => ({
            role: m.role,
            content: m.content,
          })),
        ],
      }),
    }
  ).catch((error) => {
    console.error('Groq connection error:', error);
    return null;
  });

  if (!resp) {
    throw httpError(
      502,
      'Could not connect to Groq. Check your internet connection and try again.'
    );
  }

  if (!resp.ok) {
    const errorDetails = await resp.text();

    console.error(
      'Groq API Error:',
      resp.status,
      errorDetails
    );

    throw httpError(
      502,
      `Groq API request failed (${resp.status}). Check the backend terminal for details.`
    );
  }

  const data = await resp.json() as {
    choices?: {
      message?: {
        content?: string;
      };
    }[];
  };

  const reply = data.choices?.[0]?.message?.content;

  if (!reply || !reply.trim()) {
    console.error('Groq returned an empty response:', data);

    throw httpError(
      502,
      'Groq returned an empty answer. Please try again.'
    );
  }

  conv.messages.push({
    role: 'assistant',
    content: reply,
  });

  await conv.save();

  ok(s, {
    conversationId: conv.id,
    reply,
  });
}));

r.use('/ai', ai);

// =====================================================
// ADMIN
// =====================================================

const ad = Router();

ad.use(auth, adminOnly);

ad.get('/stats', h(async (_q, s) => {
  const [
    users,
    pets,
    listings,
    products,
    orders,
    posts,
    reports,
  ] = await Promise.all([
    User.countDocuments(),
    Pet.countDocuments(),
    Listing.countDocuments(),
    Product.countDocuments(),
    Order.countDocuments(),
    Post.countDocuments(),
    Report.countDocuments({ resolved: false }),
  ]);

  ok(s, {
    users,
    pets,
    listings,
    products,
    orders,
    posts,
    openReports: reports,
  });
}));

ad.get('/users', h(async (q, s) => {
  const re = q.query.q
    ? new RegExp(
        String(q.query.q).replace(/[^\w@. -]/g, ''),
        'i'
      )
    : /./;

  ok(
    s,
    await User.find({
      $or: [
        { name: re },
        { email: re },
      ],
    })
      .sort('-createdAt')
      .limit(100)
  );
}));

ad.put('/users/:id', h(async (q, s) => {
  if (q.params.id === q.user.id) {
    throw httpError(400, 'You cannot change your own account here');
  }

  const b = z.object({
    active: z.boolean().optional(),
    role: z.enum(['user', 'admin']).optional(),
  }).parse(q.body);

  ok(
    s,
    await User.findByIdAndUpdate(
      q.params.id,
      b,
      { new: true }
    )
  );
}));

ad.get('/listings', h(async (q, s) => {
  ok(
    s,
    await Listing.find(
      q.query.status
        ? { status: String(q.query.status) }
        : {}
    )
      .sort('-createdAt')
      .populate('owner', 'name')
  );
}));

ad.put('/listings/:id/status', h(async (q, s) => {
  ok(
    s,
    await Listing.findByIdAndUpdate(
      q.params.id,
      {
        status: z.enum([
          'pending',
          'approved',
          'rejected',
        ]).parse(q.body.status),
      },
      { new: true }
    )
  );
}));

ad.get('/orders', h(async (_q, s) => {
  ok(
    s,
    await Order.find()
      .sort('-createdAt')
      .limit(100)
      .populate('user', 'name email')
  );
}));

ad.put('/orders/:id', h(async (q, s) => {
  ok(
    s,
    await Order.findByIdAndUpdate(
      q.params.id,
      {
        status: z.enum([
          'placed',
          'processing',
          'shipped',
          'delivered',
          'cancelled',
        ]).parse(q.body.status),
      },
      { new: true }
    )
  );
}));

ad.get('/reports', h(async (_q, s) => {
  ok(
    s,
    await Report.find({ resolved: false })
      .sort('-createdAt')
      .populate('post', 'caption hidden')
      .populate('reporter', 'name')
  );
}));

ad.put('/reports/:id/resolve', h(async (q, s) => {
  const rp = await Report.findById(q.params.id);

  if (!rp) {
    throw httpError(404, 'Not found');
  }

  if (q.body.hidePost) {
    await Post.updateOne(
      { _id: rp.post },
      { hidden: true }
    );
  }

  rp.resolved = true;
  await rp.save();

  ok(s, rp);
}));

r.use('/admin', ad);

export default r;