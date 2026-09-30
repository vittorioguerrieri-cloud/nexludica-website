-- Campi firma SES per le notule (signed_pdf_drive_id già presente da 0052).
ALTER TABLE payment_notes ADD COLUMN signer_typed TEXT;
ALTER TABLE payment_notes ADD COLUMN signer_image TEXT;
ALTER TABLE payment_notes ADD COLUMN signer_method TEXT;
ALTER TABLE payment_notes ADD COLUMN signer_ip_hash TEXT;
ALTER TABLE payment_notes ADD COLUMN signer_user_agent TEXT;
ALTER TABLE payment_notes ADD COLUMN consent_at INTEGER;
ALTER TABLE payment_notes ADD COLUMN document_hash TEXT;
