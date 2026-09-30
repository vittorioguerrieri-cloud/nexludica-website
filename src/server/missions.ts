/**
 * Missioni / trasferte (es. fiere, festival, eventi associativi).
 * Dimensione ortogonale ai progetti: ogni transazione di bilancio puo' essere
 * taggata a una missione (mission_id) oltre che a un progetto (project_id).
 * La spesa di una missione = somma delle transazioni non escluse taggate a essa.
 */
import { uuid, now } from "./db";

export type MissionStatus = "pianificata" | "conclusa";
const VALID_STATUS: MissionStatus[] = ["pianificata", "conclusa"];

/** Categorie di spesa suggerite per le missioni (free text in DB). */
export const MISSION_CATEGORIES = [
  "viaggio",
  "vitto",
  "alloggio",
  "iscrizione",
  "materiali",
  "altro",
] as const;

export interface FinanceMission {
  id: string;
  title: string;
  opportunityId: string | null;
  startDate: string | null;
  endDate: string | null;
  location: string | null;
  budgetEur: number | null;
  status: MissionStatus;
  notes: string | null;
  archived: boolean;
  createdAt: number;
  createdBy: string | null;
}

function rowToMission(r: Record<string, unknown>): FinanceMission {
  return {
    id: String(r.id),
    title: String(r.title),
    opportunityId: (r.opportunity_id as string) ?? null,
    startDate: (r.start_date as string) ?? null,
    endDate: (r.end_date as string) ?? null,
    location: (r.location as string) ?? null,
    budgetEur: r.budget_eur != null ? Number(r.budget_eur) : null,
    status: (r.status as MissionStatus) ?? "pianificata",
    notes: (r.notes as string) ?? null,
    archived: Boolean(r.archived),
    createdAt: Number(r.created_at),
    createdBy: (r.created_by as string) ?? null,
  };
}

export interface MissionInput {
  title: string;
  opportunityId?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  location?: string | null;
  budgetEur?: number | null;
  status?: MissionStatus;
  notes?: string | null;
}

export async function listMissions(db: D1Database): Promise<FinanceMission[]> {
  const rs = await db
    .prepare("SELECT * FROM finance_missions ORDER BY archived ASC, COALESCE(start_date,'') DESC, created_at DESC")
    .all();
  return (rs.results as Record<string, unknown>[]).map(rowToMission);
}

export async function getMission(db: D1Database, id: string): Promise<FinanceMission | null> {
  const r = await db.prepare("SELECT * FROM finance_missions WHERE id = ?").bind(id).first();
  return r ? rowToMission(r as Record<string, unknown>) : null;
}

