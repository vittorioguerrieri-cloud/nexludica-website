-- Premi e riconoscimenti accademici/professionali delle persone iscritte.
-- Stesso pattern di member_publications ma piu' semplice: niente DOI/venue
-- (sono raramente associati a awards), invece issuer + url + description.

CREATE TABLE IF NOT EXISTS member_awards (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,         -- es. "Best Paper Award"
  issuer TEXT,                  -- es. "DRS Learn X Design Conference 2025"
  year INTEGER,
  url TEXT,                     -- link a pagina premio / cerimonia
  description TEXT,             -- testo libero (motivazione, contesto)
  sort_order INTEGER NOT NULL DEFAULT 100,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS member_awards_user_idx
  ON member_awards(user_id, year DESC, sort_order);
