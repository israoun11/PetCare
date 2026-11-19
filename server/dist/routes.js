"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const crypto_1 = __importDefault(require("crypto"));
const zod_1 = require("zod");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const models_1 = require("./models");
const lib_1 = require("./lib");
const r = (0, express_1.Router)();
const sha = (s) => crypto_1.default.createHash('sha256').update(s).digest('hex');
const pub = (u) => ({
    id: String(u._id),
    name: u.name,
    email: u.email,
    role: u.role,
});
// =====================================================
// AUTH
// =====================================================
const a = (0, express_1.Router)();
const creds = zod_1.z.object({
    name: zod_1.z.string().min(2),
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(8),
});
a.post('/register', (0, lib_1.h)(async (q, s) => {
    const b = creds.parse(q.body);
    if (await models_1.User.exists({ email: b.email.toLowerCase() })) {
        throw (0, lib_1.httpError)(409, 'Email already registered');
    }
    const u = await models_1.User.create({
        name: b.name,
        email: b.email,
        password: await bcryptjs_1.default.hash(b.password, 12),
    });
    (0, lib_1.ok)(s.status(201), {
        token: (0, lib_1.token)(u.id),
        user: pub(u),
    });
}));
a.post('/login', (0, lib_1.h)(async (q, s) => {
    const b = zod_1.z.object({
        email: zod_1.z.string().email(),
        password: zod_1.z.string().min(1),
    }).parse(q.body);
    const u = await models_1.User.findOne({
        email: b.email.toLowerCase(),
    }).select('+password');
    if (!u || !(await bcryptjs_1.default.compare(b.password, u.password))) {
        throw (0, lib_1.httpError)(401, 'Invalid email or password');
    }
    if (!u.active) {
        throw (0, lib_1.httpError)(403, 'Account disabled');
    }
    (0, lib_1.ok)(s, {
        token: (0, lib_1.token)(u.id),
        user: pub(u),
    });
}));
a.post('/forgot', (0, lib_1.h)(async (q, s) => {
    const { email } = zod_1.z.object({
        email: zod_1.z.string().email(),
    }).parse(q.body);
    const u = await models_1.User.findOne({
        email: email.toLowerCase(),
    });
    if (u) {
        const t = crypto_1.default.randomBytes(32).toString('hex');
        u.resetHash = sha(t);
        u.resetExp = new Date(Date.now() + 3600_000);
        await u.save();
        if (process.env.NODE_ENV !== 'production') {
            console.log(`[dev] reset link: ${process.env.CLIENT_URL || 'http://localhost:5173'}/reset/${t}`);
        }
    }
    (0, lib_1.ok)(s, {
        message: 'If this email exists, a reset link has been generated.',
    });
}));
a.post('/reset', (0, lib_1.h)(async (q, s) => {
    const b = zod_1.z.object({
        token: zod_1.z.string(),
        password: zod_1.z.string().min(8),
    }).parse(q.body);
    const u = await models_1.User.findOne({
        resetHash: sha(b.token),
        resetExp: { $gt: new Date() },
    });
    if (!u) {
        throw (0, lib_1.httpError)(400, 'Reset link is invalid or expired');
    }
    u.password = await bcryptjs_1.default.hash(b.password, 12);
    u.resetHash = undefined;
    u.resetExp = undefined;
    await u.save();
    (0, lib_1.ok)(s, { message: 'Password updated' });
}));
a.get('/me', lib_1.auth, (0, lib_1.h)(async (q, s) => {
    (0, lib_1.ok)(s, pub(q.user));
}));
a.put('/me', lib_1.auth, (0, lib_1.h)(async (q, s) => {
    const b = zod_1.z.object({
        name: zod_1.z.string().min(2),
    }).parse(q.body);
    q.user.name = b.name;
    await q.user.save();
    (0, lib_1.ok)(s, pub(q.user));
}));
r.use('/auth', a);
// =====================================================
// DASHBOARD STATS
// =====================================================
r.get('/stats', lib_1.auth, (0, lib_1.h)(async (q, s) => {
    const o = q.user.id;
    const now = new Date();
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const [pets, appts, pending, today, vaccines] = await Promise.all([
        models_1.Pet.find({ owner: o }).sort('-createdAt'),
        models_1.Health.find({
            owner: o,
            kind: 'appointment',
            status: 'scheduled',
            date: { $gte: now },
        })
            .sort('date')
            .limit(5)
            .populate('pet', 'name'),
        models_1.CareTask.countDocuments({
            owner: o,
            done: false,
        }),
        models_1.CareTask.find({
            owner: o,
            dueAt: { $gte: start, $lte: end },
        })
            .sort('dueAt')
            .populate('pet', 'name'),
        models_1.Health.find({
            owner: o,
            kind: 'vaccination',
            nextDate: { $gte: now },
        })
            .sort('nextDate')
            .limit(5)
            .populate('pet', 'name'),
    ]);
    (0, lib_1.ok)(s, {
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
r.use('/pets', (0, lib_1.crud)(models_1.Pet, {
    filters: ['species'],
}));
r.use('/health', (0, lib_1.crud)(models_1.Health, {
    filters: ['pet', 'kind', 'status'],
    date: 'date',
}));
const care = (0, express_1.Router)();
care.post('/:id/complete', lib_1.auth, (0, lib_1.h)(async (q, s) => {
    const t = await models_1.CareTask.findOne({
        _id: q.params.id,
        owner: q.user.id,
    });
    if (!t) {
        throw (0, lib_1.httpError)(404, 'Not found');
    }
    t.done = true;
    await t.save();
    const days = {
        daily: 1,
        weekly: 7,
        monthly: 30,
    }[t.repeat || 'none'];
    if (days) {
        await models_1.CareTask.create({
            owner: t.owner,
            pet: t.pet,
            title: t.title,
            category: t.category,
            description: t.description,
            repeat: t.repeat,
            dueAt: new Date(+t.dueAt + days * 864e5),
        });
    }
    (0, lib_1.ok)(s, t);
}));
r.use('/care', care, (0, lib_1.crud)(models_1.CareTask, {
    filters: ['pet', 'category', 'done'],
    date: 'dueAt',
}));
// =====================================================
// ADOPTION
// =====================================================
const adReq = (0, express_1.Router)();
adReq.use(lib_1.auth);
adReq.get('/mine', (0, lib_1.h)(async (q, s) => {
    (0, lib_1.ok)(s, await models_1.AdoptionRequest.find({
        requester: q.user.id,
    })
        .sort('-createdAt')
        .populate('listing', 'name species photo'));
}));
adReq.get('/incoming', (0, lib_1.h)(async (q, s) => {
    const ids = (await models_1.Listing.find({
        owner: q.user.id,
    }).select('_id')).map(l => l._id);
    (0, lib_1.ok)(s, await models_1.AdoptionRequest.find({
        listing: { $in: ids },
    })
        .sort('-createdAt')
        .populate('listing', 'name')
        .populate('requester', 'name email'));
}));
adReq.post('/:listingId', (0, lib_1.h)(async (q, s) => {
    const l = await models_1.Listing.findOne({
        _id: q.params.listingId,
        status: 'approved',
    });
    if (!l) {
        throw (0, lib_1.httpError)(404, 'Listing not available');
    }
    if (String(l.owner) === q.user.id) {
        throw (0, lib_1.httpError)(400, 'You cannot adopt your own listing');
    }
    if (await models_1.AdoptionRequest.exists({
        listing: l._id,
        requester: q.user.id,
        status: 'pending',
    })) {
        throw (0, lib_1.httpError)(409, 'You already have a pending request');
    }
    (0, lib_1.ok)(s.status(201), await models_1.AdoptionRequest.create({
        listing: l._id,
        requester: q.user.id,
        message: String(q.body.message || '').slice(0, 1000),
    }));
}));
adReq.put('/:id/cancel', (0, lib_1.h)(async (q, s) => {
    const d = await models_1.AdoptionRequest.findOneAndUpdate({
        _id: q.params.id,
        requester: q.user.id,
        status: 'pending',
    }, {
        status: 'cancelled',
    }, {
        new: true,
    });
    if (!d) {
        throw (0, lib_1.httpError)(404, 'No pending request found');
    }
    (0, lib_1.ok)(s, d);
}));
adReq.put('/:id/status', (0, lib_1.h)(async (q, s) => {
    const st = zod_1.z.enum(['approved', 'rejected']).parse(q.body.status);
    const d = await models_1.AdoptionRequest.findOne({
        _id: q.params.id,
        status: 'pending',
    });
    const l = d && await models_1.Listing.findOne({
        _id: d.listing,
        owner: q.user.id,
    });
    if (!d || !l) {
        throw (0, lib_1.httpError)(404, 'Request not found');
    }
    d.status = st;
    await d.save();
    if (st === 'approved') {
        l.status = 'adopted';
        await l.save();
    }
    (0, lib_1.ok)(s, d);
}));
r.use('/adoption/requests', adReq);
r.use('/adoption', (0, lib_1.crud)(models_1.Listing, {
    pub: () => ({ status: 'approved' }),
    lock: ['status'],
    filters: ['species', 'location', 'gender'],
    pop: 'owner',
}));
// =====================================================
// COMMUNITY
// =====================================================
const com = (0, express_1.Router)();
com.use(lib_1.auth);
const getPost = async (id) => {
    const p = await models_1.Post.findOne({
        _id: id,
        hidden: false,
    });
    if (!p) {
        throw (0, lib_1.httpError)(404, 'Post not found');
    }
    return p;
};
com.post('/:id/like', (0, lib_1.h)(async (q, s) => {
    const p = await getPost(q.params.id);
    const i = p.likes.findIndex(u => String(u) === q.user.id);
    if (i >= 0) {
        p.likes.splice(i, 1);
    }
    else {
        p.likes.push(q.user._id);
    }
    await p.save();
    (0, lib_1.ok)(s, {
        liked: i < 0,
        likes: p.likes.length,
    });
}));
com.post('/:id/comments', (0, lib_1.h)(async (q, s) => {
    const text = zod_1.z.string().min(1).max(500).parse(q.body.text);
    const p = await getPost(q.params.id);
    p.comments.push({
        owner: q.user._id,
        text,
    });
    await p.save();
    (0, lib_1.ok)(s.status(201), p.comments);
}));
com.delete('/:id/comments/:cid', (0, lib_1.h)(async (q, s) => {
    const p = await getPost(q.params.id);
    const c = p.comments.find(x => String(x._id) === q.params.cid);
    if (!c) {
        throw (0, lib_1.httpError)(404, 'Comment not found');
    }
    if (String(c.owner) !== q.user.id &&
        q.user.role !== 'admin') {
        throw (0, lib_1.httpError)(403, 'Not allowed');
    }
    p.comments = p.comments.filter(x => x !== c);
    await p.save();
    (0, lib_1.ok)(s, { deleted: true });
}));
com.post('/:id/report', (0, lib_1.h)(async (q, s) => {
    const reason = zod_1.z.string().min(3).max(300).parse(q.body.reason);
    await getPost(q.params.id);
    (0, lib_1.ok)(s.status(201), await models_1.Report.create({
        post: q.params.id,
        reporter: q.user.id,
        reason,
    }));
}));
r.use('/community', com, (0, lib_1.crud)(models_1.Post, {
    pub: () => ({ hidden: false }),
    lock: ['likes', 'comments', 'hidden'],
    pop: 'owner',
}));
// =====================================================
// STORE / PRODUCTS
// =====================================================
r.use('/products', (0, lib_1.crud)(models_1.Product, {
    pub: () => ({ active: true }),
    adminWrite: true,
    filters: ['category'],
}));
// =====================================================
// CART
// =====================================================
const cart = (0, express_1.Router)();
cart.use(lib_1.auth);
const cartOut = async (u) => (await models_1.Cart.findOne({ user: u }).populate('items.product')) || {
    items: [],
};
cart.get('/', (0, lib_1.h)(async (q, s) => {
    (0, lib_1.ok)(s, await cartOut(q.user.id));
}));
cart.put('/items', (0, lib_1.h)(async (q, s) => {
    const b = zod_1.z.object({
        product: zod_1.z.string(),
        qty: zod_1.z.number().int().min(0),
    }).parse(q.body);
    const p = await models_1.Product.findOne({
        _id: b.product,
        active: true,
    });
    if (!p) {
        throw (0, lib_1.httpError)(404, 'Product not found');
    }
    if (b.qty > p.stock) {
        throw (0, lib_1.httpError)(400, `Only ${p.stock} in stock`);
    }
    const c = (await models_1.Cart.findOne({
        user: q.user.id,
    })) || new models_1.Cart({
        user: q.user.id,
        items: [],
    });
    const it = c.items.find(i => String(i.product) === b.product);
    if (it) {
        if (b.qty === 0) {
            c.items = c.items.filter(i => i !== it);
        }
        else {
            it.qty = b.qty;
        }
    }
    else if (b.qty > 0) {
        c.items.push({
            product: p._id,
            qty: b.qty,
        });
    }
    await c.save();
    (0, lib_1.ok)(s, await cartOut(q.user.id));
}));
r.use('/cart', cart);
// =====================================================
// ORDERS
// =====================================================
const ord = (0, express_1.Router)();
ord.use(lib_1.auth);
ord.get('/', (0, lib_1.h)(async (q, s) => {
    (0, lib_1.ok)(s, await models_1.Order.find({
        user: q.user.id,
    }).sort('-createdAt'));
}));
ord.post('/checkout', (0, lib_1.h)(async (q, s) => {
    const c = await models_1.Cart.findOne({
        user: q.user.id,
    }).populate('items.product');
    if (!c || !c.items.length) {
        throw (0, lib_1.httpError)(400, 'Your cart is empty');
    }
    const done = [];
    const lines = [];
    try {
        for (const i of c.items) {
            const upd = await models_1.Product.updateOne({
                _id: i.product._id,
                active: true,
                stock: { $gte: i.qty },
            }, {
                $inc: { stock: -i.qty },
            });
            if (!upd.modifiedCount) {
                throw (0, lib_1.httpError)(409, `Not enough stock for ${i.product.name}`);
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
    }
    catch (e) {
        for (const d of done) {
            await models_1.Product.updateOne({ _id: d.id }, { $inc: { stock: d.qty } });
        }
        throw e;
    }
    const o = await models_1.Order.create({
        user: q.user.id,
        items: lines,
        total: lines.reduce((t, l) => t + l.price * l.qty, 0),
        demo: true,
    });
    c.items = [];
    await c.save();
    (0, lib_1.ok)(s.status(201), o);
}));
r.use('/orders', ord);
// =====================================================
// FAVORITES
// =====================================================
const fav = (0, express_1.Router)();
fav.use(lib_1.auth);
fav.get('/', (0, lib_1.h)(async (q, s) => {
    (0, lib_1.ok)(s, await models_1.Favorite.find({
        user: q.user.id,
    }).populate('product'));
}));
fav.post('/:productId', (0, lib_1.h)(async (q, s) => {
    const f = await models_1.Favorite.findOneAndDelete({
        user: q.user.id,
        product: q.params.productId,
    });
    if (!f) {
        await models_1.Favorite.create({
            user: q.user.id,
            product: q.params.productId,
        });
    }
    (0, lib_1.ok)(s, { favorite: !f });
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
const ai = (0, express_1.Router)();
ai.use(lib_1.auth, (0, express_rate_limit_1.default)({
    windowMs: 60_000,
    limit: 15,
    message: {
        success: false,
        message: 'Too many AI requests, slow down.',
    },
}));
ai.get('/conversations/:id', (0, lib_1.h)(async (q, s) => {
    const conversation = await models_1.AIConversation.findOne({
        _id: q.params.id,
        user: q.user.id,
    });
    (0, lib_1.ok)(s, conversation);
}));
ai.post('/chat', (0, lib_1.h)(async (q, s) => {
    const b = zod_1.z.object({
        message: zod_1.z.string().trim().min(1).max(2000),
        conversationId: zod_1.z.string().optional(),
        petId: zod_1.z.string().optional(),
    }).parse(q.body);
    const apiKey = process.env.GROQ_API_KEY?.trim();
    if (!apiKey) {
        throw (0, lib_1.httpError)(503, 'The AI assistant is not configured. Set GROQ_API_KEY in server/.env.');
    }
    const conv = (b.conversationId &&
        await models_1.AIConversation.findOne({
            _id: b.conversationId,
            user: q.user.id,
        })) || new models_1.AIConversation({
        user: q.user.id,
        messages: [],
    });
    let ctx = '';
    if (b.petId) {
        const p = await models_1.Pet.findOne({
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
    const model = process.env.GROQ_MODEL?.trim() ||
        'openai/gpt-oss-120b';
    const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
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
    }).catch((error) => {
        console.error('Groq connection error:', error);
        return null;
    });
    if (!resp) {
        throw (0, lib_1.httpError)(502, 'Could not connect to Groq. Check your internet connection and try again.');
    }
    if (!resp.ok) {
        const errorDetails = await resp.text();
        console.error('Groq API Error:', resp.status, errorDetails);
        throw (0, lib_1.httpError)(502, `Groq API request failed (${resp.status}). Check the backend terminal for details.`);
    }
    const data = await resp.json();
    const reply = data.choices?.[0]?.message?.content;
    if (!reply || !reply.trim()) {
        console.error('Groq returned an empty response:', data);
        throw (0, lib_1.httpError)(502, 'Groq returned an empty answer. Please try again.');
    }
    conv.messages.push({
        role: 'assistant',
        content: reply,
    });
    await conv.save();
    (0, lib_1.ok)(s, {
        conversationId: conv.id,
        reply,
    });
}));
r.use('/ai', ai);
// =====================================================
// ADMIN
// =====================================================
const ad = (0, express_1.Router)();
ad.use(lib_1.auth, lib_1.adminOnly);
ad.get('/stats', (0, lib_1.h)(async (_q, s) => {
    const [users, pets, listings, products, orders, posts, reports,] = await Promise.all([
        models_1.User.countDocuments(),
        models_1.Pet.countDocuments(),
        models_1.Listing.countDocuments(),
        models_1.Product.countDocuments(),
        models_1.Order.countDocuments(),
        models_1.Post.countDocuments(),
        models_1.Report.countDocuments({ resolved: false }),
    ]);
    (0, lib_1.ok)(s, {
        users,
        pets,
        listings,
        products,
        orders,
        posts,
        openReports: reports,
    });
}));
ad.get('/users', (0, lib_1.h)(async (q, s) => {
    const re = q.query.q
        ? new RegExp(String(q.query.q).replace(/[^\w@. -]/g, ''), 'i')
        : /./;
    (0, lib_1.ok)(s, await models_1.User.find({
        $or: [
            { name: re },
            { email: re },
        ],
    })
        .sort('-createdAt')
        .limit(100));
}));
ad.put('/users/:id', (0, lib_1.h)(async (q, s) => {
    if (q.params.id === q.user.id) {
        throw (0, lib_1.httpError)(400, 'You cannot change your own account here');
    }
    const b = zod_1.z.object({
        active: zod_1.z.boolean().optional(),
        role: zod_1.z.enum(['user', 'admin']).optional(),
    }).parse(q.body);
    (0, lib_1.ok)(s, await models_1.User.findByIdAndUpdate(q.params.id, b, { new: true }));
}));
ad.get('/listings', (0, lib_1.h)(async (q, s) => {
    (0, lib_1.ok)(s, await models_1.Listing.find(q.query.status
        ? { status: String(q.query.status) }
        : {})
        .sort('-createdAt')
        .populate('owner', 'name'));
}));
ad.put('/listings/:id/status', (0, lib_1.h)(async (q, s) => {
    (0, lib_1.ok)(s, await models_1.Listing.findByIdAndUpdate(q.params.id, {
        status: zod_1.z.enum([
            'pending',
            'approved',
            'rejected',
        ]).parse(q.body.status),
    }, { new: true }));
}));
ad.get('/orders', (0, lib_1.h)(async (_q, s) => {
    (0, lib_1.ok)(s, await models_1.Order.find()
        .sort('-createdAt')
        .limit(100)
        .populate('user', 'name email'));
}));
ad.put('/orders/:id', (0, lib_1.h)(async (q, s) => {
    (0, lib_1.ok)(s, await models_1.Order.findByIdAndUpdate(q.params.id, {
        status: zod_1.z.enum([
            'placed',
            'processing',
            'shipped',
            'delivered',
            'cancelled',
        ]).parse(q.body.status),
    }, { new: true }));
}));
ad.get('/reports', (0, lib_1.h)(async (_q, s) => {
    (0, lib_1.ok)(s, await models_1.Report.find({ resolved: false })
        .sort('-createdAt')
        .populate('post', 'caption hidden')
        .populate('reporter', 'name'));
}));
ad.put('/reports/:id/resolve', (0, lib_1.h)(async (q, s) => {
    const rp = await models_1.Report.findById(q.params.id);
    if (!rp) {
        throw (0, lib_1.httpError)(404, 'Not found');
    }
    if (q.body.hidePost) {
        await models_1.Post.updateOne({ _id: rp.post }, { hidden: true });
    }
    rp.resolved = true;
    await rp.save();
    (0, lib_1.ok)(s, rp);
}));
r.use('/admin', ad);
exports.default = r;
