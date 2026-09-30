-- Playtest: supporto multi-utente sulla stessa sessione.
--
-- Aggiungiamo `recorded_by` (user_id) alle tabelle dove gli osservatori
-- raccolgono dati indipendentemente. Già playtest_checklist_instances aveva
-- `observer_user_id` — manteniamo quella per coerenza.
--
-- Note tecniche SQLite:
--   - ALTER TABLE ADD COLUMN non supporta FOREIGN KEY su tabella esistente.
--   - Per ora memorizziamo solo l'ID (TEXT) — la coerenza referenziale è
--     garantita lato applicazione. La cancellazione utente non rompe i dati
--     (recorded_by resta dangling ma l'aggregazione resta corretta).

ALTER TABLE playtest_turns         ADD COLUMN recorded_by TEXT;
ALTER TABLE playtest_observations  ADD COLUMN recorded_by TEXT;
ALTER TABLE playtest_omni_comments ADD COLUMN recorded_by TEXT;
ALTER TABLE playtest_distractions  ADD COLUMN recorded_by TEXT;

CREATE INDEX IF NOT EXISTS pt_turns_recorder_idx ON playtest_turns(session_id, recorded_by);
CREATE INDEX IF NOT EXISTS pt_obs_recorder_idx   ON playtest_observations(session_id, recorded_by);
CREATE INDEX IF NOT EXISTS pt_omni_recorder_idx  ON playtest_omni_comments(session_id, recorded_by);
