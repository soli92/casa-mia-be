---

# AI Log — casa-mia-be

Memoria di sviluppo AI-assisted. Annotazioni sui prompt, decisioni e pattern emersi costruendo questo progetto con il supporto di AI.

## Overview del progetto

Backend **Express** (ESM) per **Casa Mia**: autenticazione JWT, famiglie, dispensa, ricette, shopping, IoT, scadenze, lavagna post-it, documenti su S3, **Web Push** per notifiche. Persistenza **Prisma** + Postgres (spesso Supabase/Render nel flusso deploy).

**Stack AI usato (inferito)**: Cursor / agenti esterni — **evidenza diretta parziale**: merge `e7af317 Merge pull request #1 from soli92/cursor/current-issues-346f` (branch nominato `cursor/...`). Resto inferenza da messaggi molto descrittivi e batch di fix CI.

**Periodo di sviluppo**: 2026-03-22 (`98a17a3` Initial commit) → 2026-04-03 (`3dc0c72` feat push Web).

**Numero di commit**: 59

---

## Fasi di sviluppo (inferite dal history)

### Fase 1 — Monolite Express + Prisma e moduli dominio

**Timeframe**: `98a17a3` → circa `fabd46a` (WebSocket) / `db3456f` README.

**Cosa è stato fatto**: schema Prisma esteso, route auth/shopping/recipes/pantry/IoT, middleware JWT, README e `.env.example`, tentativi deploy Docker/Railway/Render (`a060ec5`, `2ddbcb0`, `e88f85e`).

**Evidenza di AI-assist** (inferita):

- Catena di commit “Add X routes” in rapida successione (tipico scaffolding o copilot).

**Decisioni architetturali notevoli**:

- **Express** come server unico con WebSocket.
- **Prisma** come ORM; uso di `type: "module"` dopo iterazioni (`83082ae`, `5c04cdb`).

**Prompt chiave usati**: > [TODO da compilare manualmente]

**Lezioni apprese**: > [TODO da compilare manualmente]

### Fase 2 — CI/CD GitHub Actions e stabilizzazione deploy

**Timeframe**: `b2eafcb` / `a8d3fe2` workflow → `9516eba` test con secrets.

**Cosa è stato fatto**: introduzione workflow YAML (anche commit di fix sintassi `8e2ef96`), bump versione `8959f16`, semplificazioni pipeline `a9e007b`.

**Evidenza di AI-assist** (inferita):

- Emoji e messaggi promozionali (“Test GitHub Actions”) possono essere umani o assistiti; non prova di per sé.

**Decisioni architetturali notevoli**:

- CI su GitHub Actions come gate prima del deploy.

**Prompt chiave usati**: > [TODO da compilare manualmente]

**Lezioni apprese**: > [TODO da compilare manualmente]

### Fase 3 — Refactor sicurezza JWT, CRUD deadlines, merge Cursor

**Timeframe**: `fd876ff`–`7941c5c` refactor JWT/deadlines → `e7af317` merge PR `cursor/current-issues-346f` → `2b3a36e` fix allineamento schema/auth/IoT.

**Cosa è stato fatto**: consolidamento segreti JWT, route deadlines, fix post-merge su ordering e webhook.

**Evidenza di AI-assist** (inferita):

- **Nome branch `cursor/...`** nel merge: forte indicazione di lavoro tramite **Cursor** (Cloud o IDE).

**Decisioni architetturali notevoli**:

- **App factory** e `GET /auth/me` (`b5f2019`) per testabilità e boundary auth.

**Prompt chiave usati**: > [TODO da compilare manualmente]

**Lezioni apprese**: > [TODO da compilare manualmente]

### Fase 4 — Pooler Supabase/Render, Prisma migrate deploy, documenti e Push

**Timeframe**: `76abb1f`–`9484e24` documentazione DB → `3dc0c72` Web Push digest.

