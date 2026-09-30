-- Cestino verbali: soft-delete. deleted_at NULL = attivo, valorizzato = nel cestino.
-- L'eliminazione definitiva (con pulizia firme/allegati/Drive) resta possibile dal cestino.
ALTER TABLE verbali ADD COLUMN deleted_at INTEGER;
