-- Serate MeetLudica + assegnazione talk + tracking outreach disponibilita'
-- Una proposta puo' essere assegnata a una serata (event_id nullable).
-- availability_status: ciclo di vita della richiesta di disponibilita' al relatore.
--   'none'      → mai contattato
--   'asked'     → email inviata, in attesa di risposta
--   'confirmed' → relatore ha confermato
--   'declined'  → relatore non disponibile
-- meetludica_outreach: audit trail delle email inviate (subject/body completi).

CREATE TABLE IF NOT EXISTS meetludica_events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  event_date INTEGER NOT NULL,        -- timestamp Unix ms (data+ora inizio)
  location TEXT,                       -- luogo fisico oppure "Online" / link Meet
  notes TEXT,                          -- note interne admin
  created_at INTEGER NOT NULL,
  created_by TEXT,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_meetludica_events_date ON meetludica_events(event_date DESC);

ALTER TABLE meetludica_proposals ADD COLUMN event_id TEXT REFERENCES meetludica_events(id) ON DELETE SET NULL;
ALTER TABLE meetludica_proposals ADD COLUMN availability_status TEXT NOT NULL DEFAULT 'none';
ALTER TABLE meetludica_proposals ADD COLUMN availability_contacted_at INTEGER;
ALTER TABLE meetludica_proposals ADD COLUMN availability_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_meetludica_proposals_event ON meetludica_proposals(event_id);

CREATE TABLE IF NOT EXISTS meetludica_outreach (
  id TEXT PRIMARY KEY,
  proposal_id TEXT NOT NULL,
  event_id TEXT,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  sent_at INTEGER NOT NULL,
  sent_by TEXT,
  FOREIGN KEY (proposal_id) REFERENCES meetludica_proposals(id) ON DELETE CASCADE,
  FOREIGN KEY (event_id) REFERENCES meetludica_events(id) ON DELETE SET NULL,
  FOREIGN KEY (sent_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_meetludica_outreach_proposal ON meetludica_outreach(proposal_id, sent_at DESC);
