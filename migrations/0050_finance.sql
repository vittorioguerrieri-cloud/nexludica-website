-- Sistema di bilancio NexLudica: transazioni importate dall'export bancario
-- (conto + carta) e progetti/ambiti a cui attribuirle.

CREATE TABLE IF NOT EXISTS finance_projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'progetto' CHECK (kind IN ('progetto','ambito','iniziativa')),
  color TEXT,
  notes TEXT,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS finance_transactions (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL CHECK (source IN ('conto','carta')),
  op_date TEXT NOT NULL,            -- YYYY-MM-DD (data operazione)
  value_date TEXT,                  -- YYYY-MM-DD (data valuta)
  description TEXT,
  counterparty TEXT,
  method TEXT,
  amount_eur REAL NOT NULL,         -- con segno: + entrata, - uscita
  currency TEXT DEFAULT 'EUR',
  mcc TEXT,
  card_alias TEXT,
  project_id TEXT REFERENCES finance_projects(id) ON DELETE SET NULL,
  excluded INTEGER NOT NULL DEFAULT 0,   -- 1 = non conteggiato (es. contabilizzazione carta)
  notes TEXT,
  dedup_key TEXT NOT NULL,
  imported_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_finance_txn_date ON finance_transactions(op_date DESC);
CREATE INDEX IF NOT EXISTS idx_finance_txn_project ON finance_transactions(project_id);
CREATE INDEX IF NOT EXISTS idx_finance_txn_dedup ON finance_transactions(dedup_key);
