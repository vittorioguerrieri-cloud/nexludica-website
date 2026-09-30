-- Playtest Platform: piattaforma per la raccolta dati durante i playtest
-- dei giochi da tavolo. Vive sul sottodominio playtest.nexludica.org.
--
-- Modello (basato sul template Excel del playtest WarFables_2 — maggio 2026):
--   playtest_games (un gioco / progetto, es. "WarFables", "A Monk-y Business")
--     -> playtest_designer_expectations (3 meccaniche con dinamiche/emozioni attese)
--     -> playtest_sessions (una sessione di playtest, es. "PlayTest_310126_2")
--          -> playtest_players (i partecipanti, identificati per classe/ruolo)
--          -> playtest_phase_times (set-up, tiro iniziale, ecc.)
--          -> playtest_turns (per ogni round × giocatore: durata + punti + evento)
--          -> playtest_checklist_instances (una per fase per osservatore)
--                -> playtest_checklist_responses (score 1-10 + commento per item)
--          -> playtest_observations (sempre sottocchio: griglia live)
--          -> playtest_distractions (counter per tipo di distrazione)
--          -> playtest_omni_comments (4 categorie: Ottimo/Modificare/Non Chiaro/Idee Nuove)
--
--   playtest_checklist_items (template degli item — globale di default,
--     ma override per gioco con game_id NULL = template di sistema)

