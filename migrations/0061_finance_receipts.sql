-- Ricevute e fatture allegate ai movimenti bancari. I file stanno su R2 sotto
-- finance-receipts/, prefisso NON servito dalla rotta pubblica /r2: si leggono
-- solo da /api/admin/finance/receipts/<id>, riservato agli amministratori.
CREATE TABLE IF NOT EXISTS finance_receipts (
  id TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL REFERENCES finance_transactions(id) ON DELETE CASCADE,
  r2_key TEXT NOT NULL,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  uploaded_at INTEGER NOT NULL,
  uploaded_by TEXT REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_finance_receipts_txn ON finance_receipts(transaction_id);
