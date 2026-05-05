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
import { getDb, now, secureToken, uuid } from "./db";
import type { UserRow } from "./db";

const SESSION_COOKIE = "nx_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 giorni
const MAGIC_LINK_TTL_MS = 15 * 60 * 1000; // 15 minuti

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: "member" | "admin";
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
  const row = await db
    .prepare(
      `SELECT u.id as id, u.email as email, u.name as name, u.role as role, s.expires_at as expires_at
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.id = ? AND u.active = 1`,
    )
    .bind(sessionId)
    .first<{
      id: string;
      email: string;
      name: string;
      role: "member" | "admin";
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
 * Imposta il cookie di sessione sulla response.
 */
export function setSessionCookie(headers: Headers, sessionId: string, secure = true): void {
  const parts = [
    `${SESSION_COOKIE}=${sessionId}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
  ];
  if (secure) parts.push("Secure");
  headers.append("Set-Cookie", parts.join("; "));
}

export function clearSessionCookie(headers: Headers, secure = true): void {
  const parts = [
    `${SESSION_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
  ];
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
    // @ts-expect-error - env esposta da @astrojs/cloudflare in ctx.locals.runtime.env
    const env: Env | undefined = ctx.locals?.runtime?.env;
    const db = env ? getDb(env) : null;
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
  const row = await db
    .prepare("SELECT * FROM users WHERE LOWER(email) = LOWER(?) AND active = 1")
    .bind(email.trim())
    .first<UserRow>();
  return row ?? null;
}

/**
 * Crea un nuovo utente (usato dall'admin per aggiungere soci).
 */
export async function createUser(
  db: D1Database,
  email: string,
  name: string,
  role: "member" | "admin" = "member",
): Promise<UserRow> {
  const id = uuid();
  await db
    .prepare(
      "INSERT INTO users (id, email, name, role, active, created_at) VALUES (?, ?, ?, ?, 1, ?)",
    )
    .bind(id, email.toLowerCase().trim(), name.trim(), role, now())
    .run();
  // Crea profilo vuoto associato
  await db
    .prepare(
      `INSERT INTO profiles (user_id, display_name, public_visible, sort_order, updated_at)
       VALUES (?, ?, 1, 100, ?)`,
    )
    .bind(id, name.trim(), now())
    .run();
  return {
    id,
    email: email.toLowerCase().trim(),
    name: name.trim(),
    role,
    active: 1,
    created_at: now(),
    last_login_at: null,
  };
}
