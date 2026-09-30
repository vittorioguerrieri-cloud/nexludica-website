/**
 * Lettere d'incarico (prestazione occasionale) — NexLudica.
 * Modello adattato da Giochi al Pesto con intestazione NexLudica.
 * Firma SES dedicata (single signer = collaboratore) gestita sui campi della riga.
 */
import { now, uuid } from "./db";

export type IncaricoStatus = "draft" | "sent_for_signature" | "signed" | "void";

export interface IncaricoRow {
  id: string;
  user_id: string;
  project_label: string;
  object_description: string | null;
  period_from: string;
  period_to: string;
  hours: number | null;
  hourly_rate: number | null;
  compenso_total: number | null;
  legal_rep_name: string | null;
  legal_rep_role: string | null;
  status: IncaricoStatus;
  notes: string | null;
  pdf_drive_id: string | null;
  signed_pdf_drive_id: string | null;
  sign_token: string | null;
  signer_typed: string | null;
  signer_image: string | null;
  signer_method: string | null;
  signer_ip_hash: string | null;
  signer_user_agent: string | null;
  consent_at: number | null;
  document_hash: string | null;
  sent_at: number | null;
  signed_at: number | null;
  created_at: number;
  updated_at: number;
}

/** Riga incarico arricchita coi dati anagrafici/fiscali del collaboratore. */
export interface IncaricoWithPerson extends IncaricoRow {
  person_name: string;
  person_email: string;
  fiscal_code: string | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  province: string | null;
  iban: string | null;
}

async function presidentName(db: D1Database): Promise<string | null> {
  const r = await db
    .prepare("SELECT name FROM users WHERE board_role = 'presidente' LIMIT 1")
    .first<{ name: string }>();
  return r?.name ?? null;
}

export interface CreateIncaricoInput {
  user_id: string;
  project_label: string;
  object_description?: string | null;
  period_from: string;
  period_to: string;
  hours?: number | null;
  hourly_rate?: number | null;
  compenso_total?: number | null;
  legal_rep_name?: string | null;
  legal_rep_role?: string | null;
  notes?: string | null;
}

export async function createIncarico(db: D1Database, input: CreateIncaricoInput): Promise<IncaricoRow> {
  const id = "inc_" + uuid().replace(/-/g, "").slice(0, 18);
  const t = now();
  const legalRep = input.legal_rep_name?.trim() || (await presidentName(db)) || "Il Legale Rappresentante";
  await db
    .prepare(
      `INSERT INTO incarichi (
        id, user_id, project_label, object_description, period_from, period_to,
        hours, hourly_rate, compenso_total, legal_rep_name, legal_rep_role,
        status, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?)`,
    )
    .bind(
      id, input.user_id, input.project_label.trim().slice(0, 200),
      input.object_description?.trim() || null, input.period_from, input.period_to,
      input.hours ?? null, input.hourly_rate ?? null, input.compenso_total ?? null,
      legalRep, input.legal_rep_role?.trim() || "Presidente",
      input.notes?.trim() || null, t, t,
    )
    .run();
  return (await getIncaricoById(db, id))!;
}

export async function getIncaricoById(db: D1Database, id: string): Promise<IncaricoRow | null> {
  const r = await db.prepare("SELECT * FROM incarichi WHERE id = ?").bind(id).first<IncaricoRow>();
  return r ?? null;
}

export async function getIncaricoByToken(db: D1Database, token: string): Promise<IncaricoRow | null> {
  const r = await db.prepare("SELECT * FROM incarichi WHERE sign_token = ?").bind(token).first<IncaricoRow>();
  return r ?? null;
}

export async function getIncaricoForPdf(db: D1Database, id: string): Promise<IncaricoWithPerson | null> {
  const r = await db
    .prepare(
      `SELECT i.*, u.name AS person_name, u.email AS person_email,
              m.fiscal_code, m.address, m.city, m.postal_code, m.province, m.iban
       FROM incarichi i
       JOIN users u ON u.id = i.user_id
       LEFT JOIN member_data m ON m.user_id = i.user_id
       WHERE i.id = ?`,
    )
    .bind(id)
    .first<IncaricoWithPerson>();
  return r ?? null;
}

export async function listIncarichi(db: D1Database): Promise<Array<IncaricoRow & { person_name: string }>> {
  const { results } = await db
    .prepare(
      `SELECT i.*, u.name AS person_name
       FROM incarichi i JOIN users u ON u.id = i.user_id
       ORDER BY i.created_at DESC`,
    )
    .all<IncaricoRow & { person_name: string }>();
  return results ?? [];
}

export async function updateIncarico(db: D1Database, id: string, fields: Partial<CreateIncaricoInput> & {
  status?: IncaricoStatus; sign_token?: string | null; sent_at?: number | null; document_hash?: string | null;
}): Promise<void> {
  const e = await getIncaricoById(db, id);
  if (!e) throw new Error("Incarico non trovato");
  const v = <T>(x: T | undefined, f: T): T => (x !== undefined ? x : f);
  await db
    .prepare(
      `UPDATE incarichi SET project_label=?, object_description=?, period_from=?, period_to=?,
        hours=?, hourly_rate=?, compenso_total=?, legal_rep_name=?, legal_rep_role=?,
        status=?, notes=?, sign_token=?, sent_at=?, document_hash=?, updated_at=?
       WHERE id=?`,
    )
    .bind(
      v(fields.project_label, e.project_label),
      v(fields.object_description, e.object_description),
      v(fields.period_from, e.period_from),
      v(fields.period_to, e.period_to),
      v(fields.hours, e.hours),
      v(fields.hourly_rate, e.hourly_rate),
      v(fields.compenso_total, e.compenso_total),
      v(fields.legal_rep_name, e.legal_rep_name),
      v(fields.legal_rep_role, e.legal_rep_role),
      v(fields.status, e.status),
      v(fields.notes, e.notes),
      v(fields.sign_token, e.sign_token),
      v(fields.sent_at, e.sent_at),
      v(fields.document_hash, e.document_hash),
      now(), id,
    )
    .run();
}

export async function recordIncaricoSignature(
  db: D1Database,
  token: string,
  data: { typed: string; image?: string | null; method?: string; ipHash: string | null; userAgent: string | null },
): Promise<boolean> {
  const e = await getIncaricoByToken(db, token);
  if (!e) return false;
  await db
    .prepare(
      `UPDATE incarichi SET status='signed', signed_at=?, signer_typed=?, signer_image=?,
        signer_method=?, signer_ip_hash=?, signer_user_agent=?, consent_at=?, updated_at=?
       WHERE sign_token=?`,
    )
    .bind(now(), data.typed.trim(), data.image ?? null, data.method ?? "typed", data.ipHash, data.userAgent, now(), now(), token)
    .run();
  return true;
}

export async function deleteIncarico(db: D1Database, id: string): Promise<void> {
  await db.prepare("DELETE FROM incarichi WHERE id = ?").bind(id).run();
}
