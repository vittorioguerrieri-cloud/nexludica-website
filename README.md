# NexLudica APS — sito istituzionale

Sito ufficiale di [NexLudica APS](https://nexludica.org). Stack:

- **Astro 6** + **Tailwind CSS 4** + **Cloudflare Workers** (adapter SSR)
- **Cloudflare D1** (SQLite) per utenti, profili e articoli MeetLudica
- **Cloudflare R2** per upload PDF dei resoconti
- **Resend** per email transazionali (magic link)

## Pagine

### Pubbliche
- `/` — homepage
- `/chi-siamo` — mission, pilastri, team (legge da D1, fallback statico)
- `/progetti` — Wanderer's Quest, Giochi al Pesto, MeetLudica
- `/meetludica` — calendario auto + archivio resoconti pubblicati
- `/supportaci` — donazione (IBAN)
- `/contattaci` — form e contatti
- `/privacy-policy`, `/cookie-policy` — informative GDPR

### Riservate (login richiesto)
- `/login` — magic link via email
- `/area-soci` — dashboard con metriche e quick links
- `/area-soci/profilo` — gestione profilo pubblico (visibile su Chi siamo)
- `/area-soci/articoli` — i miei resoconti MeetLudica
- `/area-soci/articoli/nuovo` — upload nuovo resoconto (PDF su R2)
- `/area-soci/verbali` — link Drive a documenti dell'associazione

### API
- `POST /api/auth/request-link` — invia magic link
- `GET /api/auth/verify` — consuma token, crea sessione
- `POST/GET /api/auth/logout`
- `GET/PUT /api/me`
- `GET /api/members` — profili pubblici
- `GET/POST /api/articles` (con filtro `?mine=1`)
- `PATCH/DELETE /api/articles/:id`
- `GET /r2/articles/...` — proxy pubblico ai PDF

## Sviluppo

```bash
npm install
cp .dev.vars.example .dev.vars   # imposta secret in dev
npm run dev                      # http://localhost:4321
```

Senza `RESEND_API_KEY`, i magic link vengono loggati in console e
restituiti nel campo `devLink` del response per testare il flow.

## Deploy

Push automatico su `main` → Cloudflare Workers Builds:

```bash
git push origin main
```

Build command: `npm run build`. Deploy command: `npm run deploy`
(esegue `astro build && wrangler deploy`).

## Setup area soci (D1 + R2 + email)

Vedi **[docs/SETUP-AREA-SOCI.md](./docs/SETUP-AREA-SOCI.md)**.

In sintesi (3 comandi):

```bash
npx wrangler d1 create nexludica
npx wrangler r2 bucket create nexludica-articles
npx wrangler d1 execute nexludica --remote --file=migrations/0001_init.sql
npx wrangler d1 execute nexludica --remote --file=migrations/0002_seed_admin.sql
```

Poi scommenta i blocchi `d1_databases` / `r2_buckets` in `wrangler.jsonc`
sostituendo `database_id` con quello uscito dal primo comando.

## Architettura

```
src/
├── env.d.ts              # tipi Env (binding D1/R2/secret)
├── layouts/
│   ├── BaseLayout.astro  # shell pubblico (header/footer)
│   └── AreaSociLayout.astro  # shell area riservata + auth guard
├── components/
│   ├── Header.astro      # logo bicolore + menu sticky
│   └── Footer.astro
├── lib/                  # dati statici/build-time
│   ├── meetludica.ts     # calendario auto-generato
│   └── drive.ts          # categorie verbali Drive
├── server/               # codice solo server (D1/R2/auth)
│   ├── db.ts             # tipi righe + helper UUID/timestamp
│   ├── auth.ts           # magic link, sessioni, cookie
│   ├── email.ts          # Resend + template HTML
│   ├── profiles.ts       # CRUD profili soci
│   ├── articles.ts       # CRUD articoli + upload R2
│   └── guards.ts         # getUser(Astro) tollerante
├── pages/                # routing file-based (Astro)
│   ├── api/              # endpoint REST
│   ├── area-soci/        # dashboard riservata
│   └── *.astro
└── styles/global.css     # design tokens + nx-hero-pattern

migrations/
├── 0001_init.sql         # schema D1 iniziale
└── 0002_seed_admin.sql   # seed 7 soci con Vittorio admin

public/
├── images/branding/      # logo SVG (default + white)
├── images/partners/      # 6 logo partner
└── images/community.png  # collage hero

docs/
└── SETUP-AREA-SOCI.md    # guida completa setup
```

## Branding

- **Palette**: `#05abc4` (cyan), `#286181` (blu), `#1b2528` (dark),
  `#657179` (gray dark), `#b4b4b4` (gray light), `#ffffff`.
- **Font**: Montserrat (300-800).
- **Logo**: due varianti SVG sovrapposte, fade in/out CSS in base allo
  scroll dell'header.
