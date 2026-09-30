-- Playtest: supporto modalità "a squadre" vs "individuale".
--
-- 1. Aggiungiamo `team_index` (0 o 1, NULL = senza team) a playtest_players.
--    Usato solo quando procedure_config.is_team_game = true.
-- 2. Aggiorniamo procedure_config dei due giochi storici:
--    - WarFables = team game (Divini vs Profani, come da template Excel storico)
--    - A Monk-y Business = individuale
-- 3. Patch retroattivo: assegniamo team_index ai player WarFables storici
--    (lo lascio NULL — sarà l'utente a definire le squadre da UI).

ALTER TABLE playtest_players ADD COLUMN team_index INTEGER;

-- WarFables: team game con nomi "Divini" / "Profani"
UPDATE playtest_games
SET procedure_config = json_set(
      COALESCE(procedure_config, '{}'),
      '$.is_team_game', json('true'),
      '$.teams', json('[{"name":"Divini"},{"name":"Profani"}]')
    )
WHERE slug = 'warfables';

-- A Monk-y Business: individuale (punti per giocatore)
UPDATE playtest_games
SET procedure_config = json_set(
      COALESCE(procedure_config, '{}'),
      '$.is_team_game', json('false')
    )
WHERE slug = 'a-monk-y-business';
