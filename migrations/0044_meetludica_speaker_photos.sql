-- Foto dei relatori MeetLudica caricate via admin UI.
-- Vengono salvate su Drive (cartella "MeetLudica/Foto speaker") e poi servite
-- pubblicamente tramite proxy del Worker su /api/meetludica/speaker-photo/:id
-- (cosi' l'URL nell'email e' sul dominio nexludica.org e non passa da Drive).

CREATE TABLE IF NOT EXISTS meetludica_speaker_photos (
  id TEXT PRIMARY KEY,
  drive_file_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  uploaded_at INTEGER NOT NULL,
  uploaded_by TEXT,
  FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_meetludica_speaker_photos_uploaded
  ON meetludica_speaker_photos(uploaded_at DESC);
