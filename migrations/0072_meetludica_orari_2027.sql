-- Sondaggio sugli orari dei MeetLudica 2027 (dal 2027 gli incontri si tengono
-- in orario lavorativo). Una riga per email: chi risponde di nuovo con la
-- stessa email aggiorna la propria risposta invece di aggiungerne una.
--   slots = JSON array di celle "giorno-fascia", es. ["lun-09","mer-13"]
CREATE TABLE IF NOT EXISTS meetludica_orari_2027 (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  slots TEXT NOT NULL,
  notes TEXT,
  ip_hash TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS meetludica_orari_2027_rate_idx
  ON meetludica_orari_2027(ip_hash, updated_at);
