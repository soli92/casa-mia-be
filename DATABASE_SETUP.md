# 🗄️ Database Setup - Casa Mia

## ✅ Database già configurato su Supabase!

Lo schema è stato creato; gli account si ottengono tramite **registrazione** (`POST /api/auth/register` o schermata **Registrati** del frontend), non tramite utenti demo fissi.

## 📊 Tabelle create:

- **Family** - Gestione nuclei familiari
- **User** - Utenti con autenticazione
- **ShoppingItem** - Lista della spesa
- **PantryItem** - Inventario dispensa
- **Recipe** - Ricette disponibili
- **RecipeView** - Tracking visualizzazioni ricette
- **Deadline** - Scadenze (bollette, abbonamenti, ecc.)
- **NotificationPreference** - Preferenze notifiche scadenze
- **IoTDevice** - Dispositivi smart home
- **IoTEvent** - Log eventi dispositivi IoT

## 🔑 Primo accesso

1. Avvia il backend con `DATABASE_URL` valida e migrazioni applicate.
2. Dal frontend, **Registrati**: viene creata la famiglia e il primo utente (**ADMIN**).
3. Altri membri: `POST /api/auth/add-member` (solo admin autenticato) oppure flusso dedicato in UI se presente.

## 🔧 Come collegare il backend

1. **Ottieni la connection string da Supabase**:
   - Vai su [Supabase Dashboard](https://supabase.com/dashboard)
   - Seleziona il tuo progetto
   - Settings → Database → Connection string
   - Copia la stringa URI: host **`db.<project-ref>.supabase.co`** (porta 5432, utente `postgres`)

2. **Configura il backend**:
   ```bash
   # Nel backend (casa-mia-be)
   cp .env.example .env
   # Modifica .env e inserisci DATABASE_URL con la tua connection string
   ```

3. **Genera Prisma Client**:
   ```bash
   npm run prisma:generate
   ```

4. **Avvia il server**:
   ```bash
   npm start
   ```

## 🧪 Test del database

Puoi testare la connessione:

```bash
npx prisma studio
```

Questo apre un'interfaccia grafica per esplorare e modificare i dati.

## 🚀 Deploy su Railway

Quando deployi su Railway, imposta come variabile d'ambiente:

```
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres
```

Railway eseguirà automaticamente `prisma generate` durante il build.

## ☁️ Deploy su Render + Supabase (errore “Can’t reach database server”)

L’host **`db.<ref>.supabase.co:5432`** spesso è raggiungibile solo via **IPv6**. **Render** (e altri provider IPv4-only) non riesce a connettersi → Prisma segnala *Can’t reach database server*.

**Soluzione:** in Dashboard Supabase → **Project Settings** → **Database** → **Connection string**, scegli **Transaction pooler** (host tipo `aws-0-<region>.pooler.supabase.com`, porta **6543**, utente spesso `postgres.<project-ref>`). Imposta su Render:

```
DATABASE_URL=postgresql://postgres.<PROJECT_REF>:[PASSWORD]@aws-0-<REGION>.pooler.supabase.com:6543/postgres?pgbouncer=true
```

(`<REGION>` deve coincidere con la regione del progetto, es. `eu-central-1`.)

- **Migrazioni** (`prisma migrate deploy`): eseguile da locale (o CI) con la URI **diretta** `db.*:5432` se il pooler non supporta tutti i comandi di migrazione.
- Il build su Render usa solo `prisma generate` (nessuna connessione al DB).

## 📝 Note

- Le password sono hashate con **bcrypt** (10 rounds)
- Gli ID usano **CUID** per sicurezza
- Tutti i timestamps sono in **UTC**
- Le relazioni hanno **CASCADE DELETE** per integrità
- Trigger automatici aggiornano `updatedAt` su ogni modifica
