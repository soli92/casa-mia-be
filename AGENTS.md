# AGENTS.md — contesto per assistenti AI

**Aggiornato:** 2026-04-04

## Progetto

Backend **Express** (ESM), **Prisma** + PostgreSQL, JWT access/refresh, WebSocket **`ws`** su path `/ws`. **Documenti famiglia**: cartelle (`DocumentFolder`), file su S3-compatibile (`FamilyDocument.storageKey`), upload **PUT** presigned, lettura **GET** presigned (`/api/documents/:id/access-url`); `S3_PUBLIC_URL` opzionale (bucket privato ok).

## Checklist

1. **Env** — `cp .env.example .env`; `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `FRONTEND_URL`. Per documenti: `S3_BUCKET`, chiavi, opz. `S3_ENDPOINT` / `S3_REGION` / `S3_FORCE_PATH_STYLE` (vedi `.env.example`). Per push scadenze: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (`npx web-push generate-vapid-keys`); opz. `TZ=Europe/Rome`.
2. **DB** — `npx prisma migrate dev` in locale; `npm run prisma:migrate` in deploy. Dopo pull: verificare migration `document_folders` se usi documenti.
3. **Prima di PR** — `npm test` (JWT, auth middleware, health, `documentStorage`, route `documents` e `push` mockate); con DB: smoke login/register; se tocchi documenti, prova lista/presign con storage configurato.
4. **Non committare** `.env` con segreti reali (né chiavi S3).

## Comandi

`npm run dev` · `npm test` · `npm run test:watch` · `npm start` · `npm run build` (solo `prisma generate`)

## File utili

- `src/app.js` — `createApp()` (testabile con supertest)
- `src/index.js` — avvio server + cron + WebSocket
- `src/utils/jwt.js` — secret letti da `process.env` a ogni uso (test-friendly)
- `src/routes/documents.js` — cartelle CRUD, presign/commit, `access-url`, delete
- `src/utils/documentStorage.js` — presign PUT/GET, `HEAD`, delete; config senza obbligo di `S3_PUBLIC_URL`
- `tests/documentStorage.test.js` · `tests/documents.routes.test.js` · `tests/push.routes.test.js`
- `src/routes/push.js` · `src/services/deadlinePushDigest.js`
- `prisma/schema.prisma` · `README.md` · `DATABASE_SETUP.md` · `AI_LOG.md` (memoria sviluppo AI-assisted)

## Regole

- Nuove route protette: `authenticateToken` (e `requireAdmin` se serve).
- Coerenza payload auth con il frontend: `accessToken` / `refreshToken` (non `token`); login/register includono `family`.
- Dati condivisi: filtrare sempre per `req.user.familyId` (`PostIt` / `board`, **documenti e cartelle**, shopping, pantry, ecc.).
- Documenti: chiavi oggetto sotto `families/{familyId}/`; validare `folderId` sulla stessa famiglia; non esporre `publicUrl` nelle liste API (solo legacy in DB).
