-- Playtest Gradimento: studio + questionario dedicato per il post-partita.
--
-- Studio "playtest-gradimento" con un unico questionario "gradimento".
-- I giocatori lo compilano dopo la partita via
--   research.nexludica.org/playtest-gradimento/gradimento?session=<session_id>
--
-- Il session_id viene letto dal client dalla query string e iniettato nel
-- payload della response (`session_id`). L'aggregazione gradimento per
-- sessione è calcolata server-side dal report API.
--
-- Identity fields: nessuno (il questionario è anonimo, l'ancoraggio alla
-- sessione passa dal session_id in URL, non da un codice identità).

INSERT OR REPLACE INTO research_studies
  (id, slug, title, description, status, public_listing,
   anonymous_code_template, identity_fields, theme_json,
   created_at, updated_at, created_by)
VALUES (
  '00000000-0000-4000-8000-200000000001',
  'playtest-gradimento',
  'Playtest — Questionario Gradimento',
  'Questionario post-partita compilato dai giocatori al termine di ogni sessione di playtest NexLudica. 10 item Likert su scala 1-7 (con item invertiti per controllare bias di acquiescenza) + 1 item sulla durata percepita. I risultati alimentano automaticamente il report di sessione.',
  'active',
  0,
  NULL,
  NULL,
  NULL,
  unixepoch()*1000,
  unixepoch()*1000,
  NULL
);

INSERT OR REPLACE INTO research_questionnaires
  (id, study_id, slug, title, description, schema_json,
   position, status, version, created_at, updated_at)
VALUES (
  '00000000-0000-4000-8000-200000000010',
  '00000000-0000-4000-8000-200000000001',
  'gradimento',
  'Gradimento — post-partita',
  'Rispondi pensando alla partita appena giocata. Non ci sono risposte giuste o sbagliate, i dati sono anonimi. Tempo stimato: 2 minuti.',
  '{"title":"Questionario Gradimento — Playtest NexLudica","description":"Le tue impressioni dopo la partita. I dati sono anonimi.","showProgressBar":"off","showQuestionNumbers":"off","locale":"it","completedHtml":"<div style=\"padding:24px;text-align:center;\"><h3 style=\"color:#05abc4;\">Grazie!</h3><p>Le tue risposte sono state inviate. Buon proseguimento.</p></div>","pages":[{"name":"intro","title":"Le tue impressioni","description":"Rispondi pensando alla partita appena giocata.","elements":[{"type":"matrix","name":"gradimento","title":"Indica quanto sei d''accordo con ciascuna affermazione","isAllRowRequired":true,"columns":[{"value":1,"text":"1 — Per niente"},{"value":2,"text":"2"},{"value":3,"text":"3"},{"value":4,"text":"4 — Neutro"},{"value":5,"text":"5"},{"value":6,"text":"6"},{"value":7,"text":"7 — Totalmente"}],"rows":[{"value":"g01","text":"La partita mi è sembrata durare molto meno del tempo effettivo trascorso."},{"value":"g02_r","text":"Anche se ne avessi la possibilità ora, non inizierei subito un''altra partita a questo gioco; preferirei cambiarlo."},{"value":"g03_r","text":"Non proporrei questo gioco al mio gruppo abituale."},{"value":"g04","text":"Ho percepito che il risultato finale è stato determinato principalmente dalle mie scelte."},{"value":"g05_r","text":"Durante i turni degli avversari tendevo a distrarmi."},{"value":"g06","text":"In questo momento sto già pensando a una strategia diversa che vorrei tentare in una prossima partita."},{"value":"g07_r","text":"Concentrandomi sulla mia strategia dovevo interrompere il flusso per chiarire regole o interpretare icone."},{"value":"g08","text":"Sento di aver compreso le meccaniche a sufficienza da poter migliorare significativamente la prossima volta."},{"value":"g09","text":"Durante la partita ho vissuto momenti di forte intensità emotiva (tensione, sorpresa o esaltazione)."},{"value":"g10_r","text":"Se vedessi questo gioco sullo scaffale al prezzo standard di mercato credo lo scarterei."}]},{"type":"text","name":"perceived_minutes","title":"Quanto ti sembra sia durata la partita? (in minuti)","description":"Tira a indovinare se non hai guardato l''ora durante la partita.","inputType":"number","min":1,"max":600}]}]}',
  0,
  'active',
  1,
  unixepoch()*1000,
  unixepoch()*1000
);