**Cosa è stato fatto**: documentazione connection string / pooler, `prisma migrate deploy` su Render (`9c9ccf0`, `63edce9`, `cbb6d6e`), feature documenti S3 presigned, **Web Push** con test.

**Evidenza di AI-assist** (inferita):

- Commit documentazione molto operativa (Render/Supabase) spesso prodotto in pair con AI o runbook interni.

**Decisioni architetturali notevoli**:

- Baseline migration e script `prisma-migrate-with-baseline` per DB legacy (`63edce9`, `cbb6d6e`).

**Prompt chiave usati**: > [TODO da compilare manualmente]

**Lezioni apprese**: > [TODO da compilare manualmente]

---

## Pattern ricorrenti identificati

- **Messaggi convenzionali** misti a commit “Add/Refactor/Fix” in inglese e italiano.
- **Coppia feature + docs + test** nelle fasi recenti (`0bdf707`, `3dc0c72`).
- **Iterazione deploy**: molti commit su Render/Procfile/build fino a configurazione stabile.
- **Vitest** come runner di test (`b5f2019` e seguenti).

---

## Tecnologie e scelte di stack

- **Framework**: Node.js, Express (ESM)
- **ORM / DB**: Prisma, Postgres (documentazione per Supabase pooler)
- **Storage**: AWS SDK S3 + presigned URL
- **Auth**: JWT, bcrypt, inviti famiglia
- **Deploy**: Render (blueprint/yaml), storico Railway/Docker
- **LLM integration**: nessuna nel runtime applicativo

## Problemi tecnici risolti (inferiti)

1. **Compatibilità ESM vs `require`**: `83082ae`, `5c04cdb`, `cb18f32`.
2. **Deploy Prisma su Render**: `de4b519`, `9c9ccf0`, fix P3005 / baseline `63edce9`.
3. **Pooler / reachability DB**: `76abb1f`, `62e9d99`, `9484e24`.
4. **CORS multi-origine e registrazione**: `e97fe95`.
5. **Allineamento schema deadlines post-merge**: `2b3a36e`.

---

## Appendice — Commit notevoli (estratto da `git log --oneline`)

- `3dc0c72` feat(push): Web Push per scadenze, digest giornaliero, test e doc
- `0bdf707` feat(documents): cartelle, URL GET presigned, test e documentazione
- `4c430c9` feat(documents): FamilyDocument + S3 presign upload e URL CDN
- `f44931c` fix(auth): codice invito famiglia + POST /join (scope condiviso)
- `9623d3b` feat(auth): GET /api/auth/members for family roster
- `cbb6d6e` fix(prisma): auto-baseline legacy DB before migrate deploy on Render
- `002d033` feat(board): post-it lavagna, migrazione PostIt, doc API/WebSocket
- `76abb1f` fix(deploy): Supabase pooler su Render, rimuove secret da render.yaml
- `e97fe95` fix(auth): registrazione più robusta, CORS multi-origine
- `b5f2019` feat: app factory, GET /auth/me, JWT lazy env, test Vitest
- `e7af317` Merge pull request #1 from soli92/cursor/current-issues-346f
- `2b3a36e` fix: deadlines schema alignment, auth and IoT webhook, route ordering
- `2baba27` ci: add GitHub Actions CI/CD workflow
- `6659808` Refactor route and middleware imports in index.js
- `7941c5c` feat: aggiungi route deadlines completa con CRUD e statistiche
- `83082ae` fix: converti index.js a ES modules syntax
- `fabd46a` Add main Express server with WebSocket
- `db3456f` Add comprehensive README
- `98a17a3` Initial commit

---

## Punti aperti / note per il futuro

> [TODO da compilare manualmente: roadmap notifiche, limiti quota push, ambienti staging]

---

> **Nota metodologica**: questo file è stato generato retroattivamente analizzando la history del repo. Le sezioni con `> [TODO da compilare manualmente]` richiedono la memoria del developer e non possono essere inferite dalla sola analisi automatica. Integra progressivamente con annotazioni manuali mentre lavori alle prossime fasi del progetto.

---
