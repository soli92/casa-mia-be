# 🚀 GitHub Actions Setup per Auto-Deploy su Render

## Setup Completo

### 1️⃣ Crea il Workflow File

Crea il file `.github/workflows/deploy.yml` nella tua repo con questo contenuto:

```yaml
name: Deploy to Render

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - name: 📥 Checkout code
        uses: actions/checkout@v4

      - name: 🔔 Trigger Render Deploy
        env:
          RENDER_DEPLOY_HOOK: ${{ secrets.RENDER_DEPLOY_HOOK }}
        run: |
          if [ -z "$RENDER_DEPLOY_HOOK" ]; then
            echo "⚠️ RENDER_DEPLOY_HOOK secret not set"
            exit 1
          fi
          
          echo "🚀 Triggering Render deployment..."
          curl -X POST "$RENDER_DEPLOY_HOOK"
          
          echo "✅ Deploy triggered successfully!"
          echo "📊 Check deployment status at: https://dashboard.render.com"

      - name: ✅ Deployment Complete
        run: |
          echo "🎉 Deployment process initiated!"
          echo "⏳ Your app will be live in a few minutes"
```

### 2️⃣ Ottieni il Deploy Hook da Render

1. Vai su [Render Dashboard](https://dashboard.render.com)
2. Seleziona il tuo servizio **casa-mia-be**
3. Vai in **Settings** → **Deploy Hook**
4. Clicca su **Create Deploy Hook**
5. Dai un nome (es. "GitHub Actions")
6. Copia l'URL generato (simile a: `https://api.render.com/deploy/srv-xxxxx?key=xxxxx`)

### 3️⃣ Aggiungi il Secret su GitHub

1. Vai su https://github.com/soli92/casa-mia-be/settings/secrets/actions
2. Clicca su **New repository secret**
3. Nome: `RENDER_DEPLOY_HOOK`
4. Valore: incolla l'URL copiato da Render
5. Clicca su **Add secret**

### 4️⃣ Verifica le Environment Variables su Render

Assicurati che tutte queste variabili siano configurate su Render:

- ✅ `DATABASE_URL` - PostgreSQL; **Supabase su Render**: spesso **Session pool** `aws-0-*.pooler.supabase.com:5432` + utente `postgres.<ref>` — vedi `DATABASE_SETUP.md`
- ✅ `JWT_SECRET` - Secret per JWT access token
- ✅ `JWT_REFRESH_SECRET` - Secret per JWT refresh token
- ✅ `NODE_ENV` - `production`
- ✅ `PORT` - Porta del server (Render usa automaticamente la variabile PORT)
- ✅ `FRONTEND_URL` - URL del frontend (es. `https://casa-mia-fe.vercel.app`)

### 5️⃣ Test del Workflow

Dopo aver completato i passaggi sopra:

1. Fai un commit su `main`:
   ```bash
   git add .
   git commit -m "test: trigger auto-deploy"
   git push origin main
   ```

2. Vai su https://github.com/soli92/casa-mia-be/actions
3. Dovresti vedere il workflow in esecuzione 🎉

### 🎯 Cosa fa il Workflow

- ✅ Si attiva automaticamente ad ogni push su `main`
- ✅ Trigghera il deploy su Render via webhook
- ✅ Render rebuilda e deploya automaticamente l'app
- ✅ Nessun test eseguito (come richiesto)

### 🔧 Troubleshooting

**Errore: "RENDER_DEPLOY_HOOK secret not set"**
- Verifica di aver aggiunto il secret su GitHub con il nome esatto

**Deploy non parte**
- Controlla che l'URL del deploy hook sia corretto
- Verifica che il servizio su Render sia attivo

**Build fallisce su Render**
- Controlla i log su Render Dashboard
- Verifica che tutte le env vars siano configurate

---

📚 **Documentazione ufficiale:**
- [GitHub Actions](https://docs.github.com/en/actions)
- [Render Deploy Hooks](https://render.com/docs/deploy-hooks)
