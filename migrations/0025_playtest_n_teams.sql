-- Playtest: supporto N squadre (non solo 2) con numero variabile di giocatori.
--
-- 1. Aggiungiamo `team_points_json` a playtest_turns: array JSON [v0, v1, ...]
--    con i punti delta per ogni squadra in quel turno. Quando un gioco ha
--    N=2 squadre, lasciamo che il legacy code legga ancora points_1/points_2,
--    ma il nuovo codice scrive sempre anche team_points_json per consistenza.
-- 2. Allarghiamo la struttura del player: team_index può ora essere 0..N-1
--    (era 0/1). Niente migration di schema necessaria (è già INTEGER).
-- 3. Aggiorniamo procedure_config di WarFables per dichiarare esplicitamente
--    le 2 squadre come array (era già così dalla migration precedente).

ALTER TABLE playtest_turns ADD COLUMN team_points_json TEXT;
