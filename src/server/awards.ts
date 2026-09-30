/**
 * Gestione premi/riconoscimenti dei profili soci.
 *
 * Schema: vedi migrations/0018_member_awards.sql
 */
import { now } from "./db";

export interface AwardRow {
  id: string;
  user_id: string;
  title: string;
  issuer: string | null;
  year: number | null;
  url: string | null;
  description: string | null;
  sort_order: number;
  created_at: number;
  updated_at: number;
}

export interface AwardView {
  id: string;
  userId: string;
  title: string;
  issuer: string | null;
  year: number | null;
  url: string | null;
  description: string | null;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
}

function toView(r: AwardRow): AwardView {
  return {
    id: r.id,
    userId: r.user_id,
    title: r.title,
    issuer: r.issuer,
    year: r.year,
    url: r.url,
    description: r.description,
    sortOrder: r.sort_order,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function listAwardsByUser(
  db: D1Database,
  userId: string,
): Promise<AwardView[]> {
  const rs = await db
    .prepare(
      `SELECT * FROM member_awards
       WHERE user_id = ?
       ORDER BY COALESCE(year, 0) DESC, sort_order ASC, created_at DESC`,
    )
    .bind(userId)
    .all<AwardRow>();
  return (rs.results ?? []).map(toView);
}

export interface AwardInput {
  title: string;
  issuer?: string | null;
  year?: number | null;
  url?: string | null;
  description?: string | null;
  sortOrder?: number;
}

function sanitize(input: AwardInput) {
  const trim = (s: string | null | undefined, max: number) =>
    s == null ? null : (String(s).trim().slice(0, max) || null);
  let year: number | null = null;
  if (input.year != null) {
    const n = Number(input.year);
    if (Number.isFinite(n) && n > 1500 && n < 2200) year = Math.round(n);
  }
  return {
    title: trim(input.title, 300) ?? "",
    issuer: trim(input.issuer, 300),
    year,
    url: trim(input.url, 500),
    description: trim(input.description, 2000),
    sortOrder: Number.isFinite(Number(input.sortOrder)) ? Number(input.sortOrder) : 100,
  };
}

export async function addAward(
  db: D1Database,
  userId: string,
  input: AwardInput,
): Promise<AwardView> {
  const id = crypto.randomUUID();
  const data = sanitize(input);
  if (!data.title) throw new Error("Il titolo del premio e' obbligatorio");
  const ts = now();
  await db
    .prepare(
      `INSERT INTO member_awards
        (id, user_id, title, issuer, year, url, description, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id, userId, data.title, data.issuer, data.year,
      data.url, data.description, data.sortOrder, ts, ts,
    )
    .run();
  return {
    id, userId, title: data.title, issuer: data.issuer, year: data.year,
    url: data.url, description: data.description,
    sortOrder: data.sortOrder, createdAt: ts, updatedAt: ts,
  };
}

export async function updateAward(
  db: D1Database,
  userId: string,
  id: string,
  input: AwardInput,
): Promise<AwardView | null> {
  const data = sanitize(input);
  if (!data.title) throw new Error("Il titolo del premio e' obbligatorio");
  const res = await db
    .prepare(
      `UPDATE member_awards
       SET title = ?, issuer = ?, year = ?, url = ?, description = ?,
           sort_order = ?, updated_at = ?
       WHERE id = ? AND user_id = ?`,
    )
    .bind(
      data.title, data.issuer, data.year, data.url, data.description,
      data.sortOrder, now(), id, userId,
    )
    .run();
  if (!res.meta || res.meta.changes === 0) return null;
  const row = await db
    .prepare("SELECT * FROM member_awards WHERE id = ?")
    .bind(id)
    .first<AwardRow>();
  return row ? toView(row) : null;
}

export async function deleteAward(
  db: D1Database,
  userId: string,
  id: string,
): Promise<boolean> {
  const res = await db
    .prepare("DELETE FROM member_awards WHERE id = ? AND user_id = ?")
    .bind(id, userId)
    .run();
  return !!res.meta && res.meta.changes > 0;
}
