# 🏠 Casa Mia - Backend

Backend Node.js/Express per l'applicazione di gestione domestica "Casa Mia".

## 🚀 Features

- **Autenticazione JWT** con refresh token
- **Lista della spesa** con categorie e storico
- **Dispensa** con alert scadenze
- **Suggerimenti ricette** basati su prodotti disponibili
- **Calendario scadenze** (bollette, abbonamenti, ecc.)
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

Su **Render**, `DATABASE_URL` verso Supabase deve usare il **connection pooler** (porta **6543**) e `?pgbouncer=true`, non `db.*:5432` (spesso irraggiungibile da IPv4). Dettaglio in **`DATABASE_SETUP.md`**.

## 🌐 API Endpoints

### Auth
- `POST /api/auth/register` - Registrazione utente (famiglia + admin)
- `POST /api/auth/login` - Login
- `POST /api/auth/refresh` - Nuovi access/refresh token
- `GET /api/auth/me` - Profilo utente (Bearer access token)
- `POST /api/auth/add-member` - Aggiungi membro (solo admin, Bearer)

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

Il server espone **WebSocket nativo** (`ws`) sullo stesso HTTP server, path **`/ws`** (es. `ws://localhost:3001/ws`). Il frontend può usare `WebSocket` nel browser o un client compatibile; `socket.io-client` non è intercambiabile senza adapter.

Eventi (dopo messaggio `auth` con token JWT):

- `device:status` - Cambio stato dispositivo
- `device:connected` - Nuovo dispositivo connesso

## 📄 License

MIT
