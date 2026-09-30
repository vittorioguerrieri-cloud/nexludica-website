-- Proposte di talk MeetLudica + storico broadcast email alla mailing list.

CREATE TABLE IF NOT EXISTS meetludica_proposals (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  talk_title TEXT,          -- titolo proposto
  abstract TEXT NOT NULL,   -- testo del talk proposto
  ip_hash TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'archived')),
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS meetludica_proposals_created_idx
  ON meetludica_proposals(status, created_at DESC);

CREATE INDEX IF NOT EXISTS meetludica_proposals_rate_idx
  ON meetludica_proposals(ip_hash, created_at);

-- Storico dei broadcast inviati dall'admin alla mailing list (audit trail).
CREATE TABLE IF NOT EXISTS meetludica_broadcasts (
  id TEXT PRIMARY KEY,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  sent_count INTEGER NOT NULL DEFAULT 0,
  sent_by TEXT,             -- admin user_id che ha inviato
  sent_at INTEGER NOT NULL,
  FOREIGN KEY (sent_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS meetludica_broadcasts_sent_idx
  ON meetludica_broadcasts(sent_at DESC);
