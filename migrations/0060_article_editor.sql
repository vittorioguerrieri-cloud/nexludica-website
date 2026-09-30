-- Curatore del resoconto: chi ha scritto e rifinito l'articolo, figura distinta
-- dal relatore (speaker) che ha tenuto il talk. Mostrato come "a cura di".
ALTER TABLE meetludica_articles ADD COLUMN editor TEXT;