export async function createMission(db: D1Database, input: MissionInput, userId?: string | null): Promise<FinanceMission> {
  const id = uuid();
  const ts = now();
  const title = input.title.trim().slice(0, 160);
  if (!title) throw new Error("Titolo obbligatorio");
  const status = VALID_STATUS.includes(input.status as MissionStatus) ? input.status! : "pianificata";
  await db
    .prepare(
      `INSERT INTO finance_missions
        (id, title, opportunity_id, start_date, end_date, location, budget_eur, status, notes, archived, created_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    )
    .bind(
      id, title, input.opportunityId || null, input.startDate || null, input.endDate || null,
      input.location?.trim() || null, input.budgetEur ?? null, status, input.notes?.trim() || null,
      ts, userId ?? null,
    )
    .run();
  return (await getMission(db, id))!;
}

export async function updateMission(
  db: D1Database,
  id: string,
  fields: Partial<MissionInput> & { archived?: boolean },
): Promise<boolean> {
  const sets: string[] = []; const vals: unknown[] = [];
  const set = (c: string, v: unknown) => { sets.push(`${c} = ?`); vals.push(v); };
  if (fields.title !== undefined) set("title", fields.title.trim().slice(0, 160));
  if (fields.opportunityId !== undefined) set("opportunity_id", fields.opportunityId || null);
  if (fields.startDate !== undefined) set("start_date", fields.startDate || null);
  if (fields.endDate !== undefined) set("end_date", fields.endDate || null);
  if (fields.location !== undefined) set("location", fields.location?.trim() || null);
  if (fields.budgetEur !== undefined) set("budget_eur", fields.budgetEur ?? null);
  if (fields.status !== undefined && VALID_STATUS.includes(fields.status)) set("status", fields.status);
  if (fields.notes !== undefined) set("notes", fields.notes?.trim() || null);
  if (fields.archived !== undefined) set("archived", fields.archived ? 1 : 0);
  if (sets.length === 0) return false;
  vals.push(id);
  const res = await db.prepare(`UPDATE finance_missions SET ${sets.join(", ")} WHERE id = ?`).bind(...vals).run();
  return !!res.meta && res.meta.changes > 0;
}

export async function deleteMission(db: D1Database, id: string): Promise<boolean> {
  // Le transazioni collegate tornano senza missione e i partecipanti vengono
  // rimossi (l'eventuale FK in D1 non e' enforced di default).
  await db.prepare("UPDATE finance_transactions SET mission_id = NULL WHERE mission_id = ?").bind(id).run();
  await db.prepare("DELETE FROM mission_participants WHERE mission_id = ?").bind(id).run();
  const res = await db.prepare("DELETE FROM finance_missions WHERE id = ?").bind(id).run();
  return !!res.meta && res.meta.changes > 0;
}

// ===========================================================================
// PARTECIPANTI (soci collegati alla missione)
// ===========================================================================

export interface MissionParticipant {
  userId: string;
  name: string;
  email: string;
  note: string | null;
  addedAt: number;
}

export async function listMissionParticipants(db: D1Database, missionId: string): Promise<MissionParticipant[]> {
  const rs = await db
    .prepare(
      `SELECT mp.user_id, mp.note, mp.added_at, u.name, u.email
         FROM mission_participants mp
         JOIN users u ON u.id = mp.user_id
        WHERE mp.mission_id = ?
        ORDER BY u.name ASC`,
    )
    .bind(missionId)
    .all();
  return (rs.results as Record<string, unknown>[]).map((r) => ({
    userId: String(r.user_id),
    name: String(r.name),
    email: String(r.email),
    note: (r.note as string) ?? null,
    addedAt: Number(r.added_at),
  }));
}

export async function addMissionParticipant(
  db: D1Database,
  missionId: string,
  userId: string,
  note?: string | null,
): Promise<boolean> {
  const res = await db
    .prepare(
      `INSERT INTO mission_participants (mission_id, user_id, note, added_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(mission_id, user_id) DO UPDATE SET note = excluded.note`,
    )
    .bind(missionId, userId, note?.trim() || null, now())
    .run();
  return !!res.meta;
}

export async function removeMissionParticipant(db: D1Database, missionId: string, userId: string): Promise<boolean> {
  const res = await db
    .prepare("DELETE FROM mission_participants WHERE mission_id = ? AND user_id = ?")
    .bind(missionId, userId)
    .run();
  return !!res.meta && res.meta.changes > 0;
}

/** Soci attivi selezionabili come partecipanti (id + nome + email). */
export async function listSelectableMembers(db: D1Database): Promise<Array<{ id: string; name: string; email: string }>> {
  const rs = await db
    .prepare("SELECT id, name, email FROM users WHERE active = 1 ORDER BY name ASC")
    .all();
  return (rs.results as Record<string, unknown>[]).map((r) => ({
    id: String(r.id), name: String(r.name), email: String(r.email),
  }));
}

// ===========================================================================
// REPORT per missione (consuntivo + budget + ripartizione per categoria)
// ===========================================================================

export interface MissionTxnRow {
  id: string;
  opDate: string;
  description: string;
  counterparty: string;
  source: string;
  amount: number;
  category: string | null;
}

export interface MissionReport {
  mission: FinanceMission;
  totalIn: number;
  totalOut: number;     // <= 0
  spent: number;        // valore positivo = -totalOut
  net: number;
  budgetEur: number | null;
  budgetLeft: number | null;   // budget - spent (null se nessun budget)
  count: number;
  byCategory: Array<{ category: string; out: number; in: number; count: number }>;
  transactions: MissionTxnRow[];
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export async function getMissionReport(db: D1Database, id: string): Promise<MissionReport | null> {
  const mission = await getMission(db, id);
  if (!mission) return null;

  const rs = await db
    .prepare(
      `SELECT id, op_date, description, counterparty, source, amount_eur, category
         FROM finance_transactions
        WHERE mission_id = ? AND excluded = 0
        ORDER BY op_date DESC, rowid DESC`,
    )
    .bind(id)
    .all();
  const rows = (rs.results as Record<string, unknown>[]) ?? [];

  let totalIn = 0, totalOut = 0;
  const catMap = new Map<string, { out: number; in: number; count: number }>();
  const transactions: MissionTxnRow[] = rows.map((r) => {
    const amount = Number(r.amount_eur);
    if (amount > 0) totalIn += amount; else totalOut += amount;
    const cat = (r.category as string) || "altro";
    const c = catMap.get(cat) ?? { out: 0, in: 0, count: 0 };
    if (amount > 0) c.in += amount; else c.out += amount;
    c.count++;
    catMap.set(cat, c);
    return {
      id: String(r.id),
      opDate: String(r.op_date),
      description: (r.description as string) ?? "",
      counterparty: (r.counterparty as string) ?? "",
      source: (r.source as string) ?? "",
      amount,
      category: (r.category as string) ?? null,
    };
  });

  const spent = r2(-totalOut);
  const budgetEur = mission.budgetEur;
  const byCategory = Array.from(catMap.entries())
    .map(([category, v]) => ({ category, out: r2(v.out), in: r2(v.in), count: v.count }))
    .sort((a, b) => a.out - b.out); // piu' spesa (out piu' negativo) prima

  return {
    mission,
    totalIn: r2(totalIn),
    totalOut: r2(totalOut),
    spent,
    net: r2(totalIn + totalOut),
    budgetEur,
    budgetLeft: budgetEur != null ? r2(budgetEur - spent) : null,
    count: transactions.length,
    byCategory,
    transactions,
  };
}

/** Riepilogo leggero per la lista missioni (spesa + budget per ciascuna). */
export async function listMissionsWithTotals(
  db: D1Database,
): Promise<Array<FinanceMission & { spent: number; count: number }>> {
  const missions = await listMissions(db);
  if (missions.length === 0) return [];
  const rs = await db
    .prepare(
      `SELECT mission_id,
              COALESCE(SUM(CASE WHEN amount_eur < 0 THEN amount_eur ELSE 0 END), 0) AS out,
              COUNT(*) AS cnt
         FROM finance_transactions
        WHERE mission_id IS NOT NULL AND excluded = 0
        GROUP BY mission_id`,
    )
    .all<{ mission_id: string; out: number; cnt: number }>();
  const byId = new Map((rs.results ?? []).map((r) => [r.mission_id, r]));
  return missions.map((m) => {
    const agg = byId.get(m.id);
    return { ...m, spent: r2(-(agg?.out ?? 0)), count: agg?.cnt ?? 0 };
  });
}
