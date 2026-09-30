/**
 * Ricevute e fatture allegate ai movimenti della sezione finanze.
 *
 * I file vivono su R2 sotto `finance-receipts/<transazione>/`, un prefisso che
 * la rotta pubblica /r2 non serve: documenti fiscali con dati personali non
 * devono essere raggiungibili da un indirizzo indovinato. Si leggono solo
 * dall'endpoint riservato agli amministratori.
 */
import { now, uuid } from "./db";

export interface Receipt {
  id: string;
  transactionId: string;
  r2Key: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: number;
}

interface Row {
  id: string;
  transaction_id: string;
  r2_key: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  uploaded_at: number;
}

const toReceipt = (r: Row): Receipt => ({
  id: r.id,
  transactionId: r.transaction_id,
  r2Key: r.r2_key,
  filename: r.filename,
  mimeType: r.mime_type,
  sizeBytes: r.size_bytes,
  uploadedAt: r.uploaded_at,
});

export const RECEIPT_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
export const RECEIPT_MAX_BYTES = 15 * 1024 * 1024;

/** Ricevute raggruppate per movimento, per la tabella della pagina finanze. */
export async function receiptsByTransaction(db: D1Database): Promise<Record<string, Receipt[]>> {
  const r = await db
    .prepare("SELECT * FROM finance_receipts ORDER BY uploaded_at")
    .all<Row>();
  const out: Record<string, Receipt[]> = {};
  for (const row of r.results ?? []) (out[row.transaction_id] ??= []).push(toReceipt(row));
  return out;
}

export async function getReceipt(db: D1Database, id: string): Promise<Receipt | null> {
  const r = await db.prepare("SELECT * FROM finance_receipts WHERE id = ?").bind(id).first<Row>();
  return r ? toReceipt(r) : null;
}

export async function addReceipt(
  db: D1Database,
  storage: R2Bucket,
  input: { transactionId: string; filename: string; mimeType: string; bytes: ArrayBuffer; userId: string | null },
): Promise<Receipt> {
  const ext = RECEIPT_TYPES[input.mimeType];
  const base = input.filename.replace(/\.[^.]+$/, "").normalize("NFKD")
    .replace(/[^\w.-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "ricevuta";
  const id = uuid();
  const key = `finance-receipts/${input.transactionId}/${Date.now().toString(36)}-${base}.${ext}`;
  await storage.put(key, input.bytes, {
    httpMetadata: { contentType: input.mimeType },
    customMetadata: { transaction: input.transactionId, originalName: input.filename.slice(0, 200) },
  });
  const ts = now();
  await db
    .prepare(
      `INSERT INTO finance_receipts (id, transaction_id, r2_key, filename, mime_type, size_bytes, uploaded_at, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, input.transactionId, key, input.filename.slice(0, 200), input.mimeType, input.bytes.byteLength, ts, input.userId)
    .run();
  return { id, transactionId: input.transactionId, r2Key: key, filename: input.filename, mimeType: input.mimeType, sizeBytes: input.bytes.byteLength, uploadedAt: ts };
}

export async function deleteReceipt(db: D1Database, storage: R2Bucket, id: string): Promise<boolean> {
  const r = await getReceipt(db, id);
  if (!r) return false;
  await storage.delete(r.r2Key);
  await db.prepare("DELETE FROM finance_receipts WHERE id = ?").bind(id).run();
  return true;
}
