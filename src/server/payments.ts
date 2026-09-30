/**
 * Notule di prestazione occasionale (ritenuta d'acconto) — NexLudica.
 * Portato da Giochi al Pesto e adattato:
 *  - il bollo (2€ se lordo > 77,47€) è un COSTO di NexLudica: NON viene detratto
 *    dal netto della persona. Netto = lordo − ritenuta.
 *  - numerazione progressiva PER PERSONA (numero_personale).
 */
import { now, uuid } from "./db";

export const BOLLO_THRESHOLD_EUR = 77.47;
export const BOLLO_AMOUNT_EUR = 2.0;
export const DEFAULT_WITHHOLDING_PERCENT = 20.0;
export const DEFAULT_TAXABLE_PERCENT = 100.0;

export type NoteStatus = "draft" | "sent_for_signature" | "signed" | "paid" | "void";

export interface PaymentNoteRow {
  id: string;
  user_id: string;
  year: number;
  numero: number;
  numero_personale: number | null;
  date: string;
  service_description: string;
  service_period_start: string | null;
  service_period_end: string | null;
  hours: number | null;
  project_code: string | null;
  amount_gross: number;
  withholding_percentage: number;
  taxable_percentage: number;
  withholding_amount: number;
  bollo_required: number;
  bollo_amount: number;
  amount_net: number;
  status: NoteStatus;
  notes: string | null;
  incarico_id: string | null;
  pdf_drive_id: string | null;
  drive_file_url: string | null;
  signed_pdf_drive_id: string | null;
  sign_token: string | null;
  sent_at: number | null;
  signed_at: number | null;
  paid_person_at: number | null;
  paid_person_txn_id: string | null;
  f24_paid_at: number | null;
  f24_txn_id: string | null;
  signed_pdf_drive_id: string | null;
  signer_typed: string | null;
  signer_image: string | null;
  signer_method: string | null;
  signer_ip_hash: string | null;
  signer_user_agent: string | null;
  consent_at: number | null;
  document_hash: string | null;
  created_at: number;
  updated_at: number;
}

/** Notula arricchita coi dati anagrafici/fiscali del percipiente. */
export interface PaymentNoteWithPerson extends PaymentNoteRow {
  person_name: string;
  person_email: string;
  fiscal_code: string | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  province: string | null;
  birth_place: string | null;
  birth_date: string | null;
  iban: string | null;
}

