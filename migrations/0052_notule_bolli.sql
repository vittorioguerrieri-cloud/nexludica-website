-- Infrastruttura Notule (ritenuta d'acconto) + pool marche da bollo + IBAN soci.

-- IBAN del socio/percipiente (mancava)
ALTER TABLE member_data ADD COLUMN iban TEXT;

-- Notule di prestazione occasionale (ritenuta d'acconto)
CREATE TABLE IF NOT EXISTS payment_notes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  year INTEGER NOT NULL,
  numero INTEGER NOT NULL,                 -- progressivo annuale globale (fallback/storico)
  numero_personale INTEGER,                -- progressivo per persona (numerazione scelta)
  date TEXT NOT NULL,                      -- YYYY-MM-DD
  service_description TEXT NOT NULL,
  service_period_start TEXT,
  service_period_end TEXT,
  hours REAL,
  project_code TEXT,                       -- progetto/CIG
  amount_gross REAL NOT NULL,
  withholding_percentage REAL NOT NULL DEFAULT 20,
  taxable_percentage REAL NOT NULL DEFAULT 100,
  withholding_amount REAL NOT NULL,
  bollo_required INTEGER NOT NULL DEFAULT 0,
  bollo_amount REAL NOT NULL DEFAULT 0,    -- 2.00 se richiesto (a carico NexLudica)
  amount_net REAL NOT NULL,                -- lordo - ritenuta (bollo NON detratto)
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent_for_signature','signed','paid','void')),
  notes TEXT,
  incarico_id TEXT,                        -- lettera d'incarico collegata (fase 2)
  pdf_drive_id TEXT,
  drive_file_url TEXT,
  signed_pdf_drive_id TEXT,
  sign_token TEXT,                         -- token firma SES
  sent_at INTEGER,
  signed_at INTEGER,
  -- pagamento doppio + riconciliazione col bilancio
  paid_person_at INTEGER,
  paid_person_txn_id TEXT,                 -- finance_transactions.id (netto alla persona)
  f24_paid_at INTEGER,
  f24_txn_id TEXT,                         -- finance_transactions.id (F24 ritenuta)
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS payment_notes_user_idx ON payment_notes(user_id);
CREATE INDEX IF NOT EXISTS payment_notes_year_idx ON payment_notes(year);
CREATE INDEX IF NOT EXISTS payment_notes_status_idx ON payment_notes(status);

-- Pool marche da bollo digitali (immagini scansionate, assegnate atomicamente)
CREATE TABLE IF NOT EXISTS bolli (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  mime TEXT NOT NULL DEFAULT 'image/png',
  image_data BLOB NOT NULL,
  size_bytes INTEGER NOT NULL,
  used_at INTEGER,
  used_for_note_id TEXT,
  notes TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (used_for_note_id) REFERENCES payment_notes(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS bolli_available_idx ON bolli(used_at) WHERE used_at IS NULL;
CREATE INDEX IF NOT EXISTS bolli_note_idx ON bolli(used_for_note_id);
