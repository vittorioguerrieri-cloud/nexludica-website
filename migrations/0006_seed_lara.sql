-- Aggiunge Lara Cinque come socio ordinario.
INSERT OR IGNORE INTO users (id, email, name, role, active, created_at)
VALUES ('00000000-0000-4000-8000-000000000008', 'lara.cinque@nexludica.invalid', 'Lara Cinque', 'member', 1, unixepoch()*1000);

INSERT OR IGNORE INTO profiles (user_id, display_name, role_label, photo_url, public_visible, email_public, sort_order, updated_at)
VALUES ('00000000-0000-4000-8000-000000000008', 'Lara Cinque', 'Socio ordinario', '/images/team/lara.jpg', 1, 0, 80, unixepoch()*1000);
