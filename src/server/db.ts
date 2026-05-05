/**
 * Type definitions per le righe del database D1.
 * I tipi corrispondono allo schema in migrations/0001_init.sql.
 */

export interface UserRow {
  id: string;
  email: string;
  name: string;
  role: "member" | "admin";
  active: number; // 0/1
  created_at: number;
  last_login_at: number | null;
}

export interface ProfileRow {
  user_id: string;
  display_name: string | null;
  role_label: string | null;
  bio: string | null;
  skills: string | null;
  photo_url: string | null;
  website: string | null;
  linkedin: string | null;
  public_visible: number;
  sort_order: number;
  updated_at: number;
}

export interface SessionRow {
  id: string;
  user_id: string;
  expires_at: number;
  created_at: number;
  user_agent: string | null;
}

export interface MagicLinkRow {
  token: string;
  user_id: string;
  expires_at: number;
  used_at: number | null;
  created_at: number;
}

export interface ArticleRow {
  id: string;
  slug: string;
  user_id: string;
  title: string;
  speaker: string;
  meeting_date: string; // YYYY-MM-DD
  abstract: string;
  tags: string | null;
  document_key: string | null;
  document_filename: string | null;
  video_url: string | null;
  status: "draft" | "published" | "archived";
  created_at: number;
  updated_at: number;
}

/**
 * Restituisce un timestamp ms (Date.now()) come INTEGER per SQLite.
 */
export function now(): number {
  return Date.now();
}

/**
 * Genera un UUID v4 random usando Web Crypto API (disponibile nei Workers).
 */
export function uuid(): string {
  return crypto.randomUUID();
}

/**
 * Genera un token sicuro (256 bit base64url) per magic link e sessioni.
 */
export function secureToken(bytes = 32): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  // base64url encoding
  const b64 = btoa(String.fromCharCode(...buf));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Controlla che D1 sia disponibile. In dev senza setup, ritorna null.
 */
export function getDb(env: Env): D1Database | null {
  return env?.DB ?? null;
}
