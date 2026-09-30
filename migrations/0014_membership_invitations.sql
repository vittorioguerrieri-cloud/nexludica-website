-- Inviti di iscrizione per nuovi soci.
--
-- Workflow:
--   1) Admin genera un invito → token random salvato qui
--   2) Admin manda il link https://nexludica.org/iscrizione?token=XXX al
--      futuro socio
--   3) Il socio apre il link, compila il form, invia
--   4) L'utente viene creato con membership_status='pending';
--      l'invito viene marcato come used_at + used_by_user_id
--   5) Admin approva (passa lo stato a 'active') dalla pagina socio
--
-- Sicurezza:
--   - Token: 32 byte random esadecimali (64 char), generati lato server
--   - Scadenza: di default 14 giorni, configurabile
--   - Single-use: una volta consumato, il record resta per audit ma non
--     piu' valido
--   - Solo admin possono creare/listare/revocare
--   - Endpoint pubblico /api/iscrizione legge il token solo per validare
--     scadenza e usabilita'

CREATE TABLE IF NOT EXISTS membership_invitations (
  token TEXT PRIMARY KEY,
  created_by TEXT NOT NULL,           -- users.id dell'admin che ha generato
  intended_name TEXT,                 -- hint opzionale: nome destinatario
  intended_email TEXT,                -- hint opzionale: email destinatario
  note TEXT,                          -- nota interna (es. "per Mario, conferenza X")
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  used_by_user_id TEXT,
  revoked_at INTEGER,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (used_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS membership_invitations_expires_idx
  ON membership_invitations(used_at, revoked_at, expires_at);
