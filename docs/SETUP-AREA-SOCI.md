# Setup Area Soci — checklist

Questa guida porta da "build OK ma area soci ferma" a "soci possono fare login,
caricare resoconti MeetLudica, gestire il profilo".

## Prerequisiti

- Account Cloudflare con il piano Workers (free OK).
- `wrangler` installato e loggato: `npx wrangler login`.
- Repo NexLudica clonato in locale.

## 1. Crea il database D1

```bash
npx wrangler d1 create nexludica
```

L'output contiene un `database_id`. **Copialo** e poi modifica `wrangler.jsonc`:

1. **Scommenta** i blocchi `d1_databases` e `r2_buckets` (rimuovi le `//` davanti).
2. Sostituisci `database_id` con il valore copiato dall'output.

Esempio risultato:

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "nexludica",
    "database_id": "abcd1234-..."
  }
],
"r2_buckets": [
  {
    "binding": "STORAGE",
    "bucket_name": "nexludica-articles"
  }
],
```

## 2. Crea il bucket R2

```bash
npx wrangler r2 bucket create nexludica-articles
```

Il nome deve combaciare con `bucket_name` in `wrangler.jsonc` (`nexludica-articles`).

## 3. Applica lo schema D1

```bash
# Schema iniziale (tabelle)
npx wrangler d1 execute nexludica --remote --file=migrations/0001_init.sql

# Seed: crea utente admin Vittorio (email vittorio.guerrieri@nexludica.org).
# Modifica l'email in 0002_seed_admin.sql se diversa, prima di eseguire.
npx wrangler d1 execute nexludica --remote --file=migrations/0002_seed_admin.sql
```

Aggiungi nuovi soci con un INSERT manuale per ora (oppure UI admin in futuro):

```bash
npx wrangler d1 execute nexludica --remote --command \
  "INSERT INTO users (id, email, name, role, active, created_at) VALUES ('$(uuidgen)', 'altro.socio@nexludica.org', 'Altro Socio', 'member', 1, unixepoch()*1000)"
```

## 4. Imposta i secret in produzione

### Resend (per le email di magic link)

1. Crea account su [resend.com](https://resend.com).
2. Verifica il dominio `nexludica.org`: aggiungi i record DNS richiesti (SPF, DKIM)
   nel pannello Cloudflare DNS.
3. Genera una API key e salvala come secret:

```bash
npx wrangler secret put RESEND_API_KEY
# incolla la chiave quando richiesto
```

### Session secret

```bash
# Genera una chiave sicura
openssl rand -base64 32

# Salvala come secret
npx wrangler secret put SESSION_SECRET
```

## 5. Sviluppo locale

Crea un file `.dev.vars` (non committato) copiando da `.dev.vars.example`:

```env
RESEND_API_KEY=
SESSION_SECRET=dev-only-change-me
```

Se `RESEND_API_KEY` è vuoto, il magic link viene loggato in console e ritornato
nel response del form di login (campo `devLink`) per testare in locale.

Per simulare D1/R2 in locale:

```bash
# Applica lo schema sul DB locale (non --remote)
npx wrangler d1 execute nexludica --local --file=migrations/0001_init.sql
npx wrangler d1 execute nexludica --local --file=migrations/0002_seed_admin.sql

# Avvia dev
npm run dev
```

## 6. Deploy

Il deploy avviene automaticamente al push su `main` tramite Cloudflare Workers
Builds (vedi `package.json` script `deploy = astro build && wrangler deploy`).

## Operatività

### Aggiungere un socio

```bash
# 1. Inserisci utente in D1
npx wrangler d1 execute nexludica --remote --command \
  "INSERT INTO users (id, email, name, role, active, created_at) VALUES (lower(hex(randomblob(16))), 'nome@dominio.it', 'Nome Cognome', 'member', 1, unixepoch()*1000)"

# 2. Comunica al socio l'email registrata.
# Andrà su /login, inserisce l'email, riceve il magic link.
# Al primo accesso completa il profilo da /area-soci/profilo.
```

### Disattivare un socio

```bash
npx wrangler d1 execute nexludica --remote --command \
  "UPDATE users SET active = 0 WHERE email = 'nome@dominio.it'"
```

### Vedere i logs delle invocazioni

```bash
npx wrangler tail nexludica
```

## Troubleshooting

| Problema | Soluzione |
|---|---|
| 503 "backend non configurato" sul login | `database_id` non sostituito in `wrangler.jsonc`, oppure D1 non creato |
| Magic link non arriva | Verifica DNS Resend (SPF/DKIM); guarda `wrangler tail` per errori; usa `devLink` in dev |
| 404 sul download PDF | Verifica che il bucket R2 esista e che il file sia stato caricato (`wrangler r2 object list nexludica-articles`) |
| "unauthorized" sui form | Cookie di sessione scaduto: rifai login |
