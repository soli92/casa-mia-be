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

La **connessione diretta** `db.<ref>.supabase.co:5432` è spesso solo **IPv6** → su **Render** Prisma può dare *Can’t reach database server*.

Supabase espone **due** stringhe pooler diverse (non vanno mescolate host + utente a caso, altrimenti compare **`FATAL: Tenant or user not found`**):

### A) Transaction pooler (consigliato per Prisma da Render)

Formato ufficiale attuale ([docs Supabase](https://supabase.com/docs/guides/database/connecting-to-postgres)):

- Host: **`db.<project-ref>.supabase.co`**
- Porta: **`6543`** (non 5432)
- Utente: **`postgres`** (solo `postgres`, senza suffisso `.ref`)

Esempio (ref e password da sostituire):

```
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.<PROJECT_REF>.supabase.co:6543/postgres?pgbouncer=true
```

Aggiungi sempre **`?pgbouncer=true`** per Prisma (transaction pooler / prepared statements).

### B) Session pooler (IPv4, backend persistente)

- Host: **`aws-0-<region>.pooler.supabase.com`** (es. `eu-west-1` → `aws-0-eu-west-1`)
- Porta: **`5432`**
- Utente: **`postgres.<project-ref>`** (con il punto e il ref)

Esempio:

```
DATABASE_URL=postgresql://postgres.<PROJECT_REF>:[PASSWORD]@aws-0-<REGION>.pooler.supabase.com:5432/postgres
```

Per Prisma di solito resti sulla **A)** con `?pgbouncer=true`.

**Da dove copiare:** dashboard progetto → **Connect** → scegli **Transaction pool** o **Session pool** e incolla l’URI così com’è; in transaction aggiungi `pgbouncer=true` se manca.

- **Migrazioni** (`prisma migrate deploy`): da locale (o CI) con URI **diretta** `db.*:5432` se serve.
- Il build su Render usa solo `prisma generate` (nessuna connessione al DB).

### Errore `FATAL: Tenant or user not found`

Di solito è **host + utente incoerenti** (es. utente `postgres.<ref>` su `db.*:6543`, oppure utente `postgres` su `aws-0-*.pooler.supabase.com:6543`). Usa la coppia **A** o **B** sopra, oppure copia dal pulsante **Connect** senza modificarla a mano.

Controlla anche: **password** con caratteri speciali → percent-encoding nell’URL; progetto **in pausa** su free tier.

## 📝 Note

- Le password sono hashate con **bcrypt** (10 rounds)
- Gli ID usano **CUID** per sicurezza
- Tutti i timestamps sono in **UTC**
- Le relazioni hanno **CASCADE DELETE** per integrità
- Trigger automatici aggiornano `updatedAt` su ogni modifica
