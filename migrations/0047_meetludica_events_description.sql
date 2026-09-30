-- Abstract/descrizione pubblica di una serata MeetLudica, mostrata nel
-- calendario pubblico mano a mano che gli incontri vengono fissati.
-- (notes resta la nota interna admin; description è il testo pubblico.)

ALTER TABLE meetludica_events ADD COLUMN description TEXT;
