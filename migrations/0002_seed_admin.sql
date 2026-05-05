-- Seed iniziale: crea l'utente amministratore (Vittorio).
-- Esegui DOPO 0001_init.sql con:
--   npx wrangler d1 execute nexludica --remote --file=migrations/0002_seed_admin.sql
--
-- Sostituisci l'email se diversa. Lo user_id e' un UUID v4 fisso, cosi'
-- ri-eseguire questo seed e' idempotente (INSERT OR IGNORE).

INSERT OR IGNORE INTO users (id, email, name, role, active, created_at)
VALUES (
  '00000000-0000-4000-8000-000000000001',
  'vittorio.guerrieri@nexludica.org',
  'Vittorio Guerrieri',
  'admin',
  1,
  unixepoch() * 1000
);

INSERT OR IGNORE INTO profiles (
  user_id, display_name, role_label, bio, skills, public_visible, sort_order, updated_at
) VALUES (
  '00000000-0000-4000-8000-000000000001',
  'Vittorio Guerrieri',
  'Presidente',
  'Fondatore di NexLudica APS. Si occupa di psicometria, game design e lavoro sociale.',
  'Psicometria · Game design · Lavoro sociale',
  1,
  10,
  unixepoch() * 1000
);
