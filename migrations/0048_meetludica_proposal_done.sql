-- Flag "fatto" su una proposta di talk: il talk è stato presentato.
--   done_at:    timestamp in cui è stato segnato come fatto (NULL = non fatto)
--   article_id: articolo (privato) collegato, da cui si ricava il link di modifica
-- Segnare "fatto" archivia la proposta e prepara l'email all'autore col link.

ALTER TABLE meetludica_proposals ADD COLUMN done_at INTEGER;
ALTER TABLE meetludica_proposals ADD COLUMN article_id TEXT REFERENCES meetludica_articles(id) ON DELETE SET NULL;
