# 🏠 Casa Mia - Backend

Backend Node.js/Express per l'applicazione di gestione domestica "Casa Mia".

Contesto per assistenti AI: **[`AGENTS.md`](./AGENTS.md)**. Il backend compare in [Soli Prof RAG `CORPUS_REPOS`](https://github.com/soli92/soli-prof); un `push` può attivare re-ingest lato Soli (webhook `push`, HMAC) senza toccare `npm test` in questo repository.

## 🚀 Features

- **Autenticazione JWT** con refresh token
- **Multi-utente per famiglia** — i dati REST sono filtrati per `familyId`; tutti i membri leggono/scrivono gli stessi dati (solo **admin**: `add-member`, `PATCH` nome famiglia)
- **Lista della spesa** con categorie e storico
- **Dispensa** con alert scadenze
- **Suggerimenti ricette** basati su prodotti disponibili
- **Calendario scadenze** (bollette, abbonamenti, ecc.)
- **Lavagna condivisa** — post-it (`PostIt`) con posizione %, colori, CRUD sotto `/api/board`
- **Documenti famiglia** — file su object storage (S3/R2): **cartelle** (`DocumentFolder`), metadati + `storageKey`; upload con **PUT** presigned; **lettura in app** con `GET` presigned (bucket **privato** ok; `S3_PUBLIC_URL` opzionale / legacy)
- **Hub IoT** con WebSocket per dispositivi smart home in tempo reale
- **Web Push (scadenze)** — VAPID, sottoscrizioni in `PushSubscription`, digest giornaliero (cron) con scadenze scadute o nei prossimi 7 giorni

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
npm test          # Vitest
npm run test:watch
```

Suite: **JWT** (`tests/jwt.test.js`), **middleware auth** (`tests/auth.middleware.test.js`), **health** HTTP su `createApp()` (`tests/app.test.js`), util **`documentStorage`** (`tests/documentStorage.test.js`), route **`/api/documents`** con Prisma/storage mockati (`tests/documents.routes.test.js`). Nessun database reale richiesto per i test attuali.

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

**Web Push (opzionale):** `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (`npx web-push generate-vapid-keys`), `VAPID_SUBJECT=mailto:…`. Senza chiavi, `GET /api/push/vapid-public-key` risponde 503 e il digest non invia nulla. Opzionale: `TZ=Europe/Rome` per il cron digest (ore 9 nel fuso del processo). Vedi `.env.example`.

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

### Documenti (S3-compatibile, cartelle, URL firmati)

**Configurazione** (`.env`, vedi `.env.example`): obbligatori `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`; opzionali `S3_REGION`, `S3_ENDPOINT`, `S3_FORCE_PATH_STYLE` (tipico R2/MinIO). **`S3_PUBLIC_URL`** è **opzionale**: se assente, i nuovi documenti non hanno CDN pubblico e la lettura avviene solo tramite **GetObject** presigned dal backend.

**CORS sul bucket**: consentire **PUT** e **HEAD** dall’origine del frontend (upload diretto dopo `presign`). Per **GET** su URL firmati, il browser parla con lo storage (stesso comportamento di bucket privato).

- `GET /api/documents` — `{ folders, items, storageConfigured, maxBytes }`. Ogni voce in `items` include metadati, `storageKey`, `folderId`, relazioni `uploadedBy` / `folder`; **`publicUrl` non è esposto** nella risposta (anche se presente su righe legacy).
- `POST /api/documents/folders` — body `{ name }` → crea cartella per la famiglia (`sortOrder` automatico).
- `PATCH /api/documents/folders/:folderId` — body `{ name }` → rinomina.
- `DELETE /api/documents/folders/:folderId` — elimina la cartella; i documenti collegati restano con `folderId` null.
- `POST /api/documents/presign` — body `{ originalName, contentType, sizeBytes, folderId? }` → `{ uploadUrl, storageKey, … }` per **PUT** diretto al bucket.
- `POST /api/documents/commit` — body `{ storageKey, originalName, contentType, sizeBytes, folderId? }` dopo PUT riuscito; verifica con **HEAD** sul bucket; crea riga `FamilyDocument` (eventuale `publicUrl` solo se `S3_PUBLIC_URL` è impostato).
- `GET /api/documents/:id/access-url` — `{ url, expiresIn, mimeType, originalName }`: URL **GET** presigned (~15 min) per anteprima in app.
- `DELETE /api/documents/:id` — rimuove oggetto da storage e riga DB (stessa famiglia).

**Migrazioni Prisma**: `*_family_documents` (tabella documenti), `*_document_folders` (cartelle + `folderId` su documenti, `publicUrl` nullable).

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
- `GET /api/deadlines/upcoming` - Prossimi 7 giorni (non pagate)
- `GET /api/deadlines/overdue` - Scadute e non pagate
- `POST /api/deadlines` - Aggiungi scadenza
- `PATCH /api/deadlines/:id` - Aggiorna
- `DELETE /api/deadlines/:id` - Rimuovi

### Push (notifiche browser)
- `GET /api/push/vapid-public-key` - Chiave pubblica VAPID (pubblico, nessun Bearer)
- `POST /api/push/subscribe` - Registra `PushSubscription` (Bearer, body `{ endpoint, keys: { p256dh, auth } }`)
- `DELETE /api/push/subscribe` - Body `{ endpoint }`; rimuove la sottoscrizione dell’utente corrente

Il digest giornaliero (`src/services/deadlinePushDigest.js`, schedulato in `src/index.js`) invia al più una notifica al giorno per endpoint con riepilogo scadenze non pagate (scadute o entro 7 giorni).

### IoT
- `GET /api/iot/devices` - Lista dispositivi
- `POST /api/iot/devices` - Aggiungi dispositivo
- `PATCH /api/iot/devices/:id` - Aggiorna stato
- `POST /api/iot/webhook` - Webhook per eventi dispositivi

## 🔌 WebSocket

Il server espone **WebSocket nativo** (`ws`) sullo stesso HTTP server, path **`/ws`** (es. `ws://localhost:3001/ws`). Dopo il messaggio `{"type":"auth","token":"<JWT>"}` il client è associato alla `familyId`.

Messaggi dal client:

- `{"type":"update","resource":"shopping|pantry|…|board|documents","action":"create|update|delete","data":{}}` — broadcast alla famiglia come `data_update` (include `userId`). Il frontend usa `documents` dopo upload/eliminazione documenti o modifiche cartelle.

Messaggi verso il client:

- `auth_success` — autenticazione OK
- `data_update` — altro membro ha aggiornato una risorsa (il frontend usa toast + refetch)
- `iot_update` — evento IoT
- `error` — errore (es. token non valido)

## 📄 License

MIT
