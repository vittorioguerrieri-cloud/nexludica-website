-- Playtest: fase di debriefing + override sessione.
--
-- 1. teams_override_json: opzionale, sostituisce cfg.teams del gioco per
--    questa sessione (es. partita "Devs vs Designers" invece di "Divini/Profani").
-- 2. report_data_json: struttura del report finale (criticità, cose poco chiare,
--    narrative summary, ecc.) compilata in fase di debriefing.

ALTER TABLE playtest_sessions ADD COLUMN teams_override_json TEXT;
ALTER TABLE playtest_sessions ADD COLUMN report_data_json TEXT;

-- Tabella per i "suggerimenti pronti" che gli osservatori possono aggiungere
-- al report con un click. Libreria globale, riusabile da tutte le sessioni.
-- Gli admin possono estenderla; per ora seediamo una libreria iniziale.
CREATE TABLE IF NOT EXISTS playtest_report_suggestions (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL CHECK (category IN ('criticita', 'cose_poco_chiare')),
  problema TEXT NOT NULL,                      -- la frase del problema
  soluzione TEXT NOT NULL,                     -- la soluzione proposta
  tags TEXT,                                    -- CSV opzionale per filtro
  position INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1
);

-- Seed libreria suggerimenti (15 problemi comuni con soluzioni)
INSERT OR IGNORE INTO playtest_report_suggestions (id, category, problema, soluzione, tags, position) VALUES
  ('ptr_001', 'criticita',        'Tempo di setup eccessivo',                                    'Pre-organizzare i componenti in vassoi o setup partial pre-stampato',         'setup,tempo',           10),
  ('ptr_002', 'criticita',        'Down-time elevato tra i turni',                               'Introdurre azioni simultanee o reattive durante il turno avversario',         'ritmo,downtime',        20),
  ('ptr_003', 'criticita',        'Asimmetria iniziale percepita come ingiusta',                 'Aggiungere fase di drafting o compensazioni di partenza',                     'bilanciamento',         30),
  ('ptr_004', 'criticita',        'Una sola strategia dominante',                                'Bilanciare risorse / aggiungere counter-strategie / nerf strategia esistente','bilanciamento,strat',   40),
  ('ptr_005', 'criticita',        'Paralisi da analisi nei turni avanzati',                      'Limitare opzioni per turno o introdurre timer soft',                          'ritmo,paralisi',        50),
  ('ptr_006', 'criticita',        'Player elimination prematura riduce engagement',              'Rimuovere eliminazione o introdurre meccaniche di rientro',                   'engagement',            60),
  ('ptr_007', 'criticita',        'Picchi di tensione assenti / curva piatta',                   'Introdurre eventi a metà partita o accelerazione punteggi nel finale',        'emozioni,curva',        70),
  ('ptr_008', 'criticita',        'Area di gioco invade lo spazio del giocatore',                'Ridurre footprint componenti o usare schede tascabili',                       'ergonomia',             80),
  ('ptr_009', 'criticita',        'Iconografia non intuitiva',                                    'Sostituire icone con testo breve o aggiungere reference card',                'ergonomia,UX',          90),
  ('ptr_010', 'criticita',        'Font o caratteri troppo piccoli sulle carte',                 'Aumentare dimensione font (min 10pt) o ridurre testo per carta',              'ergonomia,UX',         100),
  ('ptr_011', 'cose_poco_chiare', 'Regola della missione/obiettivo non chiara',                  'Riscrivere la regola con esempio concreto + diagramma',                       'regole,UX',             10),
  ('ptr_012', 'cose_poco_chiare', 'Distinzione tra entità di gioco (nemici/elementi) ambigua',   'Standardizzare terminologia nelle regole e nelle carte',                       'regole,UX',             20),
  ('ptr_013', 'cose_poco_chiare', 'Triggering ordine di risoluzione effetti ambiguo',            'Aggiungere ordine canonico nelle regole (FIFO / priorità tipo)',              'regole',                30),
  ('ptr_014', 'cose_poco_chiare', 'Quando "scartare" vs "rimuovere dal gioco" non è chiaro',     'Codificare con icona o colore standard su tutte le carte',                    'regole,UX',             40),
  ('ptr_015', 'cose_poco_chiare', 'Mancato esempio di setup iniziale nelle regole',              'Aggiungere foto del setup completo a inizio rulebook',                        'regole,setup',          50);
