/**
 * Sondaggio orari MeetLudica 2027: dal 2027 gli incontri si tengono in orario
 * lavorativo e chiediamo agli iscritti giorni e fasce preferite.
 * Tabella: migrations/0072_meetludica_orari_2027.sql (una riga per email).
 */
import { now } from "./db";

export const ORARI_GIORNI = [
  { key: "lun", label: "Lunedì", short: "Lun" },
  { key: "mar", label: "Martedì", short: "Mar" },
  { key: "mer", label: "Mercoledì", short: "Mer" },
  { key: "gio", label: "Giovedì", short: "Gio" },
  { key: "ven", label: "Venerdì", short: "Ven" },
] as const;

export const ORARI_FASCE = [
  { key: "09", label: "9:00 – 11:00" },
  { key: "11", label: "11:00 – 13:00" },
  { key: "13", label: "13:00 – 14:30", hint: "pausa pranzo" },
  { key: "14", label: "14:30 – 16:30" },
  { key: "16", label: "16:30 – 18:00" },
] as const;

const VALID_SLOTS = new Set(
  ORARI_GIORNI.flatMap((g) => ORARI_FASCE.map((f) => `${g.key}-${f.key}`)),
);

export function cleanSlots(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return [...new Set(input.map(String).filter((s) => VALID_SLOTS.has(s)))];
}

export interface OrariRisposta {
  id: string;
  name: string;
  email: string;
  slots: string[];
  notes: string | null;
  createdAt: number;
  updatedAt: number;
}

interface Row {
  id: string;
  name: string;
  email: string;
  slots: string;
  notes: string | null;
  created_at: number;
  updated_at: number;
}

export async function listOrariRisposte(db: D1Database): Promise<OrariRisposta[]> {
  try {
    const rs = await db
      .prepare("SELECT * FROM meetludica_orari_2027 ORDER BY updated_at DESC")
      .all<Row>();
    return (rs.results ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      slots: cleanSlots(JSON.parse(r.slots || "[]")),
      notes: r.notes,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  } catch {
    // Tabella non ancora creata (migrazione non applicata): pannello vuoto.
    return [];
  }
}

/** Inserisce o aggiorna la risposta legata all'email. Ritorna true se era un aggiornamento. */
export async function saveOrariRisposta(
  db: D1Database,
  input: { name: string; email: string; slots: string[]; notes: string | null; ipHash: string },
): Promise<boolean> {
  const existing = await db
    .prepare("SELECT id FROM meetludica_orari_2027 WHERE email = ?")
    .bind(input.email)
    .first<{ id: string }>();
  const ts = now();
  await db
    .prepare(
      `INSERT INTO meetludica_orari_2027 (id, name, email, slots, notes, ip_hash, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(email) DO UPDATE SET
         name = excluded.name, slots = excluded.slots, notes = excluded.notes,
         ip_hash = excluded.ip_hash, updated_at = excluded.updated_at`,
    )
    .bind(
      crypto.randomUUID(), input.name, input.email, JSON.stringify(input.slots),
      input.notes, input.ipHash, ts, ts,
    )
    .run();
  return !!existing;
}

export async function deleteOrariRisposta(db: D1Database, id: string): Promise<boolean> {
  const r = await db.prepare("DELETE FROM meetludica_orari_2027 WHERE id = ?").bind(id).run();
  return (r.meta?.changes ?? 0) > 0;
}