CREATE TABLE IF NOT EXISTS playtest_games (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,                -- es. "warfables", per URL
  name TEXT NOT NULL,
  short_description TEXT,                    -- 1 riga
  description TEXT,                          -- testo lungo / markdown
  designers TEXT,                            -- CSV o testo libero
  players_min INTEGER,
  players_max INTEGER,
  duration_min_minutes INTEGER,              -- durata stimata da-a
  duration_max_minutes INTEGER,
  min_age INTEGER,
  cover_url TEXT,                            -- opzionale, immagine
  -- Procedura configurabile per ogni gioco. JSON con flags per quali sezioni
  -- abilitare (set-up, inizio, fine, partecipata, omni, scale, ecc.) e
  -- nomi delle 2 colonne punti (default "Punti 1" / "Punti 2"). Esempio:
  --   { "phases": ["set-up","inizio","fine","partecipata"],
  --     "points_label_1": "Punti 1", "points_label_2": "Punti 2",
  --     "track_experience": true,
  --     "modules": ["timer","checklist","omni","observations","scales"] }
  procedure_config TEXT,
  -- Check di accessibilità (one-shot per gioco). JSON con campi:
  --   daltonismo, ipovisione, motricita_fine (ognuno: { score, note })
  accessibility_check TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  created_by TEXT,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS pt_games_slug_idx ON playtest_games(slug);
CREATE INDEX IF NOT EXISTS pt_games_status_idx ON playtest_games(status, updated_at);

-- Expectation form compilato dal game designer prima del playtest:
-- 3 meccaniche, per ognuna: dinamica attesa + emozione attesa.
CREATE TABLE IF NOT EXISTS playtest_designer_expectations (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL,
  mechanic TEXT NOT NULL,
  expected_dynamics TEXT,
  expected_emotions TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (game_id) REFERENCES playtest_games(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS pt_expectations_game_idx ON playtest_designer_expectations(game_id, position);

CREATE TABLE IF NOT EXISTS playtest_sessions (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL,
  label TEXT NOT NULL,                       -- es. "PlayTest 31/01/26 #2"
  played_at TEXT,                            -- ISO date YYYY-MM-DD
  location TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('planned', 'in_progress', 'completed', 'archived')),
  -- Riassunto computato a fine sessione (cache di metriche)
  total_minutes REAL,                        -- somma turni + special phases
  perceived_minutes REAL,                    -- media percepita dai player
  flow_score REAL,                           -- total / perceived
  gradimento_mean REAL,
  gradimento_sd REAL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  created_by TEXT,
  FOREIGN KEY (game_id) REFERENCES playtest_games(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS pt_sessions_game_idx ON playtest_sessions(game_id, played_at);
CREATE INDEX IF NOT EXISTS pt_sessions_status_idx ON playtest_sessions(status);

-- Giocatori partecipanti alla sessione. Sono identificati per ruolo/classe
-- (es. "Barbaro", "Druido") + tag esperienza (Nuovo/Esperto). Il "real_name"
-- e' opzionale e usato solo internamente.
CREATE TABLE IF NOT EXISTS playtest_players (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  display_name TEXT NOT NULL,                -- es. "Barbaro" o "Marco"
  role TEXT,                                  -- es. "Druido" / "Anima" se diverso da display_name
  experience TEXT,                            -- "Nuovo" | "Esperto" | NULL
  real_name TEXT,                             -- opzionale, privato
  notes TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (session_id) REFERENCES playtest_sessions(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS pt_players_session_idx ON playtest_players(session_id, position);

-- Fasi speciali timed (Set-up, Tiro iniziale, Set-up out of game, ecc.)
CREATE TABLE IF NOT EXISTS playtest_phase_times (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  name TEXT NOT NULL,
  minutes REAL NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES playtest_sessions(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS pt_phases_session_idx ON playtest_phase_times(session_id, position);

-- Log dei turni: una riga per turno (round × player).
CREATE TABLE IF NOT EXISTS playtest_turns (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  round INTEGER NOT NULL,
  player_id TEXT,                             -- nullable per turni "ambientali"
  duration_seconds INTEGER NOT NULL,          -- durata in secondi (storage interno)
  points_1 REAL,                              -- nullable
  points_2 REAL,                              -- nullable
  event TEXT,                                  -- evento notevole, es. "Primo sangue"
  recorded_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES playtest_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (player_id) REFERENCES playtest_players(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS pt_turns_session_idx ON playtest_turns(session_id, round);
CREATE INDEX IF NOT EXISTS pt_turns_player_idx ON playtest_turns(player_id);

-- Template degli item della checklist osservativa. game_id NULL = item
-- globale di sistema, validi per tutti i giochi. Se serve override per
-- gioco specifico si inserisce con game_id = X (non implementato in UI
-- nella v1, ma schema pronto).
CREATE TABLE IF NOT EXISTS playtest_checklist_items (
  id TEXT PRIMARY KEY,
  game_id TEXT,                                -- NULL = template di sistema
  category TEXT NOT NULL,                      -- ERGONOMIA FISICA / RITMO / BILANCIAMENTO / ANALISI EMOTIVA / SET-UP
  subcategory TEXT,                            -- Seduta / Area Virtuale / Down-time / ...
  text TEXT NOT NULL,                          -- la domanda
  applies_to TEXT NOT NULL DEFAULT 'observation' CHECK (applies_to IN ('observation', 'setup')),
  -- "observation" → usato in Inizio/Fine/Partecipata
  -- "setup" → usato nella checklist set-up
  position INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (game_id) REFERENCES playtest_games(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS pt_chk_items_idx ON playtest_checklist_items(game_id, applies_to, position);

-- Un'istanza compilata della checklist: per sessione × fase × osservatore.
CREATE TABLE IF NOT EXISTS playtest_checklist_instances (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  phase TEXT NOT NULL CHECK (phase IN ('setup', 'inizio', 'fine', 'partecipata')),
  observer_user_id TEXT,                       -- nullable se osservatore esterno
  observer_name TEXT,                          -- denormalizzato (es. "Vitto")
  notes TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES playtest_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (observer_user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS pt_chk_instances_idx ON playtest_checklist_instances(session_id, phase);

-- Risposta a un singolo item della checklist.
CREATE TABLE IF NOT EXISTS playtest_checklist_responses (
  id TEXT PRIMARY KEY,
  instance_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  score REAL,                                  -- 0-10, nullable se "non rilevato"
  comment TEXT,
  FOREIGN KEY (instance_id) REFERENCES playtest_checklist_instances(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES playtest_checklist_items(id) ON DELETE CASCADE,
  UNIQUE (instance_id, item_id)
);
CREATE INDEX IF NOT EXISTS pt_chk_responses_idx ON playtest_checklist_responses(instance_id);

-- "Sempre sottocchio": annotazioni live a 4 categorie.
CREATE TABLE IF NOT EXISTS playtest_observations (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('variabili_visibili', 'variabili_invisibili', 'equita', 'lamentele')),
  text TEXT NOT NULL,
  recorded_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES playtest_sessions(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS pt_obs_idx ON playtest_observations(session_id, category, recorded_at);

-- Counter delle distrazioni (es. "Controlli al cellulare" → 3).
CREATE TABLE IF NOT EXISTS playtest_distractions (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  type TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (session_id) REFERENCES playtest_sessions(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS pt_distr_idx ON playtest_distractions(session_id);

-- Card OMNI compilate dai giocatori durante il debrief (4 categorie).
CREATE TABLE IF NOT EXISTS playtest_omni_comments (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('ottimo', 'modificare', 'non_chiaro', 'idee_nuove')),
  text TEXT NOT NULL,
  author_name TEXT,                            -- nome giocatore o "observer"
  recorded_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES playtest_sessions(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS pt_omni_idx ON playtest_omni_comments(session_id, category);

-- Seed dei 14 item osservativi (template di sistema, game_id = NULL)
-- nella versione "May 2026" del template (tutti formulati positivi).
INSERT OR IGNORE INTO playtest_checklist_items (id, game_id, category, subcategory, text, applies_to, position) VALUES
  ('pti_obs_01', NULL, 'ERGONOMIA FISICA', 'Seduta',         'Le parti del gioco sono raggiungibili e i giocatori non devono contorcersi?', 'observation', 10),
  ('pti_obs_02', NULL, 'ERGONOMIA FISICA', 'Area Virtuale',  'L''area virtuale è facile da gestire e non invasa?',                          'observation', 20),
  ('pti_obs_03', NULL, 'ERGONOMIA FISICA', 'Leggibilità',    'Tutto è facile da leggere?',                                                   'observation', 30),
  ('pti_obs_04', NULL, 'RITMO',            'Down-time',      'Quanto si osserva il gioco degli altri?',                                      'observation', 40),
  ('pti_obs_05', NULL, 'RITMO',            'Down-time',      'I giocatori parlano delle mosse altrui?',                                      'observation', 50),
  ('pti_obs_06', NULL, 'RITMO',            'Down-time',      'I giocatori sembrano attenti?',                                                'observation', 60),
  ('pti_obs_07', NULL, 'RITMO',            'Paralisi',       'I giocatori riescono a decidere velocemente?',                                 'observation', 70),
  ('pti_obs_08', NULL, 'BILANCIAMENTO',    'Risorse',        'Ci sono pochi momenti di eccesso di risorse?',                                 'observation', 80),
  ('pti_obs_09', NULL, 'BILANCIAMENTO',    'Risorse',        'Ci sono pochi momenti di scarsità?',                                           'observation', 90),
  ('pti_obs_10', NULL, 'BILANCIAMENTO',    'Strategia',      'Le strategie differiscono tra di loro in modo interessante',                   'observation', 100),
  ('pti_obs_11', NULL, 'ANALISI EMOTIVA',  'Positive aff.',  'I Giocatori sembrano di buon umore?',                                          'observation', 110),
  ('pti_obs_12', NULL, 'ANALISI EMOTIVA',  'Positive aff.',  'I giocatori sembrano divertirsi?',                                             'observation', 120),
  ('pti_obs_13', NULL, 'ANALISI EMOTIVA',  'Negative aff.',  'I giocatori NON sembrano frustrati',                                           'observation', 130),
  ('pti_obs_14', NULL, 'ANALISI EMOTIVA',  'Negative aff.',  'I giocatori NON sembrano annoiati',                                            'observation', 140),
  ('pti_obs_15', NULL, 'ANALISI EMOTIVA',  'Interesse',      'I giocatori sono coinvolti durante la partita?',                               'observation', 150),
  ('pti_obs_16', NULL, 'ANALISI EMOTIVA',  'Narrazione',     'I giocatori usano i termini di gioco interni alla narrazione',                 'observation', 160),
  ('pti_obs_17', NULL, 'ANALISI EMOTIVA',  'Narrazione',     'I giocatori NON usano solo i termini strettamente legati alle meccaniche',     'observation', 170),
  -- Set-up checklist (3 item, one-shot per sessione)
  ('pti_set_01', NULL, 'SET-UP',           'Intuitività',    'I pezzi sono intuitivi da riconoscere?',                                       'setup',       10),
  ('pti_set_02', NULL, 'SET-UP',           'Completezza',    'Tutti i componenti sono presenti?',                                            'setup',       20),
  ('pti_set_03', NULL, 'SET-UP',           'Friction points','Ci sono momenti in cui ci si incaglia?',                                       'setup',       30);
