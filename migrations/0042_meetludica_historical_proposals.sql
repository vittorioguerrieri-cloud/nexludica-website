-- Nel repository pubblico le email dei relatori sono state sostituite con un
-- segnaposto: i dati reali stanno solo nel database di produzione.
-- Inserisce 5 proposte di talk pregresse raccolte prima dell'apertura formale del form.
-- created_at: timestamp Unix in millisecondi (orario locale CET, UTC+1 a gennaio/febbraio 2026).
-- status: 'pending' (verranno valutate manualmente).

INSERT INTO meetludica_proposals (id, name, email, talk_title, abstract, ip_hash, status, created_at) VALUES
(
  '98432668-cd68-43e1-bb2d-4f6479e659a0',
  'Fabrizio Parodi',
  'fabrizio.parodi@unige.it',
  'I primi 20 minuti',
  'Gioco che ripercorre i primi 20 minuti dell''universo.

Disponibilita'' indicata: "Non e'' facile prevederlo con largo anticipo".',
  NULL,
  'pending',
  1772271527000
),
(
  '531be89a-f70c-457e-a2fb-babed7bec76d',
  'Umberto Marchetti',
  'indirizzo-rimosso@example.invalid',
  NULL,
  'Proposta di talk su un gioco di ruolo educativo dedicato a educazione civica, legalita'' e antimafia, con playtest svolti in scuole secondarie.

Disponibilita'' indicata: "Tutti liberi".',
  NULL,
  'pending',
  1769719725000
),
(
  '6fc38c64-1357-4236-9b58-a127e5016df5',
  'Giannandrea Inchingolo',
  'indirizzo-rimosso@example.invalid',
  'AstroGBL con i docenti',
  'Presentazione dei progetti PIXEL e COSMO HUNTERS realizzati per INAF, con focus sull''uso del Game-Based Learning astronomico nella formazione docenti.

Disponibilita'' indicata: "Garantisco fino a maggio, poi per l''estate non so ancora".',
  NULL,
  'pending',
  1770716025000
),
(
  '09d8d40b-da08-4ab1-ad66-8b3476398a25',
  'Eus Attico',
  'eustachio.attico@unimore.it',
  NULL,
  'Proposta di talk sui BioBoardGames per l''educazione alla biologia.

Disponibilita'' indicata: "Al momento credo di no".',
  NULL,
  'pending',
  1769718308000
),
(
  'd91e3eb1-d41a-4d6a-b26a-16bc599c6cbd',
  'Daniele Aurelio',
  'danieleaurelio@gmail.com',
  'Matematica dei giochi',
  'Talk sulla teoria dei giochi combinatori: Sprouts, NIM, Hackenbush, somma-nim, Wythoff, numeri di Grundy.

Disponibilita'' indicata: "Non a priori!".',
  NULL,
  'pending',
  1770722869000
);
