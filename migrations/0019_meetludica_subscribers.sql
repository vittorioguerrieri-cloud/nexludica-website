-- Iscritti alla mailing list di MeetLudica.
-- Endpoint pubblico /api/meetludica/subscribe (no auth, con honeypot + rate-limit).
-- Quando arriva una nuova iscrizione, mandiamo email a info@nexludica.org.

CREATE TABLE IF NOT EXISTS meetludica_subscribers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  motivation TEXT,           -- testo libero opzionale ("perche' ti interessa")
  ip_hash TEXT,
  created_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS meetludica_subscribers_email_idx
  ON meetludica_subscribers(email);

CREATE INDEX IF NOT EXISTS meetludica_subscribers_rate_idx
  ON meetludica_subscribers(ip_hash, created_at);