export interface ComputedAmounts {
  taxable: number;
  withholding: number;
  bolloRequired: boolean;
  bolloAmount: number;
  net: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Calcola gli importi. NOTA NexLudica: il bollo NON è sottratto dal netto
 * (è a carico dell'associazione). bolloAmount è registrato a parte come costo.
 */
export function computeAmounts(
  amountGross: number,
  withholdingPct: number = DEFAULT_WITHHOLDING_PERCENT,
  taxablePct: number = DEFAULT_TAXABLE_PERCENT,
  bolloRequiredOverride?: boolean,
): ComputedAmounts {
  const taxable = round2(amountGross * (taxablePct / 100));
  const withholding = round2(taxable * (withholdingPct / 100));
  const bolloRequired = bolloRequiredOverride ?? amountGross > BOLLO_THRESHOLD_EUR;
  const bolloAmount = bolloRequired ? BOLLO_AMOUNT_EUR : 0;
  const net = round2(amountGross - withholding); // bollo a carico NexLudica
  return { taxable, withholding, bolloRequired, bolloAmount, net };
}

/** Progressivo annuale globale: max(numero) dell'anno + 1. */
export async function nextNumeroForYear(db: D1Database, year: number): Promise<number> {
  const r = await db
    .prepare("SELECT COALESCE(MAX(numero), 0) AS m FROM payment_notes WHERE year = ?")
    .bind(year)
    .first<{ m: number }>();
  return (r?.m ?? 0) + 1;
}

/** Progressivo per persona: max(numero_personale) dell'utente + 1. */
export async function nextNumeroPersonale(db: D1Database, userId: string): Promise<number> {
  const r = await db
    .prepare("SELECT COALESCE(MAX(numero_personale), 0) AS m FROM payment_notes WHERE user_id = ?")
    .bind(userId)
    .first<{ m: number }>();
  return (r?.m ?? 0) + 1;
}

export interface CreateNoteInput {
  user_id: string;
  date: string;
  service_description: string;
  service_period_start?: string | null;
  service_period_end?: string | null;
  hours?: number | null;
  project_code?: string | null;
  amount_gross: number;
  withholding_percentage?: number;
  taxable_percentage?: number;
  bollo_required?: boolean;
  notes?: string | null;
  incarico_id?: string | null;
}

export async function createPaymentNote(db: D1Database, input: CreateNoteInput): Promise<PaymentNoteRow> {
  const year = new Date(input.date).getFullYear();
  const numero = await nextNumeroForYear(db, year);
  const numeroPersonale = await nextNumeroPersonale(db, input.user_id);
  const wPct = input.withholding_percentage ?? DEFAULT_WITHHOLDING_PERCENT;
  const tPct = input.taxable_percentage ?? DEFAULT_TAXABLE_PERCENT;
  const calc = computeAmounts(input.amount_gross, wPct, tPct, input.bollo_required);
  const id = "pmn_" + uuid().replace(/-/g, "").slice(0, 20);
  const t = now();
  await db
    .prepare(
      `INSERT INTO payment_notes (
        id, user_id, year, numero, numero_personale, date, service_description,
        service_period_start, service_period_end, hours, project_code, amount_gross,
        withholding_percentage, taxable_percentage, withholding_amount,
        bollo_required, bollo_amount, amount_net, status, notes, incarico_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?)`,
    )
    .bind(
      id, input.user_id, year, numero, numeroPersonale, input.date, input.service_description,
      input.service_period_start ?? null, input.service_period_end ?? null, input.hours ?? null,
      input.project_code ?? null, input.amount_gross, wPct, tPct, calc.withholding,
      calc.bolloRequired ? 1 : 0, calc.bolloAmount, calc.net, input.notes ?? null,
      input.incarico_id ?? null, t, t,
    )
    .run();
  const row = await getPaymentNoteById(db, id);
  return row!;
}

export function notulaNumeroDisplay(note: { numero_personale?: number | null; numero: number }): number {
  return note.numero_personale ?? note.numero;
}

export async function getPaymentNoteById(db: D1Database, id: string): Promise<PaymentNoteRow | null> {
  const r = await db.prepare("SELECT * FROM payment_notes WHERE id = ?").bind(id).first<PaymentNoteRow>();
  return r ?? null;
}

export async function getNoteByToken(db: D1Database, token: string): Promise<PaymentNoteRow | null> {
  const r = await db.prepare("SELECT * FROM payment_notes WHERE sign_token = ?").bind(token).first<PaymentNoteRow>();
  return r ?? null;
}

/** Notula + dati anagrafici/fiscali del percipiente (per PDF e pagamenti). */
export async function getNoteForPdf(db: D1Database, id: string): Promise<PaymentNoteWithPerson | null> {
  const r = await db
    .prepare(
      `SELECT pn.*, u.name AS person_name, u.email AS person_email,
              m.fiscal_code, m.address, m.city, m.postal_code, m.province,
              m.birth_place, m.birth_date, m.iban
       FROM payment_notes pn
       JOIN users u ON u.id = pn.user_id
       LEFT JOIN member_data m ON m.user_id = pn.user_id
       WHERE pn.id = ?`,
    )
    .bind(id)
    .first<PaymentNoteWithPerson>();
  return r ?? null;
}

export async function listPaymentNotesWithPerson(db: D1Database): Promise<Array<PaymentNoteRow & { person_name: string }>> {
  const { results } = await db
    .prepare(
      `SELECT pn.*, u.name AS person_name FROM payment_notes pn JOIN users u ON u.id = pn.user_id
       ORDER BY pn.year DESC, pn.numero DESC`,
    )
    .all<PaymentNoteRow & { person_name: string }>();
  return results ?? [];
}

export async function recordNoteSignature(
  db: D1Database,
  token: string,
  data: { typed: string; image?: string | null; method?: string; ipHash: string | null; userAgent: string | null },
): Promise<boolean> {
  const e = await getNoteByToken(db, token);
  if (!e) return false;
  await db
    .prepare(
      `UPDATE payment_notes SET status='signed', signed_at=?, signer_typed=?, signer_image=?,
        signer_method=?, signer_ip_hash=?, signer_user_agent=?, consent_at=?, updated_at=?
       WHERE sign_token=?`,
    )
    .bind(now(), data.typed.trim(), data.image ?? null, data.method ?? "typed", data.ipHash, data.userAgent, now(), now(), token)
    .run();
  return true;
}

/** Imposta token/sent/document_hash per l'invio in firma. */
export async function setNoteSendState(db: D1Database, id: string, token: string, documentHash: string | null): Promise<void> {
  await db
    .prepare("UPDATE payment_notes SET status='sent_for_signature', sign_token=?, sent_at=?, document_hash=?, updated_at=? WHERE id=?")
    .bind(token, now(), documentHash, now(), id)
    .run();
}

export async function setNoteSignedPdf(db: D1Database, id: string, driveId: string): Promise<void> {
  await db.prepare("UPDATE payment_notes SET signed_pdf_drive_id=?, updated_at=? WHERE id=?").bind(driveId, now(), id).run();
}

export async function listPaymentNotes(
  db: D1Database,
  opts: { userId?: string; year?: number; status?: NoteStatus } = {},
): Promise<PaymentNoteRow[]> {
  const conds: string[] = []; const binds: unknown[] = [];
  if (opts.userId) { conds.push("user_id = ?"); binds.push(opts.userId); }
  if (opts.year) { conds.push("year = ?"); binds.push(opts.year); }
  if (opts.status) { conds.push("status = ?"); binds.push(opts.status); }
  const sql = "SELECT * FROM payment_notes" + (conds.length ? " WHERE " + conds.join(" AND ") : "") + " ORDER BY year DESC, numero DESC";
  const r = await db.prepare(sql).bind(...binds).all<PaymentNoteRow>();
  return r.results ?? [];
}

export interface UpdateNoteInput {
  date?: string;
  service_description?: string;
  service_period_start?: string | null;
  service_period_end?: string | null;
  hours?: number | null;
  project_code?: string | null;
  amount_gross?: number;
  withholding_percentage?: number;
  taxable_percentage?: number;
  bollo_required?: boolean;
  status?: NoteStatus;
  notes?: string | null;
  incarico_id?: string | null;
  pdf_drive_id?: string | null;
  drive_file_url?: string | null;
  signed_pdf_drive_id?: string | null;
  sign_token?: string | null;
  sent_at?: number | null;
  signed_at?: number | null;
  paid_person_at?: number | null;
  paid_person_txn_id?: string | null;
  f24_paid_at?: number | null;
  f24_txn_id?: string | null;
}

export async function updatePaymentNote(db: D1Database, id: string, input: UpdateNoteInput): Promise<void> {
  const existing = await getPaymentNoteById(db, id);
  if (!existing) throw new Error("Notula non trovata");
  const date = input.date ?? existing.date;
  const year = new Date(date).getFullYear();
  const wPct = input.withholding_percentage ?? existing.withholding_percentage;
  const tPct = input.taxable_percentage ?? existing.taxable_percentage;
  const gross = input.amount_gross ?? existing.amount_gross;
  const bolloOverride = input.bollo_required !== undefined ? input.bollo_required : existing.bollo_required === 1;
  const calc = computeAmounts(gross, wPct, tPct, bolloOverride);
  const v = <T>(x: T | undefined, fallback: T): T => (x !== undefined ? x : fallback);
  await db
    .prepare(
      `UPDATE payment_notes SET
        year = ?, date = ?, service_description = ?, service_period_start = ?, service_period_end = ?,
        hours = ?, project_code = ?, amount_gross = ?, withholding_percentage = ?, taxable_percentage = ?,
        withholding_amount = ?, bollo_required = ?, bollo_amount = ?, amount_net = ?,
        status = ?, notes = ?, incarico_id = ?, pdf_drive_id = ?, drive_file_url = ?, signed_pdf_drive_id = ?,
        sign_token = ?, sent_at = ?, signed_at = ?,
        paid_person_at = ?, paid_person_txn_id = ?, f24_paid_at = ?, f24_txn_id = ?,
        updated_at = ?
       WHERE id = ?`,
    )
    .bind(
      year, date,
      v(input.service_description, existing.service_description),
      v(input.service_period_start, existing.service_period_start),
      v(input.service_period_end, existing.service_period_end),
      v(input.hours, existing.hours),
      v(input.project_code, existing.project_code),
      gross, wPct, tPct, calc.withholding, calc.bolloRequired ? 1 : 0, calc.bolloAmount, calc.net,
      v(input.status, existing.status),
      v(input.notes, existing.notes),
      v(input.incarico_id, existing.incarico_id),
      v(input.pdf_drive_id, existing.pdf_drive_id),
      v(input.drive_file_url, existing.drive_file_url),
      v(input.signed_pdf_drive_id, existing.signed_pdf_drive_id),
      v(input.sign_token, existing.sign_token),
      v(input.sent_at, existing.sent_at),
      v(input.signed_at, existing.signed_at),
      v(input.paid_person_at, existing.paid_person_at),
      v(input.paid_person_txn_id, existing.paid_person_txn_id),
      v(input.f24_paid_at, existing.f24_paid_at),
      v(input.f24_txn_id, existing.f24_txn_id),
      now(), id,
    )
    .run();
}

export async function deletePaymentNote(db: D1Database, id: string): Promise<void> {
  await db.prepare("DELETE FROM payment_notes WHERE id = ?").bind(id).run();
}

/** Anni con almeno una notula (per il selettore CU). */
export async function listNotuleYears(db: D1Database): Promise<number[]> {
  const { results } = await db
    .prepare("SELECT DISTINCT year FROM payment_notes ORDER BY year DESC")
    .all<{ year: number }>();
  return (results ?? []).map((r) => r.year);
}

export interface CURow {
  user_id: string;
  name: string;
  fiscal_code: string | null;
  birth_place: string | null;
  birth_date: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  iban: string | null;
  count: number;
  gross: number;
  withholding: number;
  net: number;
  paid_count: number;
}

/**
 * Riepilogo CU per anno: per ciascun percipiente, totali di compensi e ritenute
 * delle notule emesse (firmate o pagate; le bozze sono escluse).
 */
export async function getCUSummary(db: D1Database, year: number): Promise<CURow[]> {
  const { results } = await db
    .prepare(
      `SELECT pn.user_id, u.name,
              m.fiscal_code, m.birth_place, m.birth_date, m.address, m.city, m.province, m.iban,
              COUNT(*) AS count,
              ROUND(SUM(pn.amount_gross), 2) AS gross,
              ROUND(SUM(pn.withholding_amount), 2) AS withholding,
              ROUND(SUM(pn.amount_net), 2) AS net,
              SUM(CASE WHEN pn.status = 'paid' THEN 1 ELSE 0 END) AS paid_count
       FROM payment_notes pn
       JOIN users u ON u.id = pn.user_id
       LEFT JOIN member_data m ON m.user_id = pn.user_id
       WHERE pn.year = ? AND pn.status IN ('signed', 'paid')
       GROUP BY pn.user_id
       ORDER BY u.name`,
    )
    .bind(year)
    .all<CURow>();
  return results ?? [];
}

/* ---- format helpers per i template ---- */
const ITALIAN_MONTHS = ["gennaio","febbraio","marzo","aprile","maggio","giugno","luglio","agosto","settembre","ottobre","novembre","dicembre"];
export function formatDateIt(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCDate()} ${ITALIAN_MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
export function formatEur(n: number): string {
  return n.toLocaleString("it-IT", { style: "currency", currency: "EUR", useGrouping: "always" });
}
