-- Accesso in sola lettura a uno studio per soci che non sono admin (per esempio il
-- committente di una valutazione). Vedono solo gli studi elencati qui, nella pagina
-- research.nexludica.org/<studio>/risposte; il resto della piattaforma resta
-- riservato agli admin. Due livelli:
--   'aggregati': conteggi per classe e verifica dei codici di completamento;
--   'risposte':  anche le singole risposte e il download CSV.
CREATE TABLE IF NOT EXISTS research_study_viewers (
  study_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  access_level TEXT NOT NULL DEFAULT 'aggregati' CHECK (access_level IN ('aggregati', 'risposte')),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (study_id, user_id),
  FOREIGN KEY (study_id) REFERENCES research_studies(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- LUDO LAB: Leonardo Ghisi, committente della valutazione (2/11/2026). Solo aggregati
-- finché non c'è un accordo sui dati (vedi ludolab_handoff/etica/privacy_minori_ricerca.md).
INSERT OR IGNORE INTO research_study_viewers (study_id, user_id, access_level, created_at)
VALUES ('ff07aa9d-b924-5be3-8989-6e5356f357d7', '817871f6-4579-4c80-a4d6-4a24e473c6da', 'aggregati', 1793649600000);
