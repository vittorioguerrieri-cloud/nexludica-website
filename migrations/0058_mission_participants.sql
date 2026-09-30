-- Partecipanti a una missione: relazione molti-a-molti tra missioni e soci (users).
-- Serve a sapere chi partecipa a ciascuna trasferta/evento.

CREATE TABLE IF NOT EXISTS mission_participants (
  mission_id TEXT NOT NULL REFERENCES finance_missions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  note TEXT,                       -- opzionale: es. "relatore", "autista"
  added_at INTEGER NOT NULL,
  PRIMARY KEY (mission_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_mission_participants_mission ON mission_participants(mission_id);
