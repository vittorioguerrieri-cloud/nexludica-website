-- Estensione playtest platform: scheda gioco completa + file caricati su Drive.
--
-- 1. Aggiungiamo `drive_folder_id` a playtest_games: e' la cartella Drive
--    dedicata al gioco dove vengono salvati i file (regole, dossier di design,
--    asset grafici, ecc.). Settata lazy alla prima upload.
--
-- 2. Nuova tabella playtest_game_files: una riga per ogni file caricato,
--    con i metadati Drive (id, mime, link viewable, dimensione) + classifi-
--    cazione per "kind" (regole / dossier / asset / other).

ALTER TABLE playtest_games ADD COLUMN drive_folder_id TEXT;

CREATE TABLE IF NOT EXISTS playtest_game_files (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL,
  drive_file_id TEXT NOT NULL,                 -- id Drive del file
  name TEXT NOT NULL,                          -- nome del file (es. "Rulebook v1.2.pdf")
  mime_type TEXT,
  size_bytes INTEGER,
  web_view_link TEXT,                          -- link "Apri su Drive"
  kind TEXT NOT NULL DEFAULT 'other' CHECK (kind IN ('rules', 'design_doc', 'asset', 'other')),
  description TEXT,                            -- nota breve (es. "regole v1.2")
  uploaded_at INTEGER NOT NULL,
  uploaded_by TEXT,
  FOREIGN KEY (game_id) REFERENCES playtest_games(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS pt_game_files_game_idx ON playtest_game_files(game_id, uploaded_at DESC);
