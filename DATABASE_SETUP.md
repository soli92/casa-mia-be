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

## ☁️ Deploy su Render + Supabase

Su **Render** (e altri host **solo IPv4**) la connessione **diretta** `db.<ref>.supabase.co:5432` spesso non risponde → *Can’t reach database server*.

A volte anche **`db.<ref>.supabase.co:6543`** (transaction pooler) **non è raggiungibile** dal data center di Render: in quel caso usa per forza lo **Session pooler** (host `aws-0-*`), pensato proprio per backend persistenti su IPv4 ([docs Supabase](https://supabase.com/docs/guides/database/connecting-to-postgres)).

Supabase espone **due** pooler con **regole fisse** (non mescolare host + utente → **`FATAL: Tenant or user not found`**):

### A) Session pooler — **prima scelta su Render**

- Host: **`aws-0-<region>.pooler.supabase.com`** (es. `eu-west-1` → `aws-0-eu-west-1`)
- Porta: **`5432`**
- Utente: **`postgres.<project-ref>`** (punto + ref, come in dashboard)

```
DATABASE_URL=postgresql://postgres.<PROJECT_REF>:[PASSWORD]@aws-0-<REGION>.pooler.supabase.com:5432/postgres?sslmode=require
```

Prisma va bene in **session mode** (niente `pgbouncer=true`).

### B) Transaction pooler (serverless / se `db.*:6543` risponde)

- Host: **`db.<project-ref>.supabase.co`**
- Porta: **`6543`**
- Utente: **`postgres`** (senza suffisso `.ref`)

```
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.<PROJECT_REF>.supabase.co:6543/postgres?pgbouncer=true&sslmode=require
```

Se vedi *Can’t reach … :6543*, passa alla **A)**.

**Da dove copiare:** dashboard → **Connect** → **Session pool** (Render) oppure **Transaction pool**; aggiungi `sslmode=require` se manca; in transaction aggiungi `pgbouncer=true` per Prisma.

- **Migrazioni** (`prisma migrate deploy`): da locale (o CI) con URI **diretta** `db.*:5432` se serve.
- Il build su Render usa solo `prisma generate` (nessuna connessione al DB).

### Errore `FATAL: Tenant or user not found`

**Host + utente incoerenti**: es. `postgres.<ref>` su `db.*:6543`, oppure solo `postgres` su `aws-0-*.pooler.supabase.com` (senza la porta giusta). Usa la coppia **A** (session) o **B** (transaction) sopra, oppure incolla dal **Connect** senza modifiche manuali.

Controlla anche: **password** con caratteri speciali → percent-encoding nell’URL; progetto **in pausa** su free tier.

## 📝 Note

- Le password sono hashate con **bcrypt** (10 rounds)
- Gli ID usano **CUID** per sicurezza
- Tutti i timestamps sono in **UTC**
- Le relazioni hanno **CASCADE DELETE** per integrità
- Trigger automatici aggiornano `updatedAt` su ogni modifica
