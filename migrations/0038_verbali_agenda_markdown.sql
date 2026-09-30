-- Aggiunge `agenda_markdown` al verbale: contenuto markdown raw che, se
-- presente, sostituisce il blocco strutturato `agenda_items` durante il
-- rendering. Toggle nella UI: l'utente sceglie tra modalità "strutturata"
-- (item con titolo/discussione/decisione) e "markdown libero" (testo
-- formattato direttamente).

ALTER TABLE verbali ADD COLUMN agenda_markdown TEXT;
