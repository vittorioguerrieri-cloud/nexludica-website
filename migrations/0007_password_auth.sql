-- Aggiunge supporto autenticazione con password.
-- password_hash: stringa formato "pbkdf2$iter$salt_b64$hash_b64"
-- L'utente puo' scegliere se usare magic link o password.
ALTER TABLE users ADD COLUMN password_hash TEXT;
