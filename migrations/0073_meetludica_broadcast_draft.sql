-- Bozza del broadcast MeetLudica salvata sul server: il compositore in Area soci
-- la ricarica, la salva mentre si scrive e la svuota dopo l'invio.
-- Una sola bozza condivisa fra gli admin (id = 'current').
CREATE TABLE IF NOT EXISTS meetludica_broadcast_draft (
  id TEXT PRIMARY KEY,
  subject TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL,
  updated_by TEXT
);
