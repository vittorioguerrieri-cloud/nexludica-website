-- Pubblicazioni accademiche associate alle persone iscritte.
--
-- Una pubblicazione e' per un singolo user_id, ma una persona puo' avere
-- molte pubblicazioni. Il DOI e' univoco PER UTENTE (perche' diversi soci
-- possono essere co-autori di uno stesso paper e quindi entrambi listarlo
-- — la query di display unisce tutto sotto un singolo socio).
--
-- I dati possono essere inseriti manualmente OPPURE auto-popolati via la
-- CrossRef API (https://api.crossref.org/works/<doi>) dall'editor profilo.

CREATE TABLE IF NOT EXISTS member_publications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  authors TEXT,            -- "Cognome N., Cognome2 N., ..." (libero)
  venue TEXT,              -- es. "Journal of Game Studies, Vol. 12 (2024)"
  year INTEGER,            -- anno di pubblicazione (filtrato/ordinato)
  doi TEXT,                -- es. "10.1234/example" (no prefisso https://)
  url TEXT,                -- fallback se non c'e' DOI; opzionale
  abstract TEXT,           -- opzionale
  sort_order INTEGER NOT NULL DEFAULT 100,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS member_publications_user_idx
  ON member_publications(user_id, year DESC, sort_order);

-- UNIQUE PER UTENTE: evita duplicati accidentali quando un socio aggiunge
-- la stessa pubblicazione due volte. Diversi soci possono avere lo stesso DOI.
CREATE UNIQUE INDEX IF NOT EXISTS member_publications_user_doi_unique
  ON member_publications(user_id, doi)
  WHERE doi IS NOT NULL;
