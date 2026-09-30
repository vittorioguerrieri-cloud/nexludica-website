-- Sistema missioni/trasferte: tracciamento della spesa per ogni missione
-- (es. fiere, festival, eventi associativi come TOplay o FederLudoCon).
-- Dimensione ORTOGONALE ai progetti: una transazione puo' avere sia un
-- project_id sia un mission_id. Spesa per missione = somma delle transazioni
-- (conto/carta) taggate alla missione.

CREATE TABLE IF NOT EXISTS finance_missions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  opportunity_id TEXT REFERENCES opportunities(id) ON DELETE SET NULL, -- evento collegato dal calendario
  start_date TEXT,                 -- YYYY-MM-DD
  end_date TEXT,                   -- YYYY-MM-DD
  location TEXT,
  budget_eur REAL,                 -- preventivo (nullable)
  status TEXT NOT NULL DEFAULT 'pianificata' CHECK (status IN ('pianificata','conclusa')),
  notes TEXT,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  created_by TEXT
);

ALTER TABLE finance_transactions ADD COLUMN mission_id TEXT REFERENCES finance_missions(id);
ALTER TABLE finance_transactions ADD COLUMN category TEXT;  -- viaggio/vitto/alloggio/iscrizione/materiali/altro

CREATE INDEX IF NOT EXISTS idx_finance_txn_mission ON finance_transactions(mission_id);
