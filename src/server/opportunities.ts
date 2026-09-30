/**
 * Calendario bandi e conferenze (area soci).
 */
import { now, uuid } from "./db";

export type OppKind = "bando" | "conferenza" | "evento";
const VALID_KINDS = ["bando", "conferenza", "evento"];

export interface Opportunity {
  id: string;
  kind: OppKind;
  title: string;
  organization: string | null;
  eventDate: string | null;   // YYYY-MM-DD
  endDate: string | null;
  url: string | null;
  location: string | null;
  amount: string | null;
  notes: string | null;
  archived: boolean;
  createdAt: number;
  createdBy: string | null;
}

function rowTo(r: Record<string, unknown>): Opportunity {
  return {
    id: String(r.id),
    kind: r.kind as OppKind,
    title: String(r.title),
    organization: (r.organization as string) ?? null,
    eventDate: (r.event_date as string) ?? null,
    endDate: (r.end_date as string) ?? null,
    url: (r.url as string) ?? null,
    location: (r.location as string) ?? null,
    amount: (r.amount as string) ?? null,
    notes: (r.notes as string) ?? null,
    archived: Boolean(r.archived),
    createdAt: Number(r.created_at),
    createdBy: (r.created_by as string) ?? null,
  };
}

export async function listOpportunities(db: D1Database): Promise<Opportunity[]> {
  const { results } = await db
    .prepare("SELECT * FROM opportunities ORDER BY event_date IS NULL, event_date ASC, created_at DESC")
    .all();
  return (results ?? []).map((r) => rowTo(r as Record<string, unknown>));
}

export interface OppInput {
  kind: OppKind;
  title: string;
  organization?: string | null;
  eventDate?: string | null;
  endDate?: string | null;
  url?: string | null;
  location?: string | null;
  amount?: string | null;
  notes?: string | null;
}

export async function createOpportunity(db: D1Database, input: OppInput, userId: string): Promise<Opportunity> {
  const id = "opp_" + uuid().replace(/-/g, "").slice(0, 14);
  const t = now();
  const title = input.title.trim().slice(0, 250);
  if (!title) throw new Error("Titolo obbligatorio");
  if (!VALID_KINDS.includes(input.kind)) throw new Error("Tipo non valido");
  await db
    .prepare(
      `INSERT INTO opportunities (id, kind, title, organization, event_date, end_date, url, location, amount, notes, archived, created_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    )
    .bind(
      id, input.kind, title,
      input.organization?.trim() || null, input.eventDate || null, input.endDate || null,
      input.url?.trim() || null, input.location?.trim() || null, input.amount?.trim() || null,
      input.notes?.trim() || null, t, userId,
    )
    .run();
  return (await getOpportunity(db, id))!;
}

export async function getOpportunity(db: D1Database, id: string): Promise<Opportunity | null> {
  const r = await db.prepare("SELECT * FROM opportunities WHERE id = ?").bind(id).first();
  return r ? rowTo(r as Record<string, unknown>) : null;
}

export async function updateOpportunity(
  db: D1Database,
  id: string,
  fields: Partial<OppInput> & { archived?: boolean },
): Promise<boolean> {
  const sets: string[] = []; const vals: unknown[] = [];
  const set = (c: string, v: unknown) => { sets.push(`${c} = ?`); vals.push(v); };
  if (fields.kind !== undefined && VALID_KINDS.includes(fields.kind)) set("kind", fields.kind);
  if (fields.title !== undefined) set("title", fields.title.trim().slice(0, 250));
  if (fields.organization !== undefined) set("organization", fields.organization?.trim() || null);
  if (fields.eventDate !== undefined) set("event_date", fields.eventDate || null);
  if (fields.endDate !== undefined) set("end_date", fields.endDate || null);
  if (fields.url !== undefined) set("url", fields.url?.trim() || null);
  if (fields.location !== undefined) set("location", fields.location?.trim() || null);
  if (fields.amount !== undefined) set("amount", fields.amount?.trim() || null);
  if (fields.notes !== undefined) set("notes", fields.notes?.trim() || null);
  if (fields.archived !== undefined) set("archived", fields.archived ? 1 : 0);
  if (sets.length === 0) return false;
  vals.push(id);
  const res = await db.prepare(`UPDATE opportunities SET ${sets.join(", ")} WHERE id = ?`).bind(...vals).run();
  return !!res.meta && res.meta.changes > 0;
}

export async function deleteOpportunity(db: D1Database, id: string): Promise<boolean> {
  const res = await db.prepare("DELETE FROM opportunities WHERE id = ?").bind(id).run();
  return !!res.meta && res.meta.changes > 0;
}
