-- Aggiunge `prolific_completion_url` a research_studies: il completion URL di
-- Prolific (es. https://app.prolific.com/submissions/complete?cc=ABCD1234) a
-- cui rimandare il partecipante a fine questionario. Mostrato solo se la URL
-- di ingresso conteneva i param Prolific (PROLIFIC_PID, ecc.).

ALTER TABLE research_studies ADD COLUMN prolific_completion_url TEXT;

-- Placeholder per TUMI: Vittorio sostituisce con la URL reale di Prolific
-- dopo aver creato lo studio nella dashboard Prolific.
UPDATE research_studies
SET prolific_completion_url = 'https://app.prolific.com/submissions/complete?cc=REPLACE_ME'
WHERE slug = 'tumi-validation';
