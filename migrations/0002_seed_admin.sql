-- Seed iniziale: crea utente admin (Vittorio) + i 6 membri attuali
-- con email placeholder. Quando un socio sara' pronto ad attivarsi,
-- aggiorna la sua email con un UPDATE come ad esempio:
--   UPDATE users SET email = 'raluca.fulgu@example.com' WHERE id = '...';
--
-- Esegui DOPO 0001_init.sql con:
--   npx wrangler d1 execute nexludica --remote --file=migrations/0002_seed_admin.sql
--
-- INSERT OR IGNORE: idempotente (puoi rieseguire senza creare duplicati).

-- Vittorio (presidente, admin, email reale)
INSERT OR IGNORE INTO users (id, email, name, role, active, created_at)
VALUES (
  '00000000-0000-4000-8000-000000000001',
  'vittorio.guerrieri@nexludica.org',
  'Vittorio Guerrieri',
  'admin', 1, unixepoch() * 1000
);
INSERT OR IGNORE INTO profiles (user_id, display_name, role_label, skills, public_visible, sort_order, updated_at)
VALUES (
  '00000000-0000-4000-8000-000000000001',
  'Vittorio Guerrieri', 'Presidente',
  'Psicometria · Game design · Lavoro sociale',
  1, 10, unixepoch() * 1000
);

-- Raluca Fulgu
INSERT OR IGNORE INTO users (id, email, name, role, active, created_at)
VALUES (
  '00000000-0000-4000-8000-000000000002',
  'raluca.fulgu@nexludica.invalid', 'Raluca Fulgu',
  'member', 1, unixepoch() * 1000
);
INSERT OR IGNORE INTO profiles (user_id, display_name, skills, public_visible, sort_order, updated_at)
VALUES (
  '00000000-0000-4000-8000-000000000002',
  'Raluca Fulgu',
  'Psicologia sociale · Ricerca · Inclusione',
  1, 20, unixepoch() * 1000
);

-- Mattia Drago
INSERT OR IGNORE INTO users (id, email, name, role, active, created_at)
VALUES (
  '00000000-0000-4000-8000-000000000003',
  'mattia.drago@nexludica.invalid', 'Mattia Drago',
  'member', 1, unixepoch() * 1000
);
INSERT OR IGNORE INTO profiles (user_id, display_name, skills, public_visible, sort_order, updated_at)
VALUES (
  '00000000-0000-4000-8000-000000000003',
  'Mattia Drago',
  'Gioco da tavolo · Imprenditoria · Fitness',
  1, 30, unixepoch() * 1000
);

-- Marco Monteverde
INSERT OR IGNORE INTO users (id, email, name, role, active, created_at)
VALUES (
  '00000000-0000-4000-8000-000000000004',
  'marco.monteverde@nexludica.invalid', 'Marco Monteverde',
  'member', 1, unixepoch() * 1000
);
INSERT OR IGNORE INTO profiles (user_id, display_name, skills, public_visible, sort_order, updated_at)
VALUES (
  '00000000-0000-4000-8000-000000000004',
  'Marco Monteverde',
  'Game design · Informatica · Comunicazione',
  1, 40, unixepoch() * 1000
);

-- Simone Glogowschek
INSERT OR IGNORE INTO users (id, email, name, role, active, created_at)
VALUES (
  '00000000-0000-4000-8000-000000000005',
  'simone.glogowschek@nexludica.invalid', 'Simone Glogowschek',
  'member', 1, unixepoch() * 1000
);
INSERT OR IGNORE INTO profiles (user_id, display_name, skills, public_visible, sort_order, updated_at)
VALUES (
  '00000000-0000-4000-8000-000000000005',
  'Simone Glogowschek',
  'Game design · Matematica · Insegnamento',
  1, 50, unixepoch() * 1000
);

-- Camilla Fadda
INSERT OR IGNORE INTO users (id, email, name, role, active, created_at)
VALUES (
  '00000000-0000-4000-8000-000000000006',
  'camilla.fadda@nexludica.invalid', 'Camilla Fadda',
  'member', 1, unixepoch() * 1000
);
INSERT OR IGNORE INTO profiles (user_id, display_name, skills, public_visible, sort_order, updated_at)
VALUES (
  '00000000-0000-4000-8000-000000000006',
  'Camilla Fadda',
  'Concept art · Social · Storytelling',
  1, 60, unixepoch() * 1000
);

-- Maria Pulinas
INSERT OR IGNORE INTO users (id, email, name, role, active, created_at)
VALUES (
  '00000000-0000-4000-8000-000000000007',
  'maria.pulinas@nexludica.invalid', 'Maria Pulinas',
  'member', 1, unixepoch() * 1000
);
INSERT OR IGNORE INTO profiles (user_id, display_name, skills, public_visible, sort_order, updated_at)
VALUES (
  '00000000-0000-4000-8000-000000000007',
  'Maria Pulinas',
  'Impegno sociale · Carcere · Linguistica',
  1, 70, unixepoch() * 1000
);
