import { Request, Response, NextFunction, Router } from 'express';
import jwt from 'jsonwebtoken';
import { Model } from 'mongoose';
import { User, Pet } from './models';

export const SECRET = () => process.env.JWT_SECRET || 'dev-secret-change-me';

export interface AuthReq extends Request {
  user: InstanceType<typeof User>;
}

export const httpError = (status: number, message: string) =>
  Object.assign(new Error(message), { status });

export const h = (
  f: (q: AuthReq, s: Response, n: NextFunction) => unknown
) => (q: Request, s: Response, n: NextFunction) =>
  Promise.resolve(f(q as AuthReq, s, n)).catch(n);

export const ok = (s: Response, data: unknown, extra: object = {}) =>
  s.json({ success: true, data, ...extra });

export const auth = h(async (q, _s, n) => {
  const t = q.headers.authorization?.split(' ')[1];

  if (!t) {
    throw httpError(401, 'Authentication required');
  }

  let id = '';

  try {
    id = (jwt.verify(t, SECRET()) as { id: string }).id;
  } catch {
    throw httpError(401, 'Invalid or expired token');
  }

  const u = await User.findById(id);

  if (!u || !u.active) {
    throw httpError(401, 'Account unavailable');
  }

  q.user = u;
  n();
});

export const adminOnly = (
  q: Request,
  _s: Response,
  n: NextFunction
) =>
  (q as AuthReq).user.role === 'admin'
    ? n()
    : n(httpError(403, 'Admin access required'));

const esc = (s: string) =>
  s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

interface Opts {
  pub?: (q: AuthReq) => object;
  pop?: string;
  filters?: string[];
  lock?: string[];
  date?: string;
  adminWrite?: boolean;
}

/**
 * Generic secured CRUD:
 * owner-scoped, or public-read/admin-write.
 * Identity always comes from the verified token.
 */
export function crud(M: Model<any>, o: Opts = {}) {
  const r = Router();

  r.use(auth);

  const skip = [
    '_id',
    '__v',
    'createdAt',
    'updatedAt',
    'owner',
    ...(o.lock || [])
  ];

  const clean = (b: Record<string, unknown>) =>
    Object.fromEntries(
      Object.entries(b).filter(
        ([k]) => k in M.schema.paths && !skip.includes(k)
      )
    );

  const mine = (q: AuthReq) =>
    q.user.role === 'admin' && !o.pub
      ? {}
      : { owner: q.user.id };

  const checkPet = async (
    q: AuthReq,
    b: Record<string, unknown>
  ) => {
    if (
      b.pet &&
      !(await Pet.exists({
        _id: b.pet,
        owner: q.user.id
      }))
    ) {
      throw httpError(403, 'This pet does not belong to you');
    }
  };

  // GET all records
  r.get(
    '/',
    h(async (q, s) => {
      const f: Record<string, unknown> =
        o.pub && !q.query.mine
          ? { ...o.pub(q) }
          : { owner: q.user.id };

      for (const k of o.filters || []) {
        if (q.query[k]) {
          f[k] = q.query[k];
        }
      }

      if (q.query.q) {
        const re = new RegExp(
          esc(String(q.query.q)),
          'i'
        );

        f.$or = [
          { name: re },
          { title: re },
          { caption: re }
        ];
      }

      if (o.date && (q.query.from || q.query.to)) {
        f[o.date] = {
          ...(q.query.from
            ? { $gte: new Date(String(q.query.from)) }
            : {}),
          ...(q.query.to
            ? { $lte: new Date(String(q.query.to)) }
            : {})
        };
      }

      const page = Math.max(1, +(q.query.page || 1));
      const limit = Math.min(50, +(q.query.limit || 24));

      const dataQuery = M.find(f)
        .sort(
          o.date
            ? { [o.date]: 1 }
            : { createdAt: -1 }
        )
        .skip((page - 1) * limit)
        .limit(limit);

      // Only populate when a valid path was configured
      if (o.pop) {
        dataQuery.populate(o.pop, 'name');
      }

      const [data, total] = await Promise.all([
        dataQuery,
        M.countDocuments(f)
      ]);

      ok(s, data, { total, page });
    })
  );

  // GET one record
  r.get(
    '/:id',
    h(async (q, s) => {
      const detailQuery = M.findOne({
        _id: q.params.id,
        ...(o.pub && !o.adminWrite
          ? o.pub(q)
          : o.adminWrite
            ? {}
            : { owner: q.user.id })
      });

      // Only populate when a valid path was configured
      if (o.pop) {
        detailQuery.populate(o.pop, 'name');
      }

      const d = await detailQuery;

      if (!d) {
        throw httpError(404, 'Not found');
      }

      ok(s, d);
    })
  );

  // CREATE
  r.post(
    '/',
    h(async (q, s) => {
      if (o.adminWrite && q.user.role !== 'admin') {
        throw httpError(403, 'Admin access required');
      }

      await checkPet(q, q.body);

      ok(
        s.status(201),
        await M.create({
          ...clean(q.body),
          ...(o.adminWrite
            ? {}
            : { owner: q.user.id })
        })
      );
    })
  );

  // UPDATE
  r.put(
    '/:id',
    h(async (q, s) => {
      if (o.adminWrite && q.user.role !== 'admin') {
        throw httpError(403, 'Admin access required');
      }

      await checkPet(q, q.body);

      const d = await M.findOneAndUpdate(
        {
          _id: q.params.id,
          ...(o.adminWrite
            ? {}
            : { owner: q.user.id })
        },
        clean(q.body),
        {
          new: true,
          runValidators: true
        }
      );

      if (!d) {
        throw httpError(404, 'Not found');
      }

      ok(s, d);
    })
  );

  // DELETE
  r.delete(
    '/:id',
    h(async (q, s) => {
      const d = await M.findOneAndDelete({
        _id: q.params.id,
        ...(o.adminWrite ||
        (q.user.role === 'admin' && o.pub)
          ? {}
          : { owner: q.user.id })
      });

      if (!d) {
        throw httpError(404, 'Not found');
      }

      ok(s, { deleted: true });
    })
  );

  void mine;

  return r;
}

export const token = (id: string) =>
  jwt.sign(
    { id },
    SECRET(),
    { expiresIn: '7d' }
  );