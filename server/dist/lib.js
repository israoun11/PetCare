"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.token = exports.adminOnly = exports.auth = exports.ok = exports.h = exports.httpError = exports.SECRET = void 0;
exports.crud = crud;
const express_1 = require("express");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const models_1 = require("./models");
const SECRET = () => process.env.JWT_SECRET || 'dev-secret-change-me';
exports.SECRET = SECRET;
const httpError = (status, message) => Object.assign(new Error(message), { status });
exports.httpError = httpError;
const h = (f) => (q, s, n) => Promise.resolve(f(q, s, n)).catch(n);
exports.h = h;
const ok = (s, data, extra = {}) => s.json({ success: true, data, ...extra });
exports.ok = ok;
exports.auth = (0, exports.h)(async (q, _s, n) => {
    const t = q.headers.authorization?.split(' ')[1];
    if (!t) {
        throw (0, exports.httpError)(401, 'Authentication required');
    }
    let id = '';
    try {
        id = jsonwebtoken_1.default.verify(t, (0, exports.SECRET)()).id;
    }
    catch {
        throw (0, exports.httpError)(401, 'Invalid or expired token');
    }
    const u = await models_1.User.findById(id);
    if (!u || !u.active) {
        throw (0, exports.httpError)(401, 'Account unavailable');
    }
    q.user = u;
    n();
});
const adminOnly = (q, _s, n) => q.user.role === 'admin'
    ? n()
    : n((0, exports.httpError)(403, 'Admin access required'));
exports.adminOnly = adminOnly;
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/**
 * Generic secured CRUD:
 * owner-scoped, or public-read/admin-write.
 * Identity always comes from the verified token.
 */
function crud(M, o = {}) {
    const r = (0, express_1.Router)();
    r.use(exports.auth);
    const skip = [
        '_id',
        '__v',
        'createdAt',
        'updatedAt',
        'owner',
        ...(o.lock || [])
    ];
    const clean = (b) => Object.fromEntries(Object.entries(b).filter(([k]) => k in M.schema.paths && !skip.includes(k)));
    const mine = (q) => q.user.role === 'admin' && !o.pub
        ? {}
        : { owner: q.user.id };
    const checkPet = async (q, b) => {
        if (b.pet &&
            !(await models_1.Pet.exists({
                _id: b.pet,
                owner: q.user.id
            }))) {
            throw (0, exports.httpError)(403, 'This pet does not belong to you');
        }
    };
    // GET all records
    r.get('/', (0, exports.h)(async (q, s) => {
        const f = o.pub && !q.query.mine
            ? { ...o.pub(q) }
            : { owner: q.user.id };
        for (const k of o.filters || []) {
            if (q.query[k]) {
                f[k] = q.query[k];
            }
        }
        if (q.query.q) {
            const re = new RegExp(esc(String(q.query.q)), 'i');
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
            .sort(o.date
            ? { [o.date]: 1 }
            : { createdAt: -1 })
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
        (0, exports.ok)(s, data, { total, page });
    }));
    // GET one record
    r.get('/:id', (0, exports.h)(async (q, s) => {
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
            throw (0, exports.httpError)(404, 'Not found');
        }
        (0, exports.ok)(s, d);
    }));
    // CREATE
    r.post('/', (0, exports.h)(async (q, s) => {
        if (o.adminWrite && q.user.role !== 'admin') {
            throw (0, exports.httpError)(403, 'Admin access required');
        }
        await checkPet(q, q.body);
        (0, exports.ok)(s.status(201), await M.create({
            ...clean(q.body),
            ...(o.adminWrite
                ? {}
                : { owner: q.user.id })
        }));
    }));
    // UPDATE
    r.put('/:id', (0, exports.h)(async (q, s) => {
        if (o.adminWrite && q.user.role !== 'admin') {
            throw (0, exports.httpError)(403, 'Admin access required');
        }
        await checkPet(q, q.body);
        const d = await M.findOneAndUpdate({
            _id: q.params.id,
            ...(o.adminWrite
                ? {}
                : { owner: q.user.id })
        }, clean(q.body), {
            new: true,
            runValidators: true
        });
        if (!d) {
            throw (0, exports.httpError)(404, 'Not found');
        }
        (0, exports.ok)(s, d);
    }));
    // DELETE
    r.delete('/:id', (0, exports.h)(async (q, s) => {
        const d = await M.findOneAndDelete({
            _id: q.params.id,
            ...(o.adminWrite ||
                (q.user.role === 'admin' && o.pub)
                ? {}
                : { owner: q.user.id })
        });
        if (!d) {
            throw (0, exports.httpError)(404, 'Not found');
        }
        (0, exports.ok)(s, { deleted: true });
    }));
    void mine;
    return r;
}
const token = (id) => jsonwebtoken_1.default.sign({ id }, (0, exports.SECRET)(), { expiresIn: '7d' });
exports.token = token;
