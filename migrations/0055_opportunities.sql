-- Calendario bandi e conferenze (area soci).
CREATE TABLE IF NOT EXISTS opportunities (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('bando','conferenza')),
  title TEXT NOT NULL,
  organization TEXT,              -- ente / organizzatore
  event_date TEXT,               -- YYYY-MM-DD: scadenza (bando) o data (conferenza)
  end_date TEXT,                 -- opzionale (conferenze multi-giorno)
  url TEXT,                      -- link bando / sito conferenza
  location TEXT,                 -- luogo (conferenze)
  amount TEXT,                   -- importo/budget (bandi, testo libero)
  notes TEXT,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  created_by TEXT,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS opportunities_date_idx ON opportunities(event_date);
