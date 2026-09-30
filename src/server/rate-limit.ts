/**
 * Rate limit best-effort basato su tabella `auth_attempts` di D1.
 *
 * Idee:
 *  - Per ogni richiesta sensibile, registriamo un record (ip_hash, kind, ts).
 *  - Per decidere se permettere il proseguimento, contiamo i record di quella
 *    coppia (ip, kind) nell'ultima finestra (windowMs).
 *  - Se il count supera la soglia, ritorniamo `{ ok: false }`.
 *
 * Note:
 *  - L'IP viene preso da `CF-Connecting-IP` (header impostato da Cloudflare)
 *    e mai loggato in chiaro: hashiamo con SHA-256 + salt.
 *  - "best-effort" significa che il check NON e' atomic con la registrazione:
 *    sotto traffico contemporaneo molto alto, il limite puo' essere sforato
 *    di poche unita'. Accettabile per protezione brute-force / spam.
 *  - Fail-open: se la tabella manca o ci sono errori, lasciamo passare e
 *    logghiamo. Mai bloccare utenti legittimi per un errore di infra.
 */
import { now } from "./db";

const SALT = "nx-rate-limit-v1";

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export type AttemptKind = "login" | "magic-link";

export interface RateLimitOpts {
  /** Window in ms (default 1h) */
  windowMs?: number;
  /** Max attempts allowed in the window (default 10) */
  max?: number;
}

/**
 * Controlla se il client puo' procedere. Se non sforato il limite, registra
 * il tentativo e ritorna { ok: true }. Altrimenti ritorna { ok: false, retryAfterMs }.
 */
export async function checkAndRecordAttempt(
  db: D1Database,
  req: Request,
  kind: AttemptKind,
  opts: RateLimitOpts = {},
): Promise<{ ok: true } | { ok: false; retryAfterMs: number }> {
  const windowMs = opts.windowMs ?? 60 * 60 * 1000; // 1h
  const max = opts.max ?? 10;
  const ip = req.headers.get("CF-Connecting-IP") ?? "0.0.0.0";
  const ipHash = await sha256Hex(SALT + ":" + kind + ":" + ip);
  const since = Date.now() - windowMs;
  try {
    const r = await db
      .prepare(
        "SELECT COUNT(*) as n FROM auth_attempts WHERE ip_hash = ? AND kind = ? AND created_at > ?",
      )
      .bind(ipHash, kind, since)
      .first<{ n: number }>();
    const n = r?.n ?? 0;
    if (n >= max) {
      return { ok: false, retryAfterMs: windowMs };
    }
    // Registra il tentativo (non blocca anche se l'INSERT fallisce)
    try {
      await db
        .prepare(
          "INSERT INTO auth_attempts (ip_hash, kind, created_at) VALUES (?, ?, ?)",
        )
        .bind(ipHash, kind, now())
        .run();
    } catch { /* ignore */ }
    return { ok: true };
  } catch (e) {
    // Tabella mancante o errore: fail-open
    console.warn("[rate-limit] check failed (fail-open):", e instanceof Error ? e.message : e);
    return { ok: true };
  }
}
