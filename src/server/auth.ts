/**
 * Sistema di autenticazione passwordless con magic link.
 *
 * Flow:
 * 1. POST /api/auth/request-link {email}
 *    - se l'email corrisponde a un socio (users.active=1), genera token
 *    - invia magic link via email (in dev: log su console)
 * 2. GET /api/auth/verify?token=xxx
 *    - valida token, crea sessione, set cookie httpOnly, redirect /area-soci
 * 3. POST /api/auth/logout
 *    - invalida sessione, clear cookie
 */

import type { APIContext } from "astro";
import { getDb, getEnv, now, secureToken, uuid } from "./db";
import type { UserRow, UserRole } from "./db";
import { hashPassword, verifyPassword } from "./password";

const SESSION_COOKIE = "nx_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 giorni
const MAGIC_LINK_TTL_MS = 15 * 60 * 1000; // 15 minuti

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

/**
 * Crea un nuovo magic link per l'utente specificato.
 * Restituisce il token (da inserire nell'URL del magic link).
 */
export async function createMagicLink(
  db: D1Database,
  userId: string,
): Promise<string> {
  const token = secureToken(32);
  const expiresAt = now() + MAGIC_LINK_TTL_MS;
  await db
    .prepare(
      "INSERT INTO magic_links (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
    )
    .bind(token, userId, expiresAt, now())
    .run();
  return token;
}

/**
 * Consuma un magic link: lo marca usato e restituisce lo user_id.
 * Ritorna null se token mancante, scaduto o gia' usato.
 */
export async function consumeMagicLink(
  db: D1Database,
  token: string,
): Promise<string | null> {
  const row = await db
    .prepare(
      "SELECT user_id, expires_at, used_at FROM magic_links WHERE token = ?",
    )
    .bind(token)
    .first<{
      user_id: string;
      expires_at: number;
      used_at: number | null;
    }>();
  if (!row) return null;
  if (row.used_at) return null;
  if (row.expires_at < now()) return null;

  // Mark as used (atomic via UPDATE...WHERE used_at IS NULL)
  const upd = await db
    .prepare("UPDATE magic_links SET used_at = ? WHERE token = ? AND used_at IS NULL")
    .bind(now(), token)
    .run();
  if (!upd.meta.changes) return null;

  return row.user_id;
}

/**
 * Crea una sessione e restituisce l'id (= cookie value).
 */
