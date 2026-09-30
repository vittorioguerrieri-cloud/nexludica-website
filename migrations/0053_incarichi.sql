-- Lettere d'incarico (prestazione occasionale) con firma SES dedicata.
CREATE TABLE IF NOT EXISTS incarichi (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  project_label TEXT NOT NULL,
  object_description TEXT,
  period_from TEXT NOT NULL,
  period_to TEXT NOT NULL,
  hours REAL,
  hourly_rate REAL,
  compenso_total REAL,
  legal_rep_name TEXT,
  legal_rep_role TEXT DEFAULT 'Presidente',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent_for_signature','signed','void')),
  notes TEXT,
  pdf_drive_id TEXT,
  signed_pdf_drive_id TEXT,
  sign_token TEXT,
  signer_typed TEXT,
  signer_image TEXT,
  signer_method TEXT,
  signer_ip_hash TEXT,
  signer_user_agent TEXT,
  consent_at INTEGER,
  document_hash TEXT,
  sent_at INTEGER,
  signed_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS incarichi_user_idx ON incarichi(user_id);
CREATE INDEX IF NOT EXISTS incarichi_token_idx ON incarichi(sign_token);
