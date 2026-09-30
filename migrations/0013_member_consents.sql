-- Aggiunge i campi richiesti dal Codice del Terzo Settore (D.Lgs. 117/2017
-- art. 15, libro associati) e dal GDPR (D.Lgs. 196/2003 + EU 2016/679) che
-- non erano coperti dal precedente schema member_data.
--
-- - citizenship: utile per soci stranieri (libro associati richiede comunque
--   le generalita' complete).
-- - termination_date / termination_reason: data e motivo di recesso o
--   esclusione (art. 15 CTS richiede la trascrizione del recesso).
-- - consent_privacy_at: timestamp accettazione informativa privacy ex art. 13
--   GDPR. Obbligatorio per trattare i dati personali.
-- - consent_statute_at: presa visione dello statuto associativo (lo statuto
--   regola i diritti/doveri del socio, va sempre fornito al momento
--   dell'iscrizione).
-- - consent_photo_publication_at: opt-in per pubblicazione foto profilo sul
--   sito (art. 96-97 L. 633/1941 + GDPR). Richiede consenso esplicito.
-- - consent_marketing_at: opt-in newsletter / comunicazioni promozionali.
--
-- Tutti i campi consent_*_at sono nullable e contengono il timestamp UNIX
-- di accettazione. NULL significa "non ancora prestato".

ALTER TABLE member_data ADD COLUMN citizenship TEXT;
ALTER TABLE member_data ADD COLUMN termination_date TEXT;       -- YYYY-MM-DD
ALTER TABLE member_data ADD COLUMN termination_reason TEXT;
ALTER TABLE member_data ADD COLUMN consent_privacy_at INTEGER;
ALTER TABLE member_data ADD COLUMN consent_statute_at INTEGER;
ALTER TABLE member_data ADD COLUMN consent_photo_publication_at INTEGER;
ALTER TABLE member_data ADD COLUMN consent_marketing_at INTEGER;
