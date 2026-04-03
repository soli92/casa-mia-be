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
- **PushSubscription** - Endpoint Web Push per utente (notifiche scadenze); migrazione `*_push_subscriptions`

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

A volte anche **`db.<ref>.supabase.co:6543`** (transaction pooler) **non è raggiungibile** dal data center di Render: in quel caso usa lo **Session pooler** (hostname tipo `aws-*-*.pooler.supabase.com`), pensato per backend persistenti su IPv4 ([docs Supabase](https://supabase.com/docs/guides/database/connecting-to-postgres)).

Supabase espone **due** pooler con **regole fisse** (non mescolare host + utente → **`FATAL: Tenant or user not found`**):

### A) Session pooler — **prima scelta su Render**

- Host: copialo **per intero** da **Connect → Session pool**: spesso `aws-0-<region>.pooler.supabase.com`, ma alcuni progetti usano **`aws-1-<region>`** (o altro prefisso). **Non indovinare** l’host dagli esempi online.
- Porta: **`5432`** (come nella stringa della dashboard)
- Utente: **`postgres.<project-ref>`** (punto + ref, come nella stringa)

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

- **Migrazioni** (`prisma migrate deploy`): allo **start** del servizio Render (`npm run prisma:migrate && npm run start` in `render.yaml`), con la stessa `DATABASE_URL` del runtime.
- **Baseline (DB già popolato senza `_prisma_migrations`)** — vedi sotto *Errore P3005*.

### Errore `FATAL: Tenant or user not found`

1. **Utente + host della stessa scheda Connect** — Non mischiare utente Session con host Transaction (o il contrario). Incolla **una sola** URI generata da Supabase e correggi solo `pgbouncer=true` / `sslmode` se serve.
2. **Host pooler sbagliato** — Se usi `aws-0-eu-west-1` ma il tuo progetto è su **`aws-1-eu-west-1`** (o altro), il pooler risponde *Tenant or user not found*. Apri **Connect → Session pool** e copia **hostname e porta** esatti.
3. **Password nell’URL** — Caratteri come `@ # % : /` nella password vanno **percent-encodati**; altrimenti l’utente risulta troncato e il pooler non trova il tenant.
4. **Render** — Evita spazi o a capo nella variabile `DATABASE_URL`. Se la password contiene `$`, in alcuni contesti va escapata; in dashboard Render di solito il valore è letterale.
5. **Log di avvio** — Il backend in produzione stampa una riga `🗄️ DB target: host:port (user: …)` con eventuale avviso se utente e host sembrano incoerenti. Per disattivare: `LOG_DATABASE_TARGET=0`.

Controlla anche: progetto **in pausa** su free tier.

## Errore Prisma **P3005** (*database schema is not empty*)

Succede se il database **aveva già le tabelle** (es. creato con `prisma db push`) e **non** ha ancora lo storico in `public._prisma_migrations`: la prima migration non può essere eseguita “da zero” su un DB già popolato.

**Su Render** lo script `npm run prisma:migrate` (`scripts/prisma-migrate-with-baseline.mjs`) prova a risolvere da solo: se esiste la tabella `User` e manca la migration `20260101000000_init_pre_postit` nello storico, esegue `prisma migrate resolve --applied` per init (e, se `PostIt` esiste già, anche per `20260202140000_add_post_it`), poi `prisma migrate deploy`.

Per **disattivare** questo comportamento e usare solo `migrate deploy`: variabile **`PRISMA_SKIP_AUTO_BASELINE=1`** sul servizio Render.

**Baseline manuale** (se preferisci non usare lo script automatico):

```bash
cd casa-mia-be
export DATABASE_URL="postgresql://..."
npx prisma migrate resolve --applied "20260101000000_init_pre_postit"
# Se PostIt esiste già a mano:
npx prisma migrate resolve --applied "20260202140000_add_post_it"
npx prisma migrate deploy
```

**Database nuovo e vuoto:** nessun `resolve` — `migrate deploy` applica tutte le migration in ordine (tra le altre: `init_pre_postit`, `add_post_it`, `family_invite_code`, `family_documents`, `document_folders`, `push_subscriptions` per notifiche push scadenze).

## 📝 Note

- Le password sono hashate con **bcrypt** (10 rounds)
- Gli ID usano **CUID** per sicurezza
- Tutti i timestamps sono in **UTC**
- Le relazioni hanno **CASCADE DELETE** per integrità
- Trigger automatici aggiornano `updatedAt` su ogni modifica
