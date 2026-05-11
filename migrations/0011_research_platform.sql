-- Research Platform: piattaforma generica di questionari psicometrici
-- riusabile per qualsiasi studio futuro.
--
-- Modello a 3 livelli:
--   studies (uno studio di ricerca, es. "Validazione Pesto HR")
--     -> questionnaires (i singoli questionari, es. T1/T2/T3/T4)
--          -> responses (le risposte raccolte)

CREATE TABLE IF NOT EXISTS research_studies (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,           -- es. "pesto-hr-2026", usato negli URL
  title TEXT NOT NULL,
  description TEXT,                     -- markdown / testo per landing
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'closed')),
  -- Visibilità pubblica: 1 = listato su /research, 0 = accessibile solo via link diretto
  public_listing INTEGER NOT NULL DEFAULT 1,
  -- Formula per il codice anonimo cross-timepoint (per ora stringa libera,
  -- in futuro DSL o JS sandboxed). Esempio: "M{birthDay}V{phoneFirst2}"
  anonymous_code_template TEXT,
  -- Lista campi del questionario che producono identita' (CSV nomi field)
  identity_fields TEXT,
  -- Tema SurveyJS opzionale (JSON). Se null usa default NexLudica.
  theme_json TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  created_by TEXT,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS studies_slug_idx ON research_studies(slug);
CREATE INDEX IF NOT EXISTS studies_status_idx ON research_studies(status, public_listing);

CREATE TABLE IF NOT EXISTS research_questionnaires (
  id TEXT PRIMARY KEY,
  study_id TEXT NOT NULL,
  slug TEXT NOT NULL,                   -- es. "t1-pre-game"
  title TEXT NOT NULL,
  description TEXT,
  schema_json TEXT NOT NULL,            -- intero JSON SurveyJS
  position INTEGER NOT NULL DEFAULT 0,  -- ordinamento all'interno dello studio
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'closed')),
  -- Versione: incrementata ogni volta che lo schema viene modificato.
  -- Le risposte memorizzano la version, cosi' si puo' analizzare per coorte.
  version INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (study_id) REFERENCES research_studies(id) ON DELETE CASCADE,
  UNIQUE (study_id, slug)
);
CREATE INDEX IF NOT EXISTS questionnaires_study_idx ON research_questionnaires(study_id, position);

CREATE TABLE IF NOT EXISTS research_responses (
  id TEXT PRIMARY KEY,
  questionnaire_id TEXT NOT NULL,
  study_id TEXT NOT NULL,               -- denormalizzato per query veloci
  schema_version INTEGER NOT NULL DEFAULT 1,
  -- Codice anonimo generato dai identity_fields (consente match cross-timepoint
  -- senza salvare dati anagrafici espliciti).
  anonymous_code TEXT,
  -- Codice di completamento mostrato al partecipante.
  completion_code TEXT NOT NULL,
  payload_json TEXT NOT NULL,           -- risposte complete come JSON
  -- Metadata diagnostico (non identificativi):
  user_agent TEXT,
  ip_hash TEXT,                          -- SHA-256 dell'IP, per anti-spam aggregato
  created_at INTEGER NOT NULL,
  FOREIGN KEY (questionnaire_id) REFERENCES research_questionnaires(id) ON DELETE CASCADE,
  FOREIGN KEY (study_id) REFERENCES research_studies(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS responses_questionnaire_idx ON research_responses(questionnaire_id, created_at);
CREATE INDEX IF NOT EXISTS responses_anon_idx ON research_responses(study_id, anonymous_code);
