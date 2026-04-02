# AGENTS.md — contesto per assistenti AI

**Aggiornato:** 2026-04-02

## Progetto

Backend **Express** (ESM), **Prisma** + PostgreSQL, JWT access/refresh, WebSocket **`ws`** su path `/ws`.

## Checklist

1. **Env** — `cp .env.example .env`; `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `FRONTEND_URL`.
2. **DB** — `npx prisma migrate dev` in locale; `npm run prisma:migrate` in deploy.
3. **Prima di PR** — `npm test`; con DB: smoke manuale su login/register.
4. **Non committare** `.env` con segreti reali.

## Comandi

`npm run dev` · `npm test` · `npm run test:watch` · `npm start` · `npm run build` (solo `prisma generate`)

## File utili

- `src/app.js` — `createApp()` (testabile con supertest)
- `src/index.js` — avvio server + cron + WebSocket
- `src/utils/jwt.js` — secret letti da `process.env` a ogni uso (test-friendly)
- `prisma/schema.prisma` · `README.md`

## Regole

- Nuove route protette: `authenticateToken` (e `requireAdmin` se serve).
- Coerenza payload auth con il frontend: `accessToken` / `refreshToken` (non `token`); login/register includono `family`.
- Dati condivisi: filtrare sempre per `req.user.familyId` (modello `PostIt` e route `src/routes/board.js`).
