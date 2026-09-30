-- Sistema di firma elettronica semplice (SES) proprietario NexLudica.
-- Sostituisce SignWell con una soluzione interna che genera link unici
-- per ogni firmatario, raccoglie firma tipizzata + consenso, mantiene
-- audit trail completo, e rigenera il PDF con le firme embedded.
--
-- Conformità: SES ai sensi del Regolamento eIDAS 910/2014 (art. 25).
-- Sufficiente per atti privati di un'APS (verbali interni). Non è AdES/QES.

CREATE TABLE IF NOT EXISTS verbali_signatures (
  id TEXT PRIMARY KEY,
  verbale_id TEXT NOT NULL,

  -- Identità firmatario (snapshot al momento della richiesta)
  signer_name TEXT NOT NULL,
  signer_email TEXT NOT NULL,
  signer_order INTEGER NOT NULL DEFAULT 0,        -- ordine nel verbale.signers

  -- Token segreto per il link di firma (UUID v4, 128 bit di entropia)
  token TEXT NOT NULL UNIQUE,
  -- Hash del PDF al momento dell'invio (integrità del documento)
  document_hash TEXT,                              -- SHA-256 hex del PDF non firmato

  -- Stato
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'viewed', 'signed', 'declined', 'expired', 'revoked')),

  -- Timestamps audit
  sent_at INTEGER NOT NULL,
  viewed_at INTEGER,                               -- primo accesso al link
  signed_at INTEGER,
  declined_at INTEGER,
  expires_at INTEGER NOT NULL,                     -- 30 giorni default

  -- Dati firma (compilati al signed_at)
  typed_signature TEXT,                            -- nome digitato dal firmatario
  consent_text TEXT,                               -- testo del consenso accettato (snapshot)
  consent_given_at INTEGER,

  -- Audit forensico
  signer_ip_hash TEXT,                             -- SHA-256 dell'IP (no IP raw per GDPR)
  signer_user_agent TEXT,
  signer_locale TEXT,                              -- Accept-Language

  -- Decline reason (se status = declined)
  decline_reason TEXT,

  -- Note interne admin
  notes TEXT,

  FOREIGN KEY (verbale_id) REFERENCES verbali(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS verbali_signatures_verbale_idx ON verbali_signatures(verbale_id, signer_order);
CREATE INDEX IF NOT EXISTS verbali_signatures_token_idx ON verbali_signatures(token);
CREATE INDEX IF NOT EXISTS verbali_signatures_status_idx ON verbali_signatures(status, expires_at);
