-- Aggiunge i campi per le pagine pubbliche profilo /chi-siamo/<slug>:
--   - cv_academic: curriculum in formato accademico (struttura libera markdown)
--   - cv_other: testo libero per CV stile "standard" / narrativo
--   - custom_fields: JSON con campi extra liberi (es. [{"label":"PhD","value":"UniGE 2024"}])

ALTER TABLE profiles ADD COLUMN cv_academic TEXT;
ALTER TABLE profiles ADD COLUMN cv_other TEXT;
ALTER TABLE profiles ADD COLUMN custom_fields TEXT;
