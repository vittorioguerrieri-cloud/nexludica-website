-- Aggiunge le photo_url ai 7 profili esistenti.
UPDATE profiles SET photo_url = '/images/team/vittorio.jpg', updated_at = unixepoch()*1000 WHERE user_id = '00000000-0000-4000-8000-000000000001';
UPDATE profiles SET photo_url = '/images/team/raluca.jpg', updated_at = unixepoch()*1000 WHERE user_id = '00000000-0000-4000-8000-000000000002';
UPDATE profiles SET photo_url = '/images/team/mattia.jpg', updated_at = unixepoch()*1000 WHERE user_id = '00000000-0000-4000-8000-000000000003';
UPDATE profiles SET photo_url = '/images/team/marco.jpg', updated_at = unixepoch()*1000 WHERE user_id = '00000000-0000-4000-8000-000000000004';
UPDATE profiles SET photo_url = '/images/team/simone.jpg', updated_at = unixepoch()*1000 WHERE user_id = '00000000-0000-4000-8000-000000000005';
UPDATE profiles SET photo_url = '/images/team/camilla.jpg', updated_at = unixepoch()*1000 WHERE user_id = '00000000-0000-4000-8000-000000000006';
UPDATE profiles SET photo_url = '/images/team/maria.jpg', updated_at = unixepoch()*1000 WHERE user_id = '00000000-0000-4000-8000-000000000007';
