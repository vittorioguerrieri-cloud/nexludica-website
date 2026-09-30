-- Aggiunge il tipo 'evento' (tabella vuota: ricreata col nuovo CHECK).
DROP TABLE IF EXISTS opportunities;
CREATE TABLE opportunities (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('bando','conferenza','evento')),
  title TEXT NOT NULL,
  organization TEXT,
  event_date TEXT,
  end_date TEXT,
  url TEXT,
  location TEXT,
  amount TEXT,
  notes TEXT,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  created_by TEXT,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS opportunities_date_idx ON opportunities(event_date);
