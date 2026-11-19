"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const routes_1 = __importDefault(require("./routes"));
exports.app = (0, express_1.default)();
exports.app.use((0, helmet_1.default)());
exports.app.use((0, cors_1.default)({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
exports.app.use(express_1.default.json({ limit: '1mb' }));
exports.app.use('/api/v1', (0, express_rate_limit_1.default)({ windowMs: 60_000, limit: 300 }), routes_1.default);
exports.app.use((e, _q, s, _n) => {
    const st = e.status || (e.name === 'ValidationError' || e.name === 'ZodError' || e.name === 'CastError' ? 400 : 500);
    if (st === 500)
        console.error(e);
    s.status(st).json({ success: false, message: st === 500 ? 'Internal server error' : e.message });
});
