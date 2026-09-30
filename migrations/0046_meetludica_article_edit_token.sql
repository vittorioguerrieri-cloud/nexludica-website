-- Token segreto per la modifica di un articolo MeetLudica da parte del singolo
-- autore, senza necessita' di account/login (accesso = possesso del link).
-- Backfill dei record esistenti con un token casuale a 128 bit (hex).

ALTER TABLE meetludica_articles ADD COLUMN edit_token TEXT;
UPDATE meetludica_articles SET edit_token = lower(hex(randomblob(16))) WHERE edit_token IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_meetludica_articles_edit_token
  ON meetludica_articles(edit_token);
