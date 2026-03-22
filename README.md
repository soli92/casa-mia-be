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

## 🔐 Environment Variables

```
DATABASE_URL=postgresql://user:pass@host:5432/dbname
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret
PORT=3001
FRONTEND_URL=http://localhost:3000
```

## 🌐 Deploy

Backend deployato su: https://casa-mia-be.onrender.com

## 🌐 API Endpoints

### Auth
- `POST /api/auth/register` - Registrazione utente
- `POST /api/auth/login` - Login
- `POST /api/auth/refresh` - Refresh token
- `GET /api/auth/me` - Profilo utente

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

Connetti a `ws://localhost:3001` per ricevere aggiornamenti IoT in tempo reale.

Eventi:
- `device:status` - Cambio stato dispositivo
- `device:connected` - Nuovo dispositivo connesso

## 📄 License

MIT
