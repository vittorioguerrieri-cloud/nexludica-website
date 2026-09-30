/**
 * Pool marche da bollo digitali per le notule (portato da Giochi al Pesto).
 *
 * Workflow:
 *  1. L'admin scansiona le marche da bollo (16€/2€) e le carica in Notule → Marche da bollo.
 *  2. Ogni immagine è salvata come BLOB in `bolli` con used_at = NULL (disponibile).
 *  3. Quando una notula con bollo_required = 1 genera il PDF, claimBollo() prende
 *     atomicamente la prima marca libera e la marca consumata.
 *  4. L'immagine viene embeddata in alto a destra nella prima pagina del PDF.
 *  5. Se la notula viene annullata/rifatta, releaseBollo() riporta la marca a disponibile.
 *
 * Per NexLudica il costo della marca è dell'associazione (non addebitato al percipiente).
 */
import { now, uuid } from "./db";

export interface BolloRow {
  id: string;
  filename: string;
  mime: string;
  size_bytes: number;
  used_at: number | null;
  used_for_note_id: string | null;
  notes: string | null;
  created_at: number;
  image_data?: ArrayBuffer;
}

export async function listBolli(db: D1Database): Promise<BolloRow[]> {
  const r = await db
    .prepare(
      `SELECT id, filename, mime, size_bytes, used_at, used_for_note_id, notes, created_at
       FROM bolli ORDER BY used_at IS NOT NULL, created_at ASC`,
    )
    .all<BolloRow>();
  return r.results ?? [];
}

export interface BolloRowWithNote extends BolloRow {
  note_numero: number | null;
  note_numero_personale: number | null;
  note_year: number | null;
  note_date: string | null;
  note_status: string | null;
  beneficiary_name: string | null;
}

export async function listBolliWithNotes(db: D1Database): Promise<BolloRowWithNote[]> {
  const r = await db
    .prepare(
      `SELECT
         b.id, b.filename, b.mime, b.size_bytes, b.used_at, b.used_for_note_id, b.notes, b.created_at,
         pn.numero AS note_numero,
         pn.numero_personale AS note_numero_personale,
         pn.year AS note_year,
         pn.date AS note_date,
         pn.status AS note_status,
         u.name AS beneficiary_name
       FROM bolli b
       LEFT JOIN payment_notes pn ON pn.id = b.used_for_note_id
       LEFT JOIN users u ON u.id = pn.user_id
       ORDER BY b.used_at IS NOT NULL, b.created_at ASC`,
    )
    .all<BolloRowWithNote>();
  return r.results ?? [];
}

export async function bolliCounts(db: D1Database): Promise<{ total: number; available: number; used: number }> {
  const r = await db
    .prepare(
      `SELECT COUNT(*) AS total,
         SUM(CASE WHEN used_at IS NULL THEN 1 ELSE 0 END) AS available,
         SUM(CASE WHEN used_at IS NOT NULL THEN 1 ELSE 0 END) AS used
       FROM bolli`,
    )
    .first<{ total: number; available: number; used: number }>();
  return r ?? { total: 0, available: 0, used: 0 };
}

export async function getBolloImage(db: D1Database, id: string): Promise<{ image_data: ArrayBuffer; mime: string } | null> {
  const row = await db
    .prepare("SELECT image_data, mime FROM bolli WHERE id = ?")
    .bind(id)
    .first<{ image_data: ArrayBuffer; mime: string }>();
  return row ?? null;
}

/** Marca già usata per una notula (per re-send: riusa la stessa anziché attingere allo stock). */
export async function findBolloForNote(db: D1Database, noteId: string): Promise<{ id: string; image_data: ArrayBuffer; mime: string } | null> {
  const row = await db
    .prepare("SELECT id, image_data, mime FROM bolli WHERE used_for_note_id = ? ORDER BY used_at ASC LIMIT 1")
    .bind(noteId)
    .first<{ id: string; image_data: ArrayBuffer; mime: string }>();
  return row ?? null;
}

export async function createBollo(
  db: D1Database,
  input: { filename: string; mime: string; bytes: ArrayBuffer | Uint8Array; notes?: string | null },
): Promise<string> {
  const id = "bol_" + uuid().replace(/-/g, "").slice(0, 12);
  const buf = input.bytes instanceof Uint8Array ? input.bytes : new Uint8Array(input.bytes);
  await db
    .prepare(
      `INSERT INTO bolli (id, filename, mime, image_data, size_bytes, used_at, used_for_note_id, notes, created_at)
       VALUES (?, ?, ?, ?, ?, NULL, NULL, ?, ?)`,
    )
    .bind(id, input.filename, input.mime, buf, buf.byteLength, input.notes ?? null, now())
    .run();
  return id;
}

/** Prende atomicamente la prima marca disponibile e la assegna alla notula. null se esaurite. */
export async function claimBollo(
  db: D1Database,
  noteId: string,
  retries = 0,
): Promise<{ id: string; image_data: ArrayBuffer; mime: string } | null> {
  if (retries >= 10) {
    console.warn("[bolli] claimBollo retry cap raggiunto, abort");
    return null;
  }
  const candidate = await db
    .prepare("SELECT id, image_data, mime FROM bolli WHERE used_at IS NULL ORDER BY created_at ASC LIMIT 1")
    .first<{ id: string; image_data: ArrayBuffer; mime: string }>();
  if (!candidate) return null;
  const result = await db
    .prepare("UPDATE bolli SET used_at = ?, used_for_note_id = ? WHERE id = ? AND used_at IS NULL")
    .bind(now(), noteId, candidate.id)
    .run();
  if ((result as any).meta?.changes === 0) return claimBollo(db, noteId, retries + 1);
  return candidate;
}

export async function releaseBollo(db: D1Database, id: string): Promise<void> {
  await db.prepare("UPDATE bolli SET used_at = NULL, used_for_note_id = NULL WHERE id = ?").bind(id).run();
}

export async function deleteBollo(db: D1Database, id: string): Promise<void> {
  await db.prepare("DELETE FROM bolli WHERE id = ?").bind(id).run();
}
