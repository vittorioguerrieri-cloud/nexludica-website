-- Aggiunge `board_role` a users per identificare i membri del Consiglio
-- Direttivo (usato per l'auto-fill di presenti/assenti nei verbali).
--
-- Valori previsti:
--   'presidente', 'vice_presidente', 'segretario', 'tesoriere', 'consigliere'
--   NULL = non in direttivo (socio regolare)
--
-- Logica auto-fill verbali:
--   assemblea_ordinaria   → tutti i soci attivi
--   assemblea_straordinaria → tutti i soci attivi
--   consiglio_direttivo   → solo soci con board_role IS NOT NULL
--   riunione_operativa    → nessun auto-fill (manuale)

ALTER TABLE users ADD COLUMN board_role TEXT
  CHECK (board_role IS NULL OR board_role IN (
    'presidente', 'vice_presidente', 'segretario', 'tesoriere', 'consigliere'
  ));

CREATE INDEX IF NOT EXISTS users_board_role_idx ON users(board_role) WHERE board_role IS NOT NULL;
