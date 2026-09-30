-- Link della videochiamata di ciascuna serata MeetLudica, mostrato sul sito
-- accanto all'appuntamento. Le serate nuove ereditano l'ultimo link usato.
ALTER TABLE meetludica_events ADD COLUMN meeting_url TEXT;
UPDATE meetludica_events SET meeting_url = 'https://meet.google.com/cqt-mtka-imi'
  WHERE location LIKE '%Meet%' OR location LIKE 'Online%';
