-- Migration iniziale: utenti, sessioni, magic link, profili, articoli MeetLudica.
-- Da eseguire con: npx wrangler d1 execute nexludica --remote --file=migrations/0001_init.sql

PRAGMA foreign_keys = ON;

-- Utenti (soci dell'associazione che possono accedere all'area riservata).
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin')),
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  last_login_at INTEGER
);
CREATE INDEX IF NOT EXISTS users_email_idx ON users(email);

-- Profilo pubblico del socio (mostrato sulla pagina Chi siamo se public_visible = 1).
CREATE TABLE IF NOT EXISTS profiles (
  user_id TEXT PRIMARY KEY,
  display_name TEXT,
  role_label TEXT,           -- es. "Presidente", "Game designer"
  bio TEXT,
  skills TEXT,               -- es. "Psicometria · Game design · Lavoro sociale"
  photo_url TEXT,            -- chiave R2 o URL esterno
  website TEXT,
  linkedin TEXT,
  public_visible INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 100,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS profiles_visible_idx ON profiles(public_visible, sort_order);

-- Magic link per autenticazione passwordless.
-- I token vengono usati una sola volta e scadono dopo 15 minuti.
CREATE TABLE IF NOT EXISTS magic_links (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS magic_links_user_idx ON magic_links(user_id);

-- Sessioni utente attive (cookie httpOnly).
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  user_agent TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_idx ON sessions(expires_at);

-- Articoli/resoconti pubblicati su MeetLudica.
CREATE TABLE IF NOT EXISTS meetludica_articles (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,        -- autore (socio che ha caricato)
  title TEXT NOT NULL,
  speaker TEXT NOT NULL,
  meeting_date TEXT NOT NULL,   -- YYYY-MM-DD
  abstract TEXT NOT NULL,
  tags TEXT,                    -- CSV: "ricerca,design"
  document_key TEXT,            -- chiave R2 del PDF (es. "articles/2026-01-...")
  document_filename TEXT,       -- nome originale del file
  video_url TEXT,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS articles_status_date_idx ON meetludica_articles(status, meeting_date DESC);
CREATE INDEX IF NOT EXISTS articles_user_idx ON meetludica_articles(user_id);
