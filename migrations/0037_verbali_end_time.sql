-- Aggiunge l'orario di fine riunione ai verbali + aggiorna i 4 template
-- di default per includere il placeholder {{meeting_end_time}}.

ALTER TABLE verbali ADD COLUMN meeting_end_time TEXT;

-- Aggiorna i template: sostituisce "La seduta è tolta alle ore _____."
-- con "La seduta è tolta alle ore {{meeting_end_time}}." (con fallback
-- markdown conditional in caso di campo vuoto).
UPDATE verbali_templates
SET body_template = REPLACE(body_template,
  'La seduta è tolta alle ore _____.',
  '{{#meeting_end_time}}La seduta è tolta alle ore {{meeting_end_time}}.{{/meeting_end_time}}{{^meeting_end_time}}La seduta è tolta alle ore _____.{{/meeting_end_time}}'
)
WHERE body_template LIKE '%La seduta è tolta alle ore _____.%';

UPDATE verbali_templates
SET body_template = REPLACE(body_template,
  'La riunione è tolta alle ore _____.',
  '{{#meeting_end_time}}La riunione è tolta alle ore {{meeting_end_time}}.{{/meeting_end_time}}{{^meeting_end_time}}La riunione è tolta alle ore _____.{{/meeting_end_time}}'
)
WHERE body_template LIKE '%La riunione è tolta alle ore _____.%';
