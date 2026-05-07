-- Sostituisce profiles.linkedin con profiles.instagram.
-- SQLite >= 3.35 supporta DROP COLUMN nativamente.
ALTER TABLE profiles ADD COLUMN instagram TEXT;
-- Migra eventuali valori esistenti (al momento nessuno ha linkedin settato)
UPDATE profiles SET instagram = linkedin WHERE linkedin IS NOT NULL;
ALTER TABLE profiles DROP COLUMN linkedin;