export async function createSession(
  db: D1Database,
  userId: string,
  userAgent: string | null,
): Promise<string> {
  const id = secureToken(32);
  const expiresAt = now() + SESSION_TTL_MS;
  await db
    .prepare(
      "INSERT INTO sessions (id, user_id, expires_at, created_at, user_agent) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(id, userId, expiresAt, now(), userAgent)
    .run();
  await db
    .prepare("UPDATE users SET last_login_at = ? WHERE id = ?")
    .bind(now(), userId)
    .run();
  return id;
}

/**
 * Distrugge la sessione data.
 */
export async function destroySession(db: D1Database, sessionId: string): Promise<void> {
  await db.prepare("DELETE FROM sessions WHERE id = ?").bind(sessionId).run();
}

/**
 * Carica l'utente associato a una sessione, o null se sessione assente/scaduta.
 */
export async function loadSessionUser(
  db: D1Database,
  sessionId: string,
): Promise<SessionUser | null> {
  // I soci con membership_status='pending' o 'suspended' non possono
  // accedere all'area soci finche' l'admin non li approva. Quelli 'former'
  // sono ex-soci che possono continuare a loggarsi solo come collaborator
  // (gestito a livello applicativo se serve).
  const row = await db
    .prepare(
      `SELECT u.id as id, u.email as email, u.name as name, u.role as role, s.expires_at as expires_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN member_data md ON md.user_id = u.id
       WHERE s.id = ? AND u.active = 1
         AND COALESCE(md.membership_status, 'active') NOT IN ('pending', 'suspended')`,
    )
    .bind(sessionId)
    .first<{
      id: string;
      email: string;
      name: string;
      role: UserRole;
      expires_at: number;
    }>();
  if (!row) return null;
  if (row.expires_at < now()) {
    // garbage collect
    await db.prepare("DELETE FROM sessions WHERE id = ?").bind(sessionId).run();
    return null;
  }
  return { id: row.id, email: row.email, name: row.name, role: row.role };
}

export function getSessionCookieName(): string {
  return SESSION_COOKIE;
}

/**
 * Determina il Domain del cookie a partire dall'host della request.
 * Se siamo su un host di nexludica.org (root o subdomain), torniamo
 * ".nexludica.org" cosi' il cookie e' valido cross-subdomain (utile per
 * playtest.nexludica.org, research.nexludica.org, ecc.). Altrimenti
 * torniamo null e il cookie resta host-scoped (utile in dev su localhost).
 */
function cookieDomainForHost(host: string | null | undefined): string | null {
  if (!host) return null;
  // Rimuovi eventuale porta
  const h = host.split(":")[0].toLowerCase();
  if (h === "nexludica.org" || h.endsWith(".nexludica.org")) {
    return ".nexludica.org";
  }
  return null;
}

/**
 * Imposta il cookie di sessione sulla response.
 * `host` opzionale: se fornito, il cookie viene scoped a .nexludica.org
 * cosi' funziona cross-subdomain (playtest, research, area-soci, ecc.).
 */
export function setSessionCookie(
  headers: Headers,
  sessionId: string,
  secure = true,
  host?: string | null,
): void {
  const parts = [
    `${SESSION_COOKIE}=${sessionId}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
  ];
  const domain = cookieDomainForHost(host);
  if (domain) parts.push(`Domain=${domain}`);
  if (secure) parts.push("Secure");
  headers.append("Set-Cookie", parts.join("; "));
}

export function clearSessionCookie(headers: Headers, secure = true, host?: string | null): void {
  const parts = [
    `${SESSION_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
  ];
  const domain = cookieDomainForHost(host);
  if (domain) parts.push(`Domain=${domain}`);
  if (secure) parts.push("Secure");
  headers.append("Set-Cookie", parts.join("; "));
}

/**
 * Legge il cookie di sessione dalla request.
 */
export function readSessionCookie(request: Request): string | null {
  const cookieHeader = request.headers.get("Cookie");
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(";");
  for (const p of parts) {
    const [k, ...v] = p.trim().split("=");
    if (k === SESSION_COOKIE) return v.join("=");
  }
  return null;
}

/**
 * Helper Astro: carica l'utente dal cookie. Difensivo: ritorna null su
 * qualunque errore (env mancante, DB binding mancante, query fallita).
 */
export async function loadUserFromContext(ctx: APIContext): Promise<SessionUser | null> {
  try {
    const sid = readSessionCookie(ctx.request);
    if (!sid) return null;
    const env = await getEnv();
    const db = getDb(env as Env);
    if (!db) return null;
    return await loadSessionUser(db, sid);
  } catch {
    return null;
  }
}

/**
 * Trova un utente per email (lowercase).
 */
export async function findUserByEmail(
  db: D1Database,
  email: string,
): Promise<UserRow | null> {
  // Anche qui escludiamo pending/suspended cosi' che il magic link non
  // venga inviato a un socio non-approvato (verrebbe inviato ma il login
  // fallirebbe comunque, meglio bloccare prima).
  const row = await db
    .prepare(
      `SELECT u.* FROM users u
       LEFT JOIN member_data md ON md.user_id = u.id
       WHERE LOWER(u.email) = LOWER(?) AND u.active = 1
         AND COALESCE(md.membership_status, 'active') NOT IN ('pending', 'suspended')`,
    )
    .bind(email.trim())
    .first<UserRow>();
  return row ?? null;
}

/**
 * Imposta o aggiorna la password dell'utente.
 * Hash con PBKDF2-SHA-256 100k.
 */
export async function setPassword(
  db: D1Database,
  userId: string,
  password: string,
): Promise<void> {
  const hash = await hashPassword(password);
  await db
    .prepare("UPDATE users SET password_hash = ? WHERE id = ?")
    .bind(hash, userId)
    .run();
}

/**
 * Rimuove la password (l'utente potra' loggarsi solo via magic link).
 */
export async function removePassword(db: D1Database, userId: string): Promise<void> {
  await db
    .prepare("UPDATE users SET password_hash = NULL WHERE id = ?")
    .bind(userId)
    .run();
}

/**
 * Login con email + password. Ritorna l'user_id se le credenziali sono
 * valide e l'utente e' attivo, altrimenti null. Risposta uniforme per
 * evitare enumeration.
 */
export async function loginWithPassword(
  db: D1Database,
  email: string,
  password: string,
): Promise<string | null> {
  // Anche qui blocchiamo pending/suspended a livello di login.
  const row = await db
    .prepare(
      `SELECT u.id as id, u.password_hash as password_hash
       FROM users u
       LEFT JOIN member_data md ON md.user_id = u.id
       WHERE LOWER(u.email) = LOWER(?) AND u.active = 1
         AND COALESCE(md.membership_status, 'active') NOT IN ('pending', 'suspended')`,
    )
    .bind(email.trim())
    .first<{ id: string; password_hash: string | null }>();
  if (!row || !row.password_hash) return null;
  const ok = await verifyPassword(password, row.password_hash);
  return ok ? row.id : null;
}

// NB: rimosso createUser() — non era piu' chiamato da nessuna parte
// (sostituito da createMember in server/admin.ts che gestisce anche i
// permessi Drive e i record member_data). Lasciarlo era pericoloso perche'
// non creava il record member_data → utente "mezzo-creato".
