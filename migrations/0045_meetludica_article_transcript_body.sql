-- Articoli MeetLudica: aggiunge il transcript integrale (fonte) e il corpo
-- dell'articolo formattato (markdown), generato dal transcript.
--   transcript: testo grezzo corretto della registrazione (pubblico collassabile)
--   body:       articolo formattato in markdown, reso sia on-site sia come PDF
-- L'abstract resta come riepilogo breve mostrato in archivio.

ALTER TABLE meetludica_articles ADD COLUMN transcript TEXT;
ALTER TABLE meetludica_articles ADD COLUMN body TEXT;
