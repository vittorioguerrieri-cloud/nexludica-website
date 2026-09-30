-- CRM-lite per NexLudica: tracciamento dei contatti (persone esterne
-- conosciute durante eventi, ricerca, divulgazione, partnership) e dei
-- "touchpoint" (email, telefonata, meeting, ecc.) con loro.
--
-- Modello:
--   contacts                 — una riga per ogni persona/contatto
--   contact_interactions     — log dei touchpoint (cascade su delete del contatto)
--
-- Accesso: tutti i soci possono vedere, aggiungere, editare. Solo admin
-- può eliminare (gestito lato API). `owned_by` è il socio "referente"
-- del contatto, di solito chi l'ha conosciuto per primo.

CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  organization TEXT,                                -- "Università di Genova", "Comune di Milano", ecc.
  role TEXT,                                        -- "Ricercatrice", "Direttore", "Assessora alla cultura"
  email TEXT,
  phone TEXT,
  city TEXT,
  website TEXT,
  linkedin TEXT,
  notes TEXT,                                       -- contesto + commenti liberi
  tags TEXT,                                        -- CSV libero: "partner,scuola,sponsor,giocatore,giornalista,..."
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('lead', 'active', 'cold', 'closed', 'archived')),
  source TEXT,                                      -- "MeetLudica #3", "Lucca Comics 2025", "DM Instagram"
  last_interaction_at INTEGER,                      -- ts ultimo touchpoint (auto-aggiornato)
  follow_up_at INTEGER,                             -- promemoria opzionale (timestamp ms)
  owned_by TEXT,                                    -- user_id del socio referente
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  created_by TEXT,
  FOREIGN KEY (owned_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS contacts_status_idx ON contacts(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS contacts_owned_by_idx ON contacts(owned_by);
CREATE INDEX IF NOT EXISTS contacts_follow_up_idx ON contacts(follow_up_at);
CREATE INDEX IF NOT EXISTS contacts_email_idx ON contacts(email);

CREATE TABLE IF NOT EXISTS contact_interactions (
  id TEXT PRIMARY KEY,
  contact_id TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'other'
    CHECK (kind IN ('email', 'call', 'meeting', 'event', 'social', 'message', 'other')),
  subject TEXT,                                     -- oggetto breve dell'interazione
  notes TEXT,                                       -- dettagli (cosa ci siamo detti, esiti)
  happened_at INTEGER NOT NULL,                     -- ts dell'interazione (ms)
  recorded_by TEXT,                                 -- user_id del socio che registra
  created_at INTEGER NOT NULL,
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
  FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS contact_interactions_contact_idx
  ON contact_interactions(contact_id, happened_at DESC);
