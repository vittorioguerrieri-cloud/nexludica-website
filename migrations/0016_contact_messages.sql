-- Log dei messaggi inviati via form di contatto profilo + rate limit.
-- L'endpoint /api/contact-member referenzia questa tabella per:
--   1) Rate limit (COUNT per ip_hash nell'ultima ora)
--   2) Audit log dei messaggi inviati (per moderazione retrospettiva)
--
-- Senza questa migration, l'endpoint avvolge tutto in try/catch silenzioso
-- e il rate limit non funziona di fatto.

CREATE TABLE IF NOT EXISTS contact_messages (
  id TEXT PRIMARY KEY,
  recipient_user_id TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  sender_email TEXT NOT NULL,
  subject TEXT,
  message TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (recipient_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS contact_messages_rate_idx
  ON contact_messages(ip_hash, created_at);

CREATE INDEX IF NOT EXISTS contact_messages_recipient_idx
  ON contact_messages(recipient_user_id, created_at);

-- Tabella per rate-limiting di auth login + magic link request, per ip+kind.
CREATE TABLE IF NOT EXISTS auth_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip_hash TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('login', 'magic-link')),
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS auth_attempts_rate_idx
  ON auth_attempts(ip_hash, kind, created_at);
