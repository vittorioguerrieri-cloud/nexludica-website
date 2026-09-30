-- 0022_seed_playtest_history.sql
-- Seed dei dati storici dei playtest A Monk-y Business e WarFables (#1 e #2).
-- Generato automaticamente da tmp_gen_playtest_seed.py.
-- Mappa i checklist item del vecchio template (Nov 2025) sui template di sistema May 2026.
-- Item invertiti (10 - score) annotati in commento.

-- ============================================================
-- GAMES
-- ============================================================
INSERT OR IGNORE INTO playtest_games (id, slug, name, short_description, designers, players_min, players_max, duration_min_minutes, duration_max_minutes, min_age, procedure_config, status, created_at, updated_at, created_by) VALUES
  ('ptg_a_monk_y_business', 'a-monk-y-business', 'A Monk-y Business', 'Gioco da tavolo con tema scimmie & monaci', 'D. Aurelio, L. Caloi, V. Guerrieri, G. Reali', 2, 4, 120, 180, 18, '{"phases":["setup","inizio","fine","partecipata"],"points_label_1":"Punti 1","points_label_2":"Punti 2","track_experience":true,"modules":["timer","checklist","omni","observations","scales"]}', 'active', 1766088000000, 1766088000000, NULL);
INSERT OR IGNORE INTO playtest_games (id, slug, name, short_description, designers, players_min, players_max, duration_min_minutes, duration_max_minutes, min_age, procedure_config, status, created_at, updated_at, created_by) VALUES
  ('ptg_warfables', 'warfables', 'WarFables', 'Gioco da tavolo fantasy/strategico', NULL, 2, 4, 60, 120, 14, '{"phases":["setup","inizio","fine","partecipata"],"points_label_1":"Punti 1","points_label_2":"Punti 2","track_experience":true,"modules":["timer","checklist","omni","observations","scales"]}', 'active', 1764446400000, 1764446400000, NULL);

-- ============================================================
-- SESSIONS
-- ============================================================
INSERT OR IGNORE INTO playtest_sessions (id, game_id, label, played_at, location, notes, status, total_minutes, perceived_minutes, flow_score, gradimento_mean, gradimento_sd, created_at, updated_at, created_by) VALUES
  ('pts_monky_1', 'ptg_a_monk_y_business', 'A Monk-y Business PT', '2025-12-18', NULL,  NULL, 'completed',  NULL, NULL, NULL, NULL, NULL, 1766088000000, 1766088000000, NULL);
INSERT OR IGNORE INTO playtest_sessions (id, game_id, label, played_at, location, notes, status, total_minutes, perceived_minutes, flow_score, gradimento_mean, gradimento_sd, created_at, updated_at, created_by) VALUES
  ('pts_warf_1', 'ptg_warfables', 'WarFables PT #1', '2025-11-29', NULL,  NULL, 'completed',  NULL, NULL, NULL, NULL, NULL, 1764446400000, 1764446400000, NULL);
INSERT OR IGNORE INTO playtest_sessions (id, game_id, label, played_at, location, notes, status, total_minutes, perceived_minutes, flow_score, gradimento_mean, gradimento_sd, created_at, updated_at, created_by) VALUES
  ('pts_warf_2', 'ptg_warfables', 'WarFables PT #2', '2026-01-31', NULL,  NULL, 'completed',  78.0, 90.0, 0.8666666667, 52.5, 9.44, 1769889600000, 1769889600000, NULL);

-- ============================================================
-- PLAYERS
-- ============================================================
INSERT OR IGNORE INTO playtest_players (id, session_id, display_name, role, experience, real_name, notes, position) VALUES
  ('ptp_monky_marco', 'pts_monky_1', 'Marco', 'Devoto / Crociata', NULL, NULL, NULL, 1);
INSERT OR IGNORE INTO playtest_players (id, session_id, display_name, role, experience, real_name, notes, position) VALUES
  ('ptp_monky_ste', 'pts_monky_1', 'Ste', 'Mago / Cronomante', NULL, NULL, NULL, 2);
INSERT OR IGNORE INTO playtest_players (id, session_id, display_name, role, experience, real_name, notes, position) VALUES
  ('ptp_monky_greg', 'pts_monky_1', 'Greg', 'Druido / Anima', NULL, NULL, NULL, 3);
INSERT OR IGNORE INTO playtest_players (id, session_id, display_name, role, experience, real_name, notes, position) VALUES
  ('ptp_monky_pino', 'pts_monky_1', 'Pino', 'Paladino / Prescelto', NULL, NULL, NULL, 4);
INSERT OR IGNORE INTO playtest_players (id, session_id, display_name, role, experience, real_name, notes, position) VALUES
  ('ptp_warf1_marco', 'pts_warf_1', 'Marco', 'Devoto / Crociata', NULL, NULL, NULL, 1);
INSERT OR IGNORE INTO playtest_players (id, session_id, display_name, role, experience, real_name, notes, position) VALUES
  ('ptp_warf1_ste', 'pts_warf_1', 'Ste', 'Mago / Cronomante', NULL, NULL, NULL, 2);
INSERT OR IGNORE INTO playtest_players (id, session_id, display_name, role, experience, real_name, notes, position) VALUES
  ('ptp_warf1_greg', 'pts_warf_1', 'Greg', 'Druido / Anima', NULL, NULL, NULL, 3);
INSERT OR IGNORE INTO playtest_players (id, session_id, display_name, role, experience, real_name, notes, position) VALUES
  ('ptp_warf1_pino', 'pts_warf_1', 'Pino', 'Paladino / Prescelto', NULL, NULL, NULL, 4);
INSERT OR IGNORE INTO playtest_players (id, session_id, display_name, role, experience, real_name, notes, position) VALUES
  ('ptp_warf2_esploratore', 'pts_warf_2', 'Esploratore', NULL, 'Nuovo', NULL, NULL, 1);
INSERT OR IGNORE INTO playtest_players (id, session_id, display_name, role, experience, real_name, notes, position) VALUES
  ('ptp_warf2_druido', 'pts_warf_2', 'Druido', NULL, 'Nuovo', NULL, NULL, 2);
INSERT OR IGNORE INTO playtest_players (id, session_id, display_name, role, experience, real_name, notes, position) VALUES
  ('ptp_warf2_barbaro', 'pts_warf_2', 'Barbaro', NULL, 'Esperto', NULL, NULL, 3);
INSERT OR IGNORE INTO playtest_players (id, session_id, display_name, role, experience, real_name, notes, position) VALUES
  ('ptp_warf2_mago', 'pts_warf_2', 'Mago', NULL, 'Esperto', NULL, NULL, 4);
INSERT OR IGNORE INTO playtest_players (id, session_id, display_name, role, experience, real_name, notes, position) VALUES
  ('ptp_warf2_devoto', 'pts_warf_2', 'Devoto', NULL, 'Esperto', NULL, NULL, 5);
INSERT OR IGNORE INTO playtest_players (id, session_id, display_name, role, experience, real_name, notes, position) VALUES
  ('ptp_warf2_assassino', 'pts_warf_2', 'Assassino', NULL, 'Esperto', NULL, NULL, 6);

-- ============================================================
-- PHASE TIMES
-- ============================================================
INSERT OR IGNORE INTO playtest_phase_times (id, session_id, name, minutes, position, created_at) VALUES
  ('ptph_monky_1', 'pts_monky_1', 'Set-up out of game', 25.0, 1, 1766088000000);
INSERT OR IGNORE INTO playtest_phase_times (id, session_id, name, minutes, position, created_at) VALUES
  ('ptph_monky_2', 'pts_monky_1', 'Set-up in game', 10.0, 2, 1766088000000);
INSERT OR IGNORE INTO playtest_phase_times (id, session_id, name, minutes, position, created_at) VALUES
  ('ptph_warf1_1', 'pts_warf_1', 'Set-up out of game', 25.0, 1, 1764446400000);
INSERT OR IGNORE INTO playtest_phase_times (id, session_id, name, minutes, position, created_at) VALUES
  ('ptph_warf1_2', 'pts_warf_1', 'Set-up in game', 10.0, 2, 1764446400000);
INSERT OR IGNORE INTO playtest_phase_times (id, session_id, name, minutes, position, created_at) VALUES
  ('ptph_warf2_1', 'pts_warf_2', 'Set-up', 90.0, 1, 1769889600000);
INSERT OR IGNORE INTO playtest_phase_times (id, session_id, name, minutes, position, created_at) VALUES
  ('ptph_warf2_2', 'pts_warf_2', 'Tiro iniziale', 1.0, 2, 1769889600000);

-- ============================================================
-- TURNS
-- ============================================================
INSERT OR IGNORE INTO playtest_turns (id, session_id, round, player_id, duration_seconds, points_1, points_2, event, recorded_at) VALUES
  ('ptt_monky_01', 'pts_monky_1', 1, 'ptp_monky_marco', 504, 7.0, 0.0, NULL, 1766088000000);
INSERT OR IGNORE INTO playtest_turns (id, session_id, round, player_id, duration_seconds, points_1, points_2, event, recorded_at) VALUES
  ('ptt_monky_02', 'pts_monky_1', 1, 'ptp_monky_ste', 492, 7.0, 0.0, NULL, 1766088000000);
INSERT OR IGNORE INTO playtest_turns (id, session_id, round, player_id, duration_seconds, points_1, points_2, event, recorded_at) VALUES
  ('ptt_monky_03', 'pts_monky_1', 1, 'ptp_monky_greg', 384, 7.0, 0.0, NULL, 1766088000000);
INSERT OR IGNORE INTO playtest_turns (id, session_id, round, player_id, duration_seconds, points_1, points_2, event, recorded_at) VALUES
  ('ptt_monky_04', 'pts_monky_1', 1, 'ptp_monky_pino', 378, 7.0, 0.0, NULL, 1766088000000);
INSERT OR IGNORE INTO playtest_turns (id, session_id, round, player_id, duration_seconds, points_1, points_2, event, recorded_at) VALUES
  ('ptt_monky_05', 'pts_monky_1', 2, 'ptp_monky_marco', 624, 9.0, 0.0, NULL, 1766088000000);
INSERT OR IGNORE INTO playtest_turns (id, session_id, round, player_id, duration_seconds, points_1, points_2, event, recorded_at) VALUES
  ('ptt_monky_06', 'pts_monky_1', 2, 'ptp_monky_ste', 252, 9.0, 0.0, NULL, 1766088000000);
INSERT OR IGNORE INTO playtest_turns (id, session_id, round, player_id, duration_seconds, points_1, points_2, event, recorded_at) VALUES
  ('ptt_monky_07', 'pts_monky_1', 2, 'ptp_monky_greg', 384, 9.0, 0.0, NULL, 1766088000000);
INSERT OR IGNORE INTO playtest_turns (id, session_id, round, player_id, duration_seconds, points_1, points_2, event, recorded_at) VALUES
  ('ptt_monky_08', 'pts_monky_1', 2, 'ptp_monky_pino', 0, 9.0, 0.0, NULL, 1766088000000);
INSERT OR IGNORE INTO playtest_turns (id, session_id, round, player_id, duration_seconds, points_1, points_2, event, recorded_at) VALUES
  ('ptt_monky_09', 'pts_monky_1', 3, 'ptp_monky_marco', 624, 12.0, 2.0, NULL, 1766088000000);
INSERT OR IGNORE INTO playtest_turns (id, session_id, round, player_id, duration_seconds, points_1, points_2, event, recorded_at) VALUES
  ('ptt_monky_10', 'pts_monky_1', 3, 'ptp_monky_ste', 0, 12.0, 2.0, NULL, 1766088000000);
INSERT OR IGNORE INTO playtest_turns (id, session_id, round, player_id, duration_seconds, points_1, points_2, event, recorded_at) VALUES
  ('ptt_monky_11', 'pts_monky_1', 3, 'ptp_monky_greg', 270, 12.0, 2.0, NULL, 1766088000000);
INSERT OR IGNORE INTO playtest_turns (id, session_id, round, player_id, duration_seconds, points_1, points_2, event, recorded_at) VALUES
  ('ptt_monky_12', 'pts_monky_1', 3, 'ptp_monky_pino', 780, 12.0, 2.0, NULL, 1766088000000);
INSERT OR IGNORE INTO playtest_turns (id, session_id, round, player_id, duration_seconds, points_1, points_2, event, recorded_at) VALUES
  ('ptt_monky_13', 'pts_monky_1', 4, 'ptp_monky_marco', 0, 12.0, 5.0, NULL, 1766088000000);
INSERT OR IGNORE INTO playtest_turns (id, session_id, round, player_id, duration_seconds, points_1, points_2, event, recorded_at) VALUES
  ('ptt_monky_14', 'pts_monky_1', 4, 'ptp_monky_ste', 330, 12.0, 5.0, NULL, 1766088000000);
INSERT OR IGNORE INTO playtest_turns (id, session_id, round, player_id, duration_seconds, points_1, points_2, event, recorded_at) VALUES
  ('ptt_monky_15', 'pts_monky_1', 4, 'ptp_monky_greg', 0, 12.0, 5.0, NULL, 1766088000000);
INSERT OR IGNORE INTO playtest_turns (id, session_id, round, player_id, duration_seconds, points_1, points_2, event, recorded_at) VALUES
  ('ptt_monky_16', 'pts_monky_1', 4, 'ptp_monky_pino', 324, 12.0, 5.0, NULL, 1766088000000);
INSERT OR IGNORE INTO playtest_turns (id, session_id, round, player_id, duration_seconds, points_1, points_2, event, recorded_at) VALUES
  ('ptt_monky_17', 'pts_monky_1', 5, 'ptp_monky_marco', 330, 12.0, 6.0, NULL, 1766088000000);
INSERT OR IGNORE INTO playtest_turns (id, session_id, round, player_id, duration_seconds, points_1, points_2, event, recorded_at) VALUES
  ('ptt_monky_18', 'pts_monky_1', 5, 'ptp_monky_ste', 300, 12.0, 6.0, NULL, 1766088000000);
INSERT OR IGNORE INTO playtest_turns (id, session_id, round, player_id, duration_seconds, points_1, points_2, event, recorded_at) VALUES
  ('ptt_monky_19', 'pts_monky_1', 5, 'ptp_monky_greg', 0, 12.0, 6.0, NULL, 1766088000000);
INSERT OR IGNORE INTO playtest_turns (id, session_id, round, player_id, duration_seconds, points_1, points_2, event, recorded_at) VALUES
  ('ptt_monky_20', 'pts_monky_1', 5, 'ptp_monky_pino', 60, 12.0, 6.0, NULL, 1766088000000);
INSERT OR IGNORE INTO playtest_turns (id, session_id, round, player_id, duration_seconds, points_1, points_2, event, recorded_at) VALUES
  ('ptt_warf1_01', 'pts_warf_1', 1, 'ptp_warf1_marco', 504, 7.0, 0.0, NULL, 1764446400000);
INSERT OR IGNORE INTO playtest_turns (id, session_id, round, player_id, duration_seconds, points_1, points_2, event, recorded_at) VALUES
  ('ptt_warf1_02', 'pts_warf_1', 1, 'ptp_warf1_ste', 492, 7.0, 0.0, NULL, 1764446400000);
INSERT OR IGNORE INTO playtest_turns (id, session_id, round, player_id, duration_seconds, points_1, points_2, event, recorded_at) VALUES
  ('ptt_warf1_03', 'pts_warf_1', 1, 'ptp_warf1_greg', 384, 7.0, 0.0, NULL, 1764446400000);
INSERT OR IGNORE INTO playtest_turns (id, session_id, round, player_id, duration_seconds, points_1, points_2, event, recorded_at) VALUES
  ('ptt_warf1_04', 'pts_warf_1', 1, 'ptp_warf1_pino', 378, 7.0, 0.0, NULL, 1764446400000);
INSERT OR IGNORE INTO playtest_turns (id, session_id, round, player_id, duration_seconds, points_1, points_2, event, recorded_at) VALUES
  ('ptt_warf1_05', 'pts_warf_1', 2, 'ptp_warf1_marco', 624, 9.0, 0.0, NULL, 1764446400000);
INSERT OR IGNORE INTO playtest_turns (id, session_id, round, player_id, duration_seconds, points_1, points_2, event, recorded_at) VALUES
  ('ptt_warf1_06', 'pts_warf_1', 2, 'ptp_warf1_ste', 252, 9.0, 0.0, NULL, 1764446400000);
INSERT OR IGNORE INTO playtest_turns (id, session_id, round, player_id, duration_seconds, points_1, points_2, event, recorded_at) VALUES
  ('ptt_warf1_07', 'pts_warf_1', 2, 'ptp_warf1_greg', 384, 9.0, 0.0, NULL, 1764446400000);
INSERT OR IGNORE INTO playtest_turns (id, session_id, round, player_id, duration_seconds, points_1, points_2, event, recorded_at) VALUES
  ('ptt_warf1_08', 'pts_warf_1', 2, 'ptp_warf1_pino', 0, 9.0, 0.0, NULL, 1764446400000);
INSERT OR IGNORE INTO playtest_turns (id, session_id, round, player_id, duration_seconds, points_1, points_2, event, recorded_at) VALUES
  ('ptt_warf1_09', 'pts_warf_1', 3, 'ptp_warf1_marco', 624, 12.0, 2.0, NULL, 1764446400000);
INSERT OR IGNORE INTO playtest_turns (id, session_id, round, player_id, duration_seconds, points_1, points_2, event, recorded_at) VALUES
  ('ptt_warf1_10', 'pts_warf_1', 3, 'ptp_warf1_ste', 0, 12.0, 2.0, NULL, 1764446400000);
INSERT OR IGNORE INTO playtest_turns (id, session_id, round, player_id, duration_seconds, points_1, points_2, event, recorded_at) VALUES
  ('ptt_warf1_11', 'pts_warf_1', 3, 'ptp_warf1_greg', 270, 12.0, 2.0, NULL, 1764446400000);
INSERT OR IGNORE INTO playtest_turns (id, session_id, round, player_id, duration_seconds, points_1, points_2, event, recorded_at) VALUES
  ('ptt_warf1_12', 'pts_warf_1', 3, 'ptp_warf1_pino', 780, 12.0, 2.0, NULL, 1764446400000);
INSERT OR IGNORE INTO playtest_turns (id, session_id, round, player_id, duration_seconds, points_1, points_2, event, recorded_at) VALUES
  ('ptt_warf1_13', 'pts_warf_1', 4, 'ptp_warf1_marco', 0, 12.0, 5.0, NULL, 1764446400000);
INSERT OR IGNORE INTO playtest_turns (id, session_id, round, player_id, duration_seconds, points_1, points_2, event, recorded_at) VALUES
  ('ptt_warf1_14', 'pts_warf_1', 4, 'ptp_warf1_ste', 330, 12.0, 5.0, NULL, 1764446400000);
INSERT OR IGNORE INTO playtest_turns (id, session_id, round, player_id, duration_seconds, points_1, points_2, event, recorded_at) VALUES
  ('ptt_warf1_15', 'pts_warf_1', 4, 'ptp_warf1_greg', 0, 12.0, 5.0, NULL, 1764446400000);
INSERT OR IGNORE INTO playtest_turns (id, session_id, round, player_id, duration_seconds, points_1, points_2, event, recorded_at) VALUES
  ('ptt_warf1_16', 'pts_warf_1', 4, 'ptp_warf1_pino', 324, 12.0, 5.0, NULL, 1764446400000);
INSERT OR IGNORE INTO playtest_turns (id, session_id, round, player_id, duration_seconds, points_1, points_2, event, recorded_at) VALUES
  ('ptt_warf1_17', 'pts_warf_1', 5, 'ptp_warf1_marco', 330, 12.0, 6.0, NULL, 1764446400000);
INSERT OR IGNORE INTO playtest_turns (id, session_id, round, player_id, duration_seconds, points_1, points_2, event, recorded_at) VALUES
  ('ptt_warf1_18', 'pts_warf_1', 5, 'ptp_warf1_ste', 300, 12.0, 6.0, NULL, 1764446400000);
INSERT OR IGNORE INTO playtest_turns (id, session_id, round, player_id, duration_seconds, points_1, points_2, event, recorded_at) VALUES
  ('ptt_warf1_19', 'pts_warf_1', 5, 'ptp_warf1_greg', 0, 12.0, 6.0, NULL, 1764446400000);
INSERT OR IGNORE INTO playtest_turns (id, session_id, round, player_id, duration_seconds, points_1, points_2, event, recorded_at) VALUES
  ('ptt_warf1_20', 'pts_warf_1', 5, 'ptp_warf1_pino', 60, 12.0, 6.0, NULL, 1764446400000);
INSERT OR IGNORE INTO playtest_turns (id, session_id, round, player_id, duration_seconds, points_1, points_2, event, recorded_at) VALUES
  ('ptt_warf2_01', 'pts_warf_2', 0, 'ptp_warf2_esploratore', 153, 0.0, 0.0, NULL, 1769889600000);
INSERT OR IGNORE INTO playtest_turns (id, session_id, round, player_id, duration_seconds, points_1, points_2, event, recorded_at) VALUES
  ('ptt_warf2_02', 'pts_warf_2', 1, 'ptp_warf2_esploratore', 145, 0.0, 2.0, 'Uovo', 1769889600000);
INSERT OR IGNORE INTO playtest_turns (id, session_id, round, player_id, duration_seconds, points_1, points_2, event, recorded_at) VALUES
  ('ptt_warf2_03', 'pts_warf_2', 1, 'ptp_warf2_druido', 150, 0.0, 2.0, NULL, 1769889600000);
INSERT OR IGNORE INTO playtest_turns (id, session_id, round, player_id, duration_seconds, points_1, points_2, event, recorded_at) VALUES
  ('ptt_warf2_04', 'pts_warf_2', 1, 'ptp_warf2_barbaro', 282, 0.0, 2.0, NULL, 1769889600000);
INSERT OR IGNORE INTO playtest_turns (id, session_id, round, player_id, duration_seconds, points_1, points_2, event, recorded_at) VALUES
  ('ptt_warf2_05', 'pts_warf_2', 1, 'ptp_warf2_mago', 234, 0.0, 2.0, NULL, 1769889600000);
INSERT OR IGNORE INTO playtest_turns (id, session_id, round, player_id, duration_seconds, points_1, points_2, event, recorded_at) VALUES
  ('ptt_warf2_06', 'pts_warf_2', 1, 'ptp_warf2_devoto', 247, 0.0, 2.0, NULL, 1769889600000);
INSERT OR IGNORE INTO playtest_turns (id, session_id, round, player_id, duration_seconds, points_1, points_2, event, recorded_at) VALUES
  ('ptt_warf2_07', 'pts_warf_2', 1, 'ptp_warf2_assassino', 335, 0.0, 2.0, NULL, 1769889600000);
INSERT OR IGNORE INTO playtest_turns (id, session_id, round, player_id, duration_seconds, points_1, points_2, event, recorded_at) VALUES
  ('ptt_warf2_08', 'pts_warf_2', 2, 'ptp_warf2_esploratore', 360, 0.0, 4.0, 'Uovo', 1769889600000);
INSERT OR IGNORE INTO playtest_turns (id, session_id, round, player_id, duration_seconds, points_1, points_2, event, recorded_at) VALUES
  ('ptt_warf2_09', 'pts_warf_2', 2, 'ptp_warf2_druido', 328, 0.0, 4.0, NULL, 1769889600000);
INSERT OR IGNORE INTO playtest_turns (id, session_id, round, player_id, duration_seconds, points_1, points_2, event, recorded_at) VALUES
  ('ptt_warf2_10', 'pts_warf_2', 2, 'ptp_warf2_barbaro', 61, 3.0, 4.0, 'Primo sangue', 1769889600000);
INSERT OR IGNORE INTO playtest_turns (id, session_id, round, player_id, duration_seconds, points_1, points_2, event, recorded_at) VALUES
  ('ptt_warf2_11', 'pts_warf_2', 2, 'ptp_warf2_mago', 131, 3.0, 4.0, NULL, 1769889600000);
INSERT OR IGNORE INTO playtest_turns (id, session_id, round, player_id, duration_seconds, points_1, points_2, event, recorded_at) VALUES
  ('ptt_warf2_12', 'pts_warf_2', 2, 'ptp_warf2_devoto', 300, 3.0, 4.0, NULL, 1769889600000);
INSERT OR IGNORE INTO playtest_turns (id, session_id, round, player_id, duration_seconds, points_1, points_2, event, recorded_at) VALUES
  ('ptt_warf2_13', 'pts_warf_2', 2, 'ptp_warf2_assassino', 300, 3.0, 4.0, NULL, 1769889600000);
INSERT OR IGNORE INTO playtest_turns (id, session_id, round, player_id, duration_seconds, points_1, points_2, event, recorded_at) VALUES
  ('ptt_warf2_14', 'pts_warf_2', 3, 'ptp_warf2_esploratore', 258, 3.0, 6.0, 'Uovo', 1769889600000);
INSERT OR IGNORE INTO playtest_turns (id, session_id, round, player_id, duration_seconds, points_1, points_2, event, recorded_at) VALUES
  ('ptt_warf2_15', 'pts_warf_2', 3, 'ptp_warf2_druido', 312, 3.0, 6.0, NULL, 1769889600000);
INSERT OR IGNORE INTO playtest_turns (id, session_id, round, player_id, duration_seconds, points_1, points_2, event, recorded_at) VALUES
  ('ptt_warf2_16', 'pts_warf_2', 3, 'ptp_warf2_barbaro', 392, 3.0, 8.0, 'Morte', 1769889600000);
INSERT OR IGNORE INTO playtest_turns (id, session_id, round, player_id, duration_seconds, points_1, points_2, event, recorded_at) VALUES
  ('ptt_warf2_17', 'pts_warf_2', 3, 'ptp_warf2_mago', 0, 3.0, 8.0, NULL, 1769889600000);
INSERT OR IGNORE INTO playtest_turns (id, session_id, round, player_id, duration_seconds, points_1, points_2, event, recorded_at) VALUES
  ('ptt_warf2_18', 'pts_warf_2', 3, 'ptp_warf2_devoto', 510, 3.0, 8.0, NULL, 1769889600000);
INSERT OR IGNORE INTO playtest_turns (id, session_id, round, player_id, duration_seconds, points_1, points_2, event, recorded_at) VALUES
  ('ptt_warf2_19', 'pts_warf_2', 3, 'ptp_warf2_assassino', 180, 3.0, 8.0, NULL, 1769889600000);

-- ============================================================
-- CHECKLIST INSTANCES
-- ============================================================
INSERT OR IGNORE INTO playtest_checklist_instances (id, session_id, phase, observer_user_id, observer_name, notes, created_at, updated_at) VALUES
  ('pti_inst_monky_setup_vitto', 'pts_monky_1', 'setup', NULL, 'Vitto', NULL, 1766088000000, 1766088000000);
INSERT OR IGNORE INTO playtest_checklist_instances (id, session_id, phase, observer_user_id, observer_name, notes, created_at, updated_at) VALUES
  ('pti_inst_monky_setup_simo', 'pts_monky_1', 'setup', NULL, 'Simo', NULL, 1766088000000, 1766088000000);
INSERT OR IGNORE INTO playtest_checklist_instances (id, session_id, phase, observer_user_id, observer_name, notes, created_at, updated_at) VALUES
  ('pti_inst_monky_inizio_vitto', 'pts_monky_1', 'inizio', NULL, 'Vitto', NULL, 1766088000000, 1766088000000);
INSERT OR IGNORE INTO playtest_checklist_instances (id, session_id, phase, observer_user_id, observer_name, notes, created_at, updated_at) VALUES
  ('pti_inst_monky_inizio_simo', 'pts_monky_1', 'inizio', NULL, 'Simo', NULL, 1766088000000, 1766088000000);
INSERT OR IGNORE INTO playtest_checklist_instances (id, session_id, phase, observer_user_id, observer_name, notes, created_at, updated_at) VALUES
  ('pti_inst_monky_fine_vitto', 'pts_monky_1', 'fine', NULL, 'Vitto', NULL, 1766088000000, 1766088000000);
INSERT OR IGNORE INTO playtest_checklist_instances (id, session_id, phase, observer_user_id, observer_name, notes, created_at, updated_at) VALUES
  ('pti_inst_monky_fine_simo', 'pts_monky_1', 'fine', NULL, 'Simo', NULL, 1766088000000, 1766088000000);
INSERT OR IGNORE INTO playtest_checklist_instances (id, session_id, phase, observer_user_id, observer_name, notes, created_at, updated_at) VALUES
  ('pti_inst_warf1_setup_vitto', 'pts_warf_1', 'setup', NULL, 'Vitto', NULL, 1764446400000, 1764446400000);
INSERT OR IGNORE INTO playtest_checklist_instances (id, session_id, phase, observer_user_id, observer_name, notes, created_at, updated_at) VALUES
  ('pti_inst_warf1_setup_simo', 'pts_warf_1', 'setup', NULL, 'Simo', NULL, 1764446400000, 1764446400000);
INSERT OR IGNORE INTO playtest_checklist_instances (id, session_id, phase, observer_user_id, observer_name, notes, created_at, updated_at) VALUES
  ('pti_inst_warf1_inizio_vitto', 'pts_warf_1', 'inizio', NULL, 'Vitto', NULL, 1764446400000, 1764446400000);
INSERT OR IGNORE INTO playtest_checklist_instances (id, session_id, phase, observer_user_id, observer_name, notes, created_at, updated_at) VALUES
  ('pti_inst_warf1_inizio_simo', 'pts_warf_1', 'inizio', NULL, 'Simo', NULL, 1764446400000, 1764446400000);
INSERT OR IGNORE INTO playtest_checklist_instances (id, session_id, phase, observer_user_id, observer_name, notes, created_at, updated_at) VALUES
  ('pti_inst_warf1_fine_vitto', 'pts_warf_1', 'fine', NULL, 'Vitto', NULL, 1764446400000, 1764446400000);
INSERT OR IGNORE INTO playtest_checklist_instances (id, session_id, phase, observer_user_id, observer_name, notes, created_at, updated_at) VALUES
  ('pti_inst_warf1_fine_simo', 'pts_warf_1', 'fine', NULL, 'Simo', NULL, 1764446400000, 1764446400000);
INSERT OR IGNORE INTO playtest_checklist_instances (id, session_id, phase, observer_user_id, observer_name, notes, created_at, updated_at) VALUES
  ('pti_inst_warf2_setup', 'pts_warf_2', 'setup', NULL, NULL, NULL, 1769889600000, 1769889600000);
INSERT OR IGNORE INTO playtest_checklist_instances (id, session_id, phase, observer_user_id, observer_name, notes, created_at, updated_at) VALUES
  ('pti_inst_warf2_inizio', 'pts_warf_2', 'inizio', NULL, NULL, NULL, 1769889600000, 1769889600000);
INSERT OR IGNORE INTO playtest_checklist_instances (id, session_id, phase, observer_user_id, observer_name, notes, created_at, updated_at) VALUES
  ('pti_inst_warf2_fine', 'pts_warf_2', 'fine', NULL, NULL, NULL, 1769889600000, 1769889600000);
INSERT OR IGNORE INTO playtest_checklist_instances (id, session_id, phase, observer_user_id, observer_name, notes, created_at, updated_at) VALUES
  ('pti_inst_warf2_partecipata', 'pts_warf_2', 'partecipata', NULL, NULL, NULL, 1769889600000, 1769889600000);

-- ============================================================
-- CHECKLIST RESPONSES
-- ============================================================
-- Mapping: vecchio template (Nov 2025) -> nuovo template (May 2026).
-- Score invertito (10 - vecchio) annotato in commento.

INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0001', 'pti_inst_monky_inizio_vitto', 'pti_obs_01', 2.0, '(score invertito dal template vecchio)');
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0002', 'pti_inst_monky_inizio_vitto', 'pti_obs_02', 6.0, NULL);
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0003', 'pti_inst_monky_inizio_vitto', 'pti_obs_03', 5.0, 'Le carte che non andrebbero alzate, vanno alzate dal tavolo per essere lette');
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0004', 'pti_inst_monky_inizio_vitto', 'pti_obs_04', 6.0, 'I giocatori all''inizio passano tanto tempo a leggere la propria scheda, spero che dopo il grado di attenzione aumenti');
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0005', 'pti_inst_monky_inizio_vitto', 'pti_obs_05', 8.0, 'Sono interessati a cosa fanno le abilità altrui');
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0006', 'pti_inst_monky_inizio_vitto', 'pti_obs_06', 0.0, 'Per niente (score invertito dal template vecchio)');
-- SKIP row 15 'I giocatori si allontanano dal tavolo?' in sheet 'Inizio Vitto': no template match
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0007', 'pti_inst_monky_inizio_vitto', 'pti_obs_07', 6.0, 'all''inizio paralisi lunghissima (score invertito dal template vecchio)');
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0008', 'pti_inst_monky_inizio_vitto', 'pti_obs_08', 4.0, 'Non sembra, ma le condizioni a volte sì (score invertito dal template vecchio)');
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0009', 'pti_inst_monky_inizio_vitto', 'pti_obs_09', 0.0, 'ad ora no (score invertito dal template vecchio)');
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0010', 'pti_inst_monky_inizio_vitto', 'pti_obs_10', 10.0, NULL);
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0011', 'pti_inst_monky_inizio_vitto', 'pti_obs_11', 10.0, 'Molto attivi e positivi');
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0012', 'pti_inst_monky_inizio_vitto', 'pti_obs_13', 6.0, 'Un po'' di attrito apparentemente poco sano al tavolo (item combinato split dal template vecchio "poco frustrati/annoiati", score diretto)');
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0013', 'pti_inst_monky_inizio_vitto', 'pti_obs_14', 6.0, 'Un po'' di attrito apparentemente poco sano al tavolo (item combinato split dal template vecchio "poco frustrati/annoiati", score diretto)');
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0014', 'pti_inst_monky_inizio_vitto', 'pti_obs_15', 10.0, NULL);
-- SKIP row 32 'Sono coinvolti durante la partita?' in sheet 'Inizio Vitto': no template match
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0015', 'pti_inst_monky_inizio_simo', 'pti_obs_01', 5.0, 'sì per prendere materiali o guardare carte altrui (score invertito dal template vecchio)');
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0016', 'pti_inst_monky_inizio_simo', 'pti_obs_02', 7.0, NULL);
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0017', 'pti_inst_monky_inizio_simo', 'pti_obs_03', 6.0, 'scritte piccole');
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0018', 'pti_inst_monky_inizio_simo', 'pti_obs_04', 6.0, 'spesso si leggono le proprie cose nel turno altrui e non si presta attenzione a meno che non si venga chiamati');
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0019', 'pti_inst_monky_inizio_simo', 'pti_obs_05', 4.0, 'per ora non mi sembra sia successo spesso');
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0020', 'pti_inst_monky_inizio_simo', 'pti_obs_06', 9.0, 'no sono molto presi (score invertito dal template vecchio)');
-- SKIP row 15 'I giocatori si allontanano dal tavolo?' in sheet 'Inizio Simo': no template match
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0021', 'pti_inst_monky_inizio_simo', 'pti_obs_07', 2.0, '(score invertito dal template vecchio)');
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0022', 'pti_inst_monky_inizio_simo', 'pti_obs_08', 6.0, 'tante condizioni e tante evocazioni in campo da gestire insieme agli scenici (score invertito dal template vecchio)');
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0023', 'pti_inst_monky_inizio_simo', 'pti_obs_09', 1.0, '(score invertito dal template vecchio)');
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0024', 'pti_inst_monky_inizio_simo', 'pti_obs_10', 7.0, 'per la missione sì ma allo stesso tempo all''inizio sembravano dimenticarsene');
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0025', 'pti_inst_monky_inizio_simo', 'pti_obs_11', 8.0, NULL);
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0026', 'pti_inst_monky_inizio_simo', 'pti_obs_13', 6.0, 'poco frustrati ma subiscono nello spirito del gioco (item combinato split + invertito dal template vecchio "frustrati/annoiati")');
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0027', 'pti_inst_monky_inizio_simo', 'pti_obs_14', 6.0, 'poco frustrati ma subiscono nello spirito del gioco (item combinato split + invertito dal template vecchio "frustrati/annoiati")');
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0028', 'pti_inst_monky_inizio_simo', 'pti_obs_15', 9.0, NULL);
-- SKIP row 32 'Sono coinvolti durante la partita?' in sheet 'Inizio Simo': no template match
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0029', 'pti_inst_monky_fine_vitto', 'pti_obs_01', 0.0, '(score invertito dal template vecchio)');
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0030', 'pti_inst_monky_fine_vitto', 'pti_obs_02', 8.0, NULL);
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0031', 'pti_inst_monky_fine_vitto', 'pti_obs_03', 6.0, NULL);
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0032', 'pti_inst_monky_fine_vitto', 'pti_obs_04', 6.0, NULL);
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0033', 'pti_inst_monky_fine_vitto', 'pti_obs_05', 8.0, NULL);
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0034', 'pti_inst_monky_fine_vitto', 'pti_obs_06', 6.0, '(score invertito dal template vecchio)');
-- SKIP row 15 'I giocatori si allontanano dal tavolo?' in sheet 'Fine Vitto': no template match
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0035', 'pti_inst_monky_fine_vitto', 'pti_obs_07', 7.0, '(score invertito dal template vecchio)');
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0036', 'pti_inst_monky_fine_vitto', 'pti_obs_08', 1.0, '(score invertito dal template vecchio)');
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0037', 'pti_inst_monky_fine_vitto', 'pti_obs_09', 6.0, 'La vita finisce alla fine, player elimination (score invertito dal template vecchio)');
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0038', 'pti_inst_warf1_inizio_vitto', 'pti_obs_01', 2.0, '(score invertito dal template vecchio)');
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0039', 'pti_inst_warf1_inizio_vitto', 'pti_obs_02', 6.0, NULL);
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0040', 'pti_inst_warf1_inizio_vitto', 'pti_obs_03', 5.0, 'Le carte che non andrebbero alzate, vanno alzate dal tavolo per essere lette');
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0041', 'pti_inst_warf1_inizio_vitto', 'pti_obs_04', 6.0, 'I giocatori all''inizio passano tanto tempo a leggere la propria scheda, spero che dopo il grado di attenzione aumenti');
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0042', 'pti_inst_warf1_inizio_vitto', 'pti_obs_05', 8.0, 'Sono interessati a cosa fanno le abilità altrui');
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0043', 'pti_inst_warf1_inizio_vitto', 'pti_obs_06', 0.0, 'Per niente (score invertito dal template vecchio)');
-- SKIP row 15 'I giocatori si allontanano dal tavolo?' in sheet 'Inizio Vitto': no template match
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0044', 'pti_inst_warf1_inizio_vitto', 'pti_obs_07', 6.0, 'all''inizio paralisi lunghissima (score invertito dal template vecchio)');
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0045', 'pti_inst_warf1_inizio_vitto', 'pti_obs_08', 4.0, 'Non sembra, ma le condizioni a volte sì (score invertito dal template vecchio)');
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0046', 'pti_inst_warf1_inizio_vitto', 'pti_obs_09', 0.0, 'ad ora no (score invertito dal template vecchio)');
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0047', 'pti_inst_warf1_inizio_vitto', 'pti_obs_10', 10.0, NULL);
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0048', 'pti_inst_warf1_inizio_vitto', 'pti_obs_11', 10.0, 'Molto attivi e positivi');
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0049', 'pti_inst_warf1_inizio_vitto', 'pti_obs_13', 6.0, 'Un po'' di attrito apparentemente poco sano al tavolo (item combinato split dal template vecchio "poco frustrati/annoiati", score diretto)');
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0050', 'pti_inst_warf1_inizio_vitto', 'pti_obs_14', 6.0, 'Un po'' di attrito apparentemente poco sano al tavolo (item combinato split dal template vecchio "poco frustrati/annoiati", score diretto)');
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0051', 'pti_inst_warf1_inizio_vitto', 'pti_obs_15', 10.0, NULL);
-- SKIP row 32 'Sono coinvolti durante la partita?' in sheet 'Inizio Vitto': no template match
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0052', 'pti_inst_warf1_inizio_simo', 'pti_obs_01', 5.0, 'sì per prendere materiali o guardare carte altrui (score invertito dal template vecchio)');
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0053', 'pti_inst_warf1_inizio_simo', 'pti_obs_02', 7.0, NULL);
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0054', 'pti_inst_warf1_inizio_simo', 'pti_obs_03', 6.0, 'scritte piccole');
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0055', 'pti_inst_warf1_inizio_simo', 'pti_obs_04', 6.0, 'spesso si leggono le proprie cose nel turno altrui e non si presta attenzione a meno che non si venga chiamati');
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0056', 'pti_inst_warf1_inizio_simo', 'pti_obs_05', 4.0, 'per ora non mi sembra sia successo spesso');
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0057', 'pti_inst_warf1_inizio_simo', 'pti_obs_06', 9.0, 'no sono molto presi (score invertito dal template vecchio)');
-- SKIP row 15 'I giocatori si allontanano dal tavolo?' in sheet 'Inizio Simo': no template match
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0058', 'pti_inst_warf1_inizio_simo', 'pti_obs_07', 2.0, '(score invertito dal template vecchio)');
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0059', 'pti_inst_warf1_inizio_simo', 'pti_obs_08', 6.0, 'tante condizioni e tante evocazioni in campo da gestire insieme agli scenici (score invertito dal template vecchio)');
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0060', 'pti_inst_warf1_inizio_simo', 'pti_obs_09', 1.0, '(score invertito dal template vecchio)');
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0061', 'pti_inst_warf1_inizio_simo', 'pti_obs_10', 7.0, 'per la missione sì ma allo stesso tempo all''inizio sembravano dimenticarsene');
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0062', 'pti_inst_warf1_inizio_simo', 'pti_obs_11', 8.0, NULL);
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0063', 'pti_inst_warf1_inizio_simo', 'pti_obs_13', 6.0, 'poco frustrati ma subiscono nello spirito del gioco (item combinato split + invertito dal template vecchio "frustrati/annoiati")');
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0064', 'pti_inst_warf1_inizio_simo', 'pti_obs_14', 6.0, 'poco frustrati ma subiscono nello spirito del gioco (item combinato split + invertito dal template vecchio "frustrati/annoiati")');
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0065', 'pti_inst_warf1_inizio_simo', 'pti_obs_15', 9.0, NULL);
-- SKIP row 32 'Sono coinvolti durante la partita?' in sheet 'Inizio Simo': no template match
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0066', 'pti_inst_warf1_fine_vitto', 'pti_obs_01', 0.0, '(score invertito dal template vecchio)');
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0067', 'pti_inst_warf1_fine_vitto', 'pti_obs_02', 8.0, NULL);
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0068', 'pti_inst_warf1_fine_vitto', 'pti_obs_03', 6.0, NULL);
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0069', 'pti_inst_warf1_fine_vitto', 'pti_obs_04', 6.0, NULL);
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0070', 'pti_inst_warf1_fine_vitto', 'pti_obs_05', 8.0, NULL);
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0071', 'pti_inst_warf1_fine_vitto', 'pti_obs_06', 6.0, '(score invertito dal template vecchio)');
-- SKIP row 15 'I giocatori si allontanano dal tavolo?' in sheet 'Fine Vitto': no template match
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0072', 'pti_inst_warf1_fine_vitto', 'pti_obs_07', 7.0, '(score invertito dal template vecchio)');
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0073', 'pti_inst_warf1_fine_vitto', 'pti_obs_08', 1.0, '(score invertito dal template vecchio)');
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0074', 'pti_inst_warf1_fine_vitto', 'pti_obs_09', 6.0, 'La vita finisce alla fine, player elimination (score invertito dal template vecchio)');
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0075', 'pti_inst_warf2_inizio', 'pti_obs_01', 8.0, NULL);
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0076', 'pti_inst_warf2_inizio', 'pti_obs_02', 7.0, 'Casinoso ma mantenuta');
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0077', 'pti_inst_warf2_inizio', 'pti_obs_03', 5.0, 'Alcune scritte sono minuscole');
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0078', 'pti_inst_warf2_inizio', 'pti_obs_04', 8.0, 'Attenzione alta');
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0079', 'pti_inst_warf2_inizio', 'pti_obs_05', 10.0, NULL);
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0080', 'pti_inst_warf2_inizio', 'pti_obs_06', 10.0, NULL);
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0081', 'pti_inst_warf2_inizio', 'pti_obs_07', 6.0, NULL);
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0082', 'pti_inst_warf2_inizio', 'pti_obs_08', 10.0, NULL);
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0083', 'pti_inst_warf2_inizio', 'pti_obs_09', 10.0, NULL);
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0084', 'pti_inst_warf2_inizio', 'pti_obs_10', 10.0, NULL);
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0085', 'pti_inst_warf2_inizio', 'pti_obs_11', 8.0, NULL);
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0086', 'pti_inst_warf2_inizio', 'pti_obs_12', 8.0, NULL);
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0087', 'pti_inst_warf2_inizio', 'pti_obs_13', 8.0, NULL);
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0088', 'pti_inst_warf2_inizio', 'pti_obs_14', 8.0, NULL);
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0089', 'pti_inst_warf2_inizio', 'pti_obs_15', 9.0, NULL);
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0090', 'pti_inst_warf2_inizio', 'pti_obs_16', 8.0, NULL);
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0091', 'pti_inst_warf2_inizio', 'pti_obs_17', 5.0, NULL);
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0092', 'pti_inst_warf2_fine', 'pti_obs_01', 6.0, NULL);
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0093', 'pti_inst_warf2_fine', 'pti_obs_02', 6.0, NULL);
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0094', 'pti_inst_warf2_fine', 'pti_obs_03', 5.0, NULL);
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0095', 'pti_inst_warf2_fine', 'pti_obs_04', 6.0, NULL);
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0096', 'pti_inst_warf2_fine', 'pti_obs_05', 7.0, NULL);
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0097', 'pti_inst_warf2_fine', 'pti_obs_06', 8.0, NULL);
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0098', 'pti_inst_warf2_fine', 'pti_obs_07', 8.0, NULL);
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0099', 'pti_inst_warf2_fine', 'pti_obs_08', 10.0, NULL);
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0100', 'pti_inst_warf2_fine', 'pti_obs_09', 10.0, NULL);
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0101', 'pti_inst_warf2_fine', 'pti_obs_10', 10.0, NULL);
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0102', 'pti_inst_warf2_fine', 'pti_obs_11', 6.0, NULL);
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0103', 'pti_inst_warf2_fine', 'pti_obs_12', 7.0, NULL);
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0104', 'pti_inst_warf2_fine', 'pti_obs_13', 5.0, NULL);
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0105', 'pti_inst_warf2_fine', 'pti_obs_14', 6.0, NULL);
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0106', 'pti_inst_warf2_fine', 'pti_obs_15', 8.0, NULL);
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0107', 'pti_inst_warf2_fine', 'pti_obs_16', 8.0, NULL);
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0108', 'pti_inst_warf2_fine', 'pti_obs_17', 8.0, NULL);
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0109', 'pti_inst_warf2_partecipata', 'pti_obs_01', 8.0, NULL);
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0110', 'pti_inst_warf2_partecipata', 'pti_obs_02', 8.0, NULL);
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0111', 'pti_inst_warf2_partecipata', 'pti_obs_03', 8.0, 'Aumentare Font');
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0112', 'pti_inst_warf2_partecipata', 'pti_obs_04', 8.0, NULL);
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0113', 'pti_inst_warf2_partecipata', 'pti_obs_05', 8.0, NULL);
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0114', 'pti_inst_warf2_partecipata', 'pti_obs_06', 8.0, NULL);
INSERT OR IGNORE INTO playtest_checklist_responses (id, instance_id, item_id, score, comment) VALUES
  ('ptr_0115', 'pti_inst_warf2_partecipata', 'pti_obs_07', 8.0, NULL);

-- ============================================================
-- OBSERVATIONS (Sempre sottocchio)
-- ============================================================
INSERT OR IGNORE INTO playtest_observations (id, session_id, category, text, recorded_at) VALUES
  ('pto_0001', 'pts_monky_1', 'variabili_invisibili', 'Dado invocazione', 1766088000000);
INSERT OR IGNORE INTO playtest_observations (id, session_id, category, text, recorded_at) VALUES
  ('pto_0002', 'pts_monky_1', 'equita', 'Quanto cazzo li facciamo 10 punti', 1766088000000);
INSERT OR IGNORE INTO playtest_observations (id, session_id, category, text, recorded_at) VALUES
  ('pto_0003', 'pts_monky_1', 'variabili_invisibili', 'Regole missione', 1766088000000);
INSERT OR IGNORE INTO playtest_observations (id, session_id, category, text, recorded_at) VALUES
  ('pto_0004', 'pts_monky_1', 'variabili_invisibili', 'Polarità è invisibile', 1766088000000);
INSERT OR IGNORE INTO playtest_observations (id, session_id, category, text, recorded_at) VALUES
  ('pto_0005', 'pts_monky_1', 'variabili_invisibili', 'Punti vita evocazioni', 1766088000000);
INSERT OR IGNORE INTO playtest_observations (id, session_id, category, text, recorded_at) VALUES
  ('pto_0006', 'pts_warf_1', 'variabili_invisibili', 'Dado invocazione', 1764446400000);
INSERT OR IGNORE INTO playtest_observations (id, session_id, category, text, recorded_at) VALUES
  ('pto_0007', 'pts_warf_1', 'equita', 'Quanto cazzo li facciamo 10 punti', 1764446400000);
INSERT OR IGNORE INTO playtest_observations (id, session_id, category, text, recorded_at) VALUES
  ('pto_0008', 'pts_warf_1', 'variabili_invisibili', 'Regole missione', 1764446400000);
INSERT OR IGNORE INTO playtest_observations (id, session_id, category, text, recorded_at) VALUES
  ('pto_0009', 'pts_warf_1', 'variabili_invisibili', 'Polarità è invisibile', 1764446400000);
INSERT OR IGNORE INTO playtest_observations (id, session_id, category, text, recorded_at) VALUES
  ('pto_0010', 'pts_warf_1', 'variabili_invisibili', 'Punti vita evocazioni', 1764446400000);
INSERT OR IGNORE INTO playtest_observations (id, session_id, category, text, recorded_at) VALUES
  ('pto_0011', 'pts_warf_2', 'variabili_invisibili', 'Quando l''archivio è attivo', 1769889600000);

-- ============================================================
-- OMNI COMMENTS
-- ============================================================
INSERT OR IGNORE INTO playtest_omni_comments (id, session_id, category, text, author_name, recorded_at) VALUES
  ('ptom_0001', 'pts_monky_1', 'ottimo', 'Volare', NULL, 1766088000000);
INSERT OR IGNORE INTO playtest_omni_comments (id, session_id, category, text, author_name, recorded_at) VALUES
  ('ptom_0002', 'pts_monky_1', 'modificare', 'Riscrivere Radici Fameliche, refuso', NULL, 1766088000000);
INSERT OR IGNORE INTO playtest_omni_comments (id, session_id, category, text, author_name, recorded_at) VALUES
  ('ptom_0003', 'pts_monky_1', 'non_chiaro', 'Regole missione confuse', NULL, 1766088000000);
INSERT OR IGNORE INTO playtest_omni_comments (id, session_id, category, text, author_name, recorded_at) VALUES
  ('ptom_0004', 'pts_monky_1', 'modificare', 'Attenzione bassa al primo turno', NULL, 1766088000000);
INSERT OR IGNORE INTO playtest_omni_comments (id, session_id, category, text, author_name, recorded_at) VALUES
  ('ptom_0005', 'pts_monky_1', 'non_chiaro', 'Simbolo di evasione non chiaro', NULL, 1766088000000);
INSERT OR IGNORE INTO playtest_omni_comments (id, session_id, category, text, author_name, recorded_at) VALUES
  ('ptom_0006', 'pts_monky_1', 'modificare', 'Manca spazio al tavolo', NULL, 1766088000000);
INSERT OR IGNORE INTO playtest_omni_comments (id, session_id, category, text, author_name, recorded_at) VALUES
  ('ptom_0007', 'pts_monky_1', 'non_chiaro', 'Chiarire differenza tra Nemici, entità, elementi scenici', NULL, 1766088000000);
INSERT OR IGNORE INTO playtest_omni_comments (id, session_id, category, text, author_name, recorded_at) VALUES
  ('ptom_0008', 'pts_monky_1', 'modificare', 'Far studiare per bene i propri giocatori all''inizio → formalizzare', NULL, 1766088000000);
INSERT OR IGNORE INTO playtest_omni_comments (id, session_id, category, text, author_name, recorded_at) VALUES
  ('ptom_0009', 'pts_monky_1', 'non_chiaro', 'Condizioni di salto turno (tipo se uccidi un giocatore controllandolo) non sono chiare', NULL, 1766088000000);
INSERT OR IGNORE INTO playtest_omni_comments (id, session_id, category, text, author_name, recorded_at) VALUES
  ('ptom_0010', 'pts_monky_1', 'modificare', 'Aumentare il font sulle carte e scheda', NULL, 1766088000000);
INSERT OR IGNORE INTO playtest_omni_comments (id, session_id, category, text, author_name, recorded_at) VALUES
  ('ptom_0011', 'pts_monky_1', 'modificare', 'Rubare il turno non è divertente', NULL, 1766088000000);
INSERT OR IGNORE INTO playtest_omni_comments (id, session_id, category, text, author_name, recorded_at) VALUES
  ('ptom_0012', 'pts_monky_1', 'modificare', 'La missione è molto debole', NULL, 1766088000000);
INSERT OR IGNORE INTO playtest_omni_comments (id, session_id, category, text, author_name, recorded_at) VALUES
  ('ptom_0013', 'pts_monky_1', 'modificare', 'Aumentare pv → player elimination', NULL, 1766088000000);
INSERT OR IGNORE INTO playtest_omni_comments (id, session_id, category, text, author_name, recorded_at) VALUES
  ('ptom_0014', 'pts_warf_1', 'ottimo', 'Volare', NULL, 1764446400000);
INSERT OR IGNORE INTO playtest_omni_comments (id, session_id, category, text, author_name, recorded_at) VALUES
  ('ptom_0015', 'pts_warf_1', 'modificare', 'Riscrivere Radici Fameliche, refuso', NULL, 1764446400000);
INSERT OR IGNORE INTO playtest_omni_comments (id, session_id, category, text, author_name, recorded_at) VALUES
  ('ptom_0016', 'pts_warf_1', 'non_chiaro', 'Regole missione confuse', NULL, 1764446400000);
INSERT OR IGNORE INTO playtest_omni_comments (id, session_id, category, text, author_name, recorded_at) VALUES
  ('ptom_0017', 'pts_warf_1', 'modificare', 'Attenzione bassa al primo turno', NULL, 1764446400000);
INSERT OR IGNORE INTO playtest_omni_comments (id, session_id, category, text, author_name, recorded_at) VALUES
  ('ptom_0018', 'pts_warf_1', 'non_chiaro', 'Simbolo di evasione non chiaro', NULL, 1764446400000);
INSERT OR IGNORE INTO playtest_omni_comments (id, session_id, category, text, author_name, recorded_at) VALUES
  ('ptom_0019', 'pts_warf_1', 'modificare', 'Manca spazio al tavolo', NULL, 1764446400000);
INSERT OR IGNORE INTO playtest_omni_comments (id, session_id, category, text, author_name, recorded_at) VALUES
  ('ptom_0020', 'pts_warf_1', 'non_chiaro', 'Chiarire differenza tra Nemici, entità, elementi scenici', NULL, 1764446400000);
INSERT OR IGNORE INTO playtest_omni_comments (id, session_id, category, text, author_name, recorded_at) VALUES
  ('ptom_0021', 'pts_warf_1', 'modificare', 'Far studiare per bene i propri giocatori all''inizio → formalizzare', NULL, 1764446400000);
INSERT OR IGNORE INTO playtest_omni_comments (id, session_id, category, text, author_name, recorded_at) VALUES
  ('ptom_0022', 'pts_warf_1', 'non_chiaro', 'Condizioni di salto turno (tipo se uccidi un giocatore controllandolo) non sono chiare', NULL, 1764446400000);
INSERT OR IGNORE INTO playtest_omni_comments (id, session_id, category, text, author_name, recorded_at) VALUES
  ('ptom_0023', 'pts_warf_1', 'modificare', 'Aumentare il font sulle carte e scheda', NULL, 1764446400000);
INSERT OR IGNORE INTO playtest_omni_comments (id, session_id, category, text, author_name, recorded_at) VALUES
  ('ptom_0024', 'pts_warf_1', 'modificare', 'Rubare il turno non è divertente', NULL, 1764446400000);
INSERT OR IGNORE INTO playtest_omni_comments (id, session_id, category, text, author_name, recorded_at) VALUES
  ('ptom_0025', 'pts_warf_1', 'modificare', 'La missione è molto debole', NULL, 1764446400000);
INSERT OR IGNORE INTO playtest_omni_comments (id, session_id, category, text, author_name, recorded_at) VALUES
  ('ptom_0026', 'pts_warf_1', 'modificare', 'Aumentare pv → player elimination', NULL, 1764446400000);
INSERT OR IGNORE INTO playtest_omni_comments (id, session_id, category, text, author_name, recorded_at) VALUES
  ('ptom_0027', 'pts_warf_2', 'non_chiaro', 'Cosa viene soppresso se si sopprime il tratto principale', NULL, 1769889600000);
INSERT OR IGNORE INTO playtest_omni_comments (id, session_id, category, text, author_name, recorded_at) VALUES
  ('ptom_0028', 'pts_warf_2', 'non_chiaro', 'Riscrivere genesi', NULL, 1769889600000);

-- ============================================================
-- DISTRACTIONS (WarFables PT #2 only)
-- ============================================================
INSERT OR IGNORE INTO playtest_distractions (id, session_id, type, count) VALUES
  ('ptd_warf2_1', 'pts_warf_2', 'Controlli al cellulare', 3);
INSERT OR IGNORE INTO playtest_distractions (id, session_id, type, count) VALUES
  ('ptd_warf2_2', 'pts_warf_2', 'Alzarsi dal tavolo', 0);
INSERT OR IGNORE INTO playtest_distractions (id, session_id, type, count) VALUES
  ('ptd_warf2_3', 'pts_warf_2', 'Esultazioni', 1);
