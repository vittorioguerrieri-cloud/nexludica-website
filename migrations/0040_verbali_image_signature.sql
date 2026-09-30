-- Aggiunge la firma "immagine" (PNG data URL) a verbali_signatures.
-- L'utente può scegliere tra:
--  - typed_signature  → nome digitato (default, già supportato)
--  - image_signature_data → PNG base64 (firma disegnata su canvas o caricata)
--
-- Validità eIDAS SES: la firma resta equivalente a quella digitata; l'immagine
-- è solo una rappresentazione visiva, l'audit trail (IP hash, UA, timestamp,
-- consent) è ciò che conferisce valore legale.

ALTER TABLE verbali_signatures ADD COLUMN image_signature_data TEXT;
ALTER TABLE verbali_signatures ADD COLUMN signature_method TEXT
  CHECK (signature_method IS NULL OR signature_method IN ('typed', 'drawn', 'uploaded'));
