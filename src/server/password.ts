/**
 * Hashing password con PBKDF2-SHA-256 (Web Crypto API).
 *
 * Formato hash salvato: "pbkdf2$<iter>$<salt_b64>$<hash_b64>"
 * - iter: 100000 (default OWASP 2024 per PBKDF2-SHA-256)
 * - salt: 16 byte random
 * - hash: 32 byte derivati
 *
 * Tempo costante per il confronto via crypto.subtle.timingSafeEqual non
 * c'e' nei Workers; usiamo un compare manuale costante in tempo.
 */

const ITERATIONS = 100_000;
const SALT_BYTES = 16;
const KEY_BYTES = 32;

function bytesToB64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function pbkdf2(
  password: string,
  salt: Uint8Array,
  iter: number,
  keyBytes: number,
): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: iter, hash: "SHA-256" },
    keyMaterial,
    keyBytes * 8,
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = new Uint8Array(SALT_BYTES);
  crypto.getRandomValues(salt);
  const hash = await pbkdf2(password, salt, ITERATIONS, KEY_BYTES);
  return `pbkdf2$${ITERATIONS}$${bytesToB64(salt)}$${bytesToB64(hash)}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iter = Number(parts[1]);
  const salt = b64ToBytes(parts[2]);
  const expected = b64ToBytes(parts[3]);
  if (!Number.isFinite(iter) || iter < 1) return false;
  const computed = await pbkdf2(password, salt, iter, expected.length);
  // Constant-time compare
  if (computed.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < computed.length; i++) diff |= computed[i] ^ expected[i];
  return diff === 0;
}

/**
 * Validazione minima della password (frontend e backend).
 */
export function validatePasswordStrength(password: string): string | null {
  if (password.length < 8) return "La password deve essere di almeno 8 caratteri.";
  if (password.length > 200) return "Password troppo lunga.";
  return null;
}
