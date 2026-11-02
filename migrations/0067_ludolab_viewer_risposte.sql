-- LUDO LAB: Leonardo Ghisi (committente) vede anche le singole risposte e il CSV
-- (decisione di Vittorio Guerrieri, 2/11/2026). Il testo d'apertura del questionario
-- dice che le risposte le leggono i ricercatori e il responsabile del progetto.
UPDATE research_study_viewers SET access_level = 'risposte'
WHERE study_id = 'ff07aa9d-b924-5be3-8989-6e5356f357d7'
  AND user_id = '817871f6-4579-4c80-a4d6-4a24e473c6da';
