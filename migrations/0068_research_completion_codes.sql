-- Codici di completamento separati dalle risposte (schema con nx_unlinked_completion_code).
-- Lo studente mostra il codice in classe per dire che ha finito: il codice non deve portare
-- alle sue risposte. Qui non ci sono l'id della risposta né l'ora di invio, e la tabella è
-- WITHOUT ROWID con chiave il codice casuale, così neanche l'ordine di inserimento collega
-- un codice a una risposta. Serve solo a verificare che il codice sia valido.
CREATE TABLE IF NOT EXISTS research_completion_codes (
  code TEXT PRIMARY KEY,
  study_id TEXT NOT NULL,
  questionnaire_id TEXT NOT NULL,
  context TEXT,
  FOREIGN KEY (study_id) REFERENCES research_studies(id) ON DELETE CASCADE,
  FOREIGN KEY (questionnaire_id) REFERENCES research_questionnaires(id) ON DELETE CASCADE
) WITHOUT ROWID;
