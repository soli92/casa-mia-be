# 🏠 Casa Mia - Backend

Backend Node.js/Express per l'applicazione di gestione domestica "Casa Mia".

## 🚀 Features

- **Autenticazione JWT** con refresh token
- **Multi-utente per famiglia** — i dati REST sono filtrati per `familyId`; tutti i membri leggono/scrivono gli stessi dati (solo **admin**: `add-member`, `PATCH` nome famiglia)
- **Lista della spesa** con categorie e storico
- **Dispensa** con alert scadenze
- **Suggerimenti ricette** basati su prodotti disponibili
- **Calendario scadenze** (bollette, abbonamenti, ecc.)
- **Lavagna condivisa** — post-it (`PostIt`) con posizione %, colori, CRUD sotto `/api/board`
- **Hub IoT** con WebSocket per dispositivi smart home in tempo reale

## 🛠️ Tech Stack

- Node.js + Express
- PostgreSQL + Prisma ORM
- JWT authentication
- WebSocket (ws)
- Docker ready

## 📦 Setup

```bash
npm install
cp .env.example .env
# Configura DATABASE_URL in .env
npx prisma migrate dev
npm run dev
```

## 🧪 Test

```bash
npm test          # Vitest (JWT, middleware auth, health HTTP)
npm run test:watch
```

I test usano **supertest** sull’app Express (`createApp()` in `src/app.js`) senza avviare il server né richiedere database per `/health`. Variabili JWT nei test: vedi `tests/jwt.test.js`.

## 🏗️ Struttura runtime

- `src/app.js` — factory `createApp()` (middleware, route, `/health`); caricamento env con `import 'dotenv/config'` così le variabili sono disponibili prima dei moduli che le leggono.
- `src/index.js` — HTTP server, WebSocket, cron, `listen`.

## 🔐 Environment Variables

```
DATABASE_URL=postgresql://user:pass@host:5432/dbname
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret
PORT=3001
FRONTEND_URL=http://localhost:3000
```

Per **CORS**, `FRONTEND_URL` può elencare più origini separate da **virgola** (es. URL produzione + preview Vercel). Deve coincidere con l’origine del browser (`NEXT_PUBLIC_API_URL` sul frontend deve puntare a questo backend).

## 🚀 CI/CD

Questo progetto usa GitHub Actions per il deploy automatico su Render ad ogni push su `main`.

## 🌐 Deploy

Backend deployato su: https://casa-mia-be.onrender.com

Su **Render**, `DATABASE_URL` verso Supabase: di solito **Session pool** (`aws-0-<region>.pooler.supabase.com:5432`, utente `postgres.<ref>`, `sslmode=require`). Se `db.*:6543` non risponde, è normale: usa la session. Dettaglio in **`DATABASE_SETUP.md`**.

Se il deploy falliva con **P3005**, ora `npm run prisma:migrate` esegue un baseline automatico quando trova già la tabella `User` (vedi **`DATABASE_SETUP.md`**). Per disattivarlo: **`PRISMA_SKIP_AUTO_BASELINE=1`** su Render.

## 🌐 API Endpoints

### Auth
- `POST /api/auth/register` - Registrazione utente (**nuova** famiglia + admin; ottiene anche `family.inviteCode`)
- `POST /api/auth/join` - Entra in famiglia esistente con `{ inviteCode, email, password, name }` (stesso `familyId` dei dati condivisi)
- `POST /api/auth/login` - Login
- `POST /api/auth/refresh` - Nuovi access/refresh token
- `GET /api/auth/me` - Profilo utente + oggetto `family` (Bearer). `family.inviteCode` è incluso **solo** se sei `ADMIN` (per invitare altri).
- `GET /api/auth/members` - Elenco membri del nucleo (`id`, `email`, `name`, `role`, `createdAt`) (Bearer)
- `PATCH /api/auth/family` - Rinomina famiglia (solo admin, body `{ "name": "..." }`)
- `POST /api/auth/add-member` - Aggiungi membro (solo admin, Bearer)

### Board (lavagna / post-it)
- `GET /api/board/post-its` - Elenco post-it della famiglia
- `POST /api/board/post-its` - Crea (body opzionale: `content`, `color`, `xPercent`, `yPercent`, …)
- `PATCH /api/board/post-its/:id` - Aggiorna testo, colore, posizione, `zIndex`, `rotation`
- `DELETE /api/board/post-its/:id` - Elimina

Migrazione Prisma: `prisma/migrations/*_add_post_it/`. In deploy: `npx prisma migrate deploy`.

### Documenti (S3 / CDN)
Richiede variabili `S3_*` in `.env` (vedi `.env.example`): bucket **pubblico in lettura** (o dominio CDN) + `S3_PUBLIC_URL` senza slash finale. CORS sul bucket: consentire **PUT** e **HEAD** dall’origine del frontend.

- `GET /api/documents` - `{ items, storageConfigured, maxBytes }` (metadati + link pubblici)
- `POST /api/documents/presign` - body `{ originalName, contentType, sizeBytes }` → URL firmato per upload diretto al bucket
- `POST /api/documents/commit` - body `{ storageKey, originalName, contentType, sizeBytes }` dopo PUT riuscito → crea riga DB con `publicUrl`
- `DELETE /api/documents/:id` - Rimuove oggetto da storage e metadati (stessa famiglia)

Migrazione: `prisma/migrations/*_family_documents/`.

### Shopping
- `GET /api/shopping` - Lista della spesa
- `POST /api/shopping` - Aggiungi prodotto
- `PATCH /api/shopping/:id` - Aggiorna (spunta/desprunta)
- `DELETE /api/shopping/:id` - Rimuovi prodotto

### Pantry
- `GET /api/pantry` - Inventario dispensa
- `GET /api/pantry/expiring` - Prodotti in scadenza
- `POST /api/pantry` - Aggiungi prodotto
- `PATCH /api/pantry/:id` - Aggiorna quantità/scadenza
- `DELETE /api/pantry/:id` - Rimuovi

### Recipes
- `GET /api/recipes/suggestions` - Ricette suggerite
- `POST /api/recipes` - Crea ricetta custom
- `GET /api/recipes` - Tutte le ricette

### Deadlines
- `GET /api/deadlines` - Tutte le scadenze
- `GET /api/deadlines/upcoming` - Scadenze imminenti
- `POST /api/deadlines` - Aggiungi scadenza
- `PATCH /api/deadlines/:id` - Aggiorna
- `DELETE /api/deadlines/:id` - Rimuovi

### IoT
- `GET /api/iot/devices` - Lista dispositivi
- `POST /api/iot/devices` - Aggiungi dispositivo
- `PATCH /api/iot/devices/:id` - Aggiorna stato
- `POST /api/iot/webhook` - Webhook per eventi dispositivi

## 🔌 WebSocket

Il server espone **WebSocket nativo** (`ws`) sullo stesso HTTP server, path **`/ws`** (es. `ws://localhost:3001/ws`). Dopo il messaggio `{"type":"auth","token":"<JWT>"}` il client è associato alla `familyId`.

Messaggi dal client:

- `{"type":"update","resource":"shopping|pantry|…|board","action":"create|update|delete","data":{}}` — broadcast alla famiglia come `data_update` (include `userId`).

Messaggi verso il client:

- `auth_success` — autenticazione OK
- `data_update` — altro membro ha aggiornato una risorsa (il frontend usa toast + refetch)
- `iot_update` — evento IoT
- `error` — errore (es. token non valido)

## 📄 License

MIT
