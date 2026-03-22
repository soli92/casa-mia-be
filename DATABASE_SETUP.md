# 🗄️ Database Setup - Casa Mia

## ✅ Database già configurato su Supabase!

Lo schema è stato creato e popolato con dati di esempio.

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

## 🔑 Credenziali di test

Sono stati creati **2 utenti di esempio**:

### Admin:
- **Email**: `mario@rossi.com`
- **Password**: `demo123`
- **Ruolo**: ADMIN

### Member:
- **Email**: `lucia@rossi.com`
- **Password**: `demo123`
- **Ruolo**: MEMBER

Entrambi appartengono alla famiglia "**Famiglia Rossi**".

## 📦 Dati di esempio inclusi:

- ✅ 5 prodotti nella lista della spesa
- ✅ 5 prodotti in dispensa (con scadenze)
- ✅ 2 ricette
- ✅ 4 scadenze (bollette, abbonamenti)
- ✅ 3 dispositivi IoT

## 🔧 Come collegare il backend

1. **Ottieni la connection string da Supabase**:
   - Vai su [Supabase Dashboard](https://supabase.com/dashboard)
   - Seleziona il tuo progetto
   - Settings → Database → Connection string
   - Copia la stringa tipo: `postgresql://postgres:[PASSWORD]@[PROJECT_REF].supabase.co:5432/postgres`

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
DATABASE_URL=postgresql://postgres:[PASSWORD]@[PROJECT_REF].supabase.co:5432/postgres
```

Railway eseguirà automaticamente `prisma generate` durante il build.

## 📝 Note

- Le password sono hashate con **bcrypt** (10 rounds)
- Gli ID usano **CUID** per sicurezza
- Tutti i timestamps sono in **UTC**
- Le relazioni hanno **CASCADE DELETE** per integrità
- Trigger automatici aggiornano `updatedAt` su ogni modifica
