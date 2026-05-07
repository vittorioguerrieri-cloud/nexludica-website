-- Assegna i ruoli associativi ai 7 soci.
UPDATE profiles SET role_label = 'Presidente',     updated_at = unixepoch()*1000 WHERE user_id = '00000000-0000-4000-8000-000000000001'; -- Vittorio
UPDATE profiles SET role_label = 'Segretario',     updated_at = unixepoch()*1000 WHERE user_id = '00000000-0000-4000-8000-000000000002'; -- Raluca
UPDATE profiles SET role_label = 'Tesoriere',      updated_at = unixepoch()*1000 WHERE user_id = '00000000-0000-4000-8000-000000000003'; -- Mattia
UPDATE profiles SET role_label = 'Vice Presidente', updated_at = unixepoch()*1000 WHERE user_id = '00000000-0000-4000-8000-000000000004'; -- Marco
UPDATE profiles SET role_label = 'Socio ordinario', updated_at = unixepoch()*1000 WHERE user_id = '00000000-0000-4000-8000-000000000005'; -- Simone
UPDATE profiles SET role_label = 'Socio ordinario', updated_at = unixepoch()*1000 WHERE user_id = '00000000-0000-4000-8000-000000000006'; -- Camilla
UPDATE profiles SET role_label = 'Socio ordinario', updated_at = unixepoch()*1000 WHERE user_id = '00000000-0000-4000-8000-000000000007'; -- Maria
