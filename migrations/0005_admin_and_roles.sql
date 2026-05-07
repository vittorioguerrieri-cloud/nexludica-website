-- Estensione schema per ruolo collaboratore + dati anagrafici riservati + email opt-in pubblico.
-- Idempotente: usa CREATE TABLE IF NOT EXISTS, ALTER ... IF NOT EXISTS via temp table tricks.

-- 1) Estendi users.role per includere "collaborator".
-- SQLite non supporta ALTER CHECK, quindi non possiamo cambiare il constraint esistente.
-- Soluzione: ricreiamo la tabella users con il nuovo CHECK, copiando i dati.
PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS users_new (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member', 'collaborator')),
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  last_login_at INTEGER
);

INSERT OR IGNORE INTO users_new (id, email, name, role, active, created_at, last_login_at)
SELECT id, email, name, role, active, created_at, last_login_at FROM users;

DROP TABLE users;
ALTER TABLE users_new RENAME TO users;
CREATE INDEX IF NOT EXISTS users_email_idx ON users(email);

PRAGMA foreign_keys = ON;

-- 2) Aggiungi profiles.email_public (default 0 = privato) per opt-in mostra email su chi-siamo.
ALTER TABLE profiles ADD COLUMN email_public INTEGER NOT NULL DEFAULT 0;

-- 3) Tabella member_data: dati anagrafici e amministrativi riservati ai soli admin.
CREATE TABLE IF NOT EXISTS member_data (
  user_id TEXT PRIMARY KEY,

  -- Dati anagrafici
  fiscal_code TEXT,
  birth_date TEXT,           -- YYYY-MM-DD
  birth_place TEXT,
  phone TEXT,

  -- Residenza
  address TEXT,
  city TEXT,
  postal_code TEXT,
  province TEXT,             -- es. "GE"
  country TEXT DEFAULT 'IT',

  -- Iscrizione e contributi
  membership_date TEXT,      -- YYYY-MM-DD data iscrizione
  membership_status TEXT NOT NULL DEFAULT 'active' CHECK (membership_status IN ('active', 'pending', 'suspended', 'former')),
  last_payment_date TEXT,    -- YYYY-MM-DD ultima quota
  last_payment_amount REAL,  -- importo in euro
  payment_notes TEXT,

  -- Note interne admin
  internal_notes TEXT,

  -- Audit
  updated_at INTEGER NOT NULL,
  updated_by TEXT,           -- user_id dell'admin che ha modificato

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS member_data_status_idx ON member_data(membership_status);
