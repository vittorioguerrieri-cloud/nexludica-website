-- Email ufficiale @nexludica.org (opzionale). L'email privata resta in users.email
-- (usata anche per il login). L'ufficiale la aggiunge la persona dal profilo o un admin.
ALTER TABLE users ADD COLUMN email_nexludica TEXT;
