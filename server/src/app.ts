import 'dotenv/config';
import express, { NextFunction, Request, Response } from 'express';
import helmet from 'helmet'; import cors from 'cors'; import rateLimit from 'express-rate-limit';
import routes from './routes';
export const app = express();
app.use(helmet()); app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use(express.json({ limit: '1mb' }));
app.use('/api/v1', rateLimit({ windowMs: 60_000, limit: 300 }), routes);
app.use((e: { status?: number; name?: string; message: string }, _q: Request, s: Response, _n: NextFunction) => {
  const st = e.status || (e.name === 'ValidationError' || e.name === 'ZodError' || e.name === 'CastError' ? 400 : 500);
  if (st === 500) console.error(e);
  s.status(st).json({ success: false, message: st === 500 ? 'Internal server error' : e.message });
});
