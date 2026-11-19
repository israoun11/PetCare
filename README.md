# PETCARE — Everything Your Pet Needs, All in One Place

Full-stack app: React + TypeScript + Vite + Tailwind (client) and Node + Express + TypeScript + MongoDB/Mongoose (server).

## Run locally
1. MongoDB running locally (or Atlas URI).
2. `cd server && cp .env.example .env && npm install && npm run seed && npm run dev` (API on :5000)
3. `cd client && cp .env.example .env && npm install && npm run dev` (app on :5173)

Demo accounts (local dev only, created by the seed): `admin@petcare.local` and `sarah@petcare.local`, password `Demo1234!`.

## Features
Auth (JWT, bcrypt, roles, forgot/reset), dashboard from real data, pets + profile page with weight chart, health records (vaccines, medical, medication, weight, appointments), daily care with persistent due dates and auto-created recurring tasks, adoption (listings with admin moderation, requests workflow), community (posts, likes, comments, reports), store (products, favorites, persisted cart, stock-validated demo checkout, orders), AI assistant (backend only, mascot identity), admin dashboard (users, listings, products, orders, reports). Every API route derives identity from the JWT; owner checks on every private resource.

## Environment variables (`server/.env`)
`MONGO_URI`, `JWT_SECRET`, `CLIENT_URL`, `OPENAI_API_KEY` (without it the assistant answers with a clear 503 message; the rest keeps working), `OPENAI_MODEL`.

## Known limitations (be aware)
- **Not compiled or tested**: the build environment had no network, so `npm install`, `tsc`, the build and any test were never run. Expect small type errors to fix.
- No automated tests are included yet.
- Images are URL fields: Cloudinary upload is not implemented. Seed photo URLs are placeholders and unverified (the mascot shows when an image fails).
- No email sending: the password reset link is printed in the server console in development.
- Reminders are stored and shown (due dates, recurrence) but there is no push/email delivery or Notification model.
- Follow system, document uploads and the pet-photo AI feature are not implemented.
- Client uses plain controlled forms instead of React Hook Form/Zod/TanStack Query; server validates with Zod on auth, AI and key routes and Mongoose schemas elsewhere.
- Order payments are a **demo**: nothing is charged.
