/**
 * Firma elettronica semplice (SES) proprietaria NexLudica.
 *
 * Flusso:
 *   1. Admin clicca "Invia richieste di firma" sul verbale draft.
 *   2. Per ogni signer in verbali.signers, creiamo una riga in
 *      verbali_signatures con token UUID univoco e mandiamo l'email.
 *   3. Il firmatario riceve email con link https://nexludica.org/firma/<token>.
 *   4. Sulla pagina pubblica vede il PDF, accetta il consenso, digita il
 *      proprio nome → POST /api/firma/<token>.
 *   5. Salviamo typed_signature + IP hash + UA + timestamp.
 *   6. Quando tutti hanno firmato → status del verbale diventa 'signed' e
 *      il PDF rigenerato (con firme embedded) viene salvato su Drive.
 *
 * Conformità eIDAS: SES (Simple Electronic Signature). Adeguata per atti
 * privati associativi. Non vincolante come AdES/QES, ma legalmente valida
 * salvo prova contraria, ai sensi dell'art. 25 Reg. 910/2014.
 */
import { now, uuid } from "./db";

export type SignatureStatus =
  | "pending"
  | "viewed"
  | "signed"
  | "declined"
  | "expired"
  | "revoked";

export interface VerbaleSignature {
  id: string;
  verbaleId: string;
  signerName: string;
  signerEmail: string;
  signerOrder: number;
  token: string;
  documentHash: string | null;
  status: SignatureStatus;
  sentAt: number;
  viewedAt: number | null;
  signedAt: number | null;
  declinedAt: number | null;
  expiresAt: number;
  typedSignature: string | null;
  imageSignatureData: string | null;   // data:image/png;base64,...
  signatureMethod: "typed" | "drawn" | "uploaded" | null;
  consentText: string | null;
  consentGivenAt: number | null;
  signerIpHash: string | null;
  signerUserAgent: string | null;
  signerLocale: string | null;
  declineReason: string | null;
  notes: string | null;
}

function rowToSignature(r: Record<string, unknown>): VerbaleSignature {
  return {
    id: String(r.id),
    verbaleId: String(r.verbale_id),
    signerName: String(r.signer_name),
    signerEmail: String(r.signer_email),
    signerOrder: Number(r.signer_order),
    token: String(r.token),
    documentHash: (r.document_hash as string) ?? null,
    status: r.status as SignatureStatus,
    sentAt: Number(r.sent_at),
    viewedAt: r.viewed_at != null ? Number(r.viewed_at) : null,
    signedAt: r.signed_at != null ? Number(r.signed_at) : null,
    declinedAt: r.declined_at != null ? Number(r.declined_at) : null,
    expiresAt: Number(r.expires_at),
    typedSignature: (r.typed_signature as string) ?? null,
    imageSignatureData: (r.image_signature_data as string) ?? null,
    signatureMethod: (r.signature_method as VerbaleSignature["signatureMethod"]) ?? null,
    consentText: (r.consent_text as string) ?? null,
    consentGivenAt: r.consent_given_at != null ? Number(r.consent_given_at) : null,
    signerIpHash: (r.signer_ip_hash as string) ?? null,
    signerUserAgent: (r.signer_user_agent as string) ?? null,
    signerLocale: (r.signer_locale as string) ?? null,
    declineReason: (r.decline_reason as string) ?? null,
    notes: (r.notes as string) ?? null,
  };
}

/** Genera un token URL-safe di 32 caratteri base64url (192 bit entropy). */
export function generateToken(): string {
  const buf = new Uint8Array(24);
  crypto.getRandomValues(buf);
  // base64url manuale (workers ha btoa ma con padding "=")
  const b64 = btoa(String.fromCharCode(...buf));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** SHA-256 di una stringa o ArrayBuffer, restituito come hex. */
export async function sha256Hex(input: string | ArrayBuffer): Promise<string> {
  const data = typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  const hashBuf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** TTL default del link di firma: 30 giorni. */
export const SIGNATURE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Testo standard del consenso che il firmatario accetta. */
export const CONSENT_TEXT =
  "Confermo la mia identità di firmatario indicato e dichiaro di voler firmare elettronicamente " +
  "il presente verbale. Dichiaro inoltre di aver letto il documento e accetto che la mia firma, " +
  "registrata sotto forma di nome digitato unitamente all'audit trail (timestamp, hash IP, " +
  "user agent), abbia valore di firma elettronica semplice ai sensi dell'art. 25 del Regolamento " +
  "eIDAS 910/2014. Sono consapevole che il documento firmato verrà conservato dall'associazione " +
  "NexLudica APS con sede in Vico Barnabiti 10, 16122 Genova (C.F. 95252550108).";

export async function listSignaturesForVerbale(db: D1Database, verbaleId: string): Promise<VerbaleSignature[]> {
  const { results } = await db
    .prepare("SELECT * FROM verbali_signatures WHERE verbale_id = ? ORDER BY signer_order")
    .bind(verbaleId)
    .all();
  return (results ?? []).map((r) => rowToSignature(r as Record<string, unknown>));
}

export async function getSignatureByToken(db: D1Database, token: string): Promise<VerbaleSignature | null> {
  const r = await db.prepare("SELECT * FROM verbali_signatures WHERE token = ?").bind(token).first();
  return r ? rowToSignature(r as Record<string, unknown>) : null;
}

export async function createSignatureRequest(
  db: D1Database,
  data: {
    verbaleId: string;
    signerName: string;
    signerEmail: string;
    signerOrder: number;
    documentHash: string | null;
  },
): Promise<VerbaleSignature> {
  const id = uuid();
  const token = generateToken();
  const ts = now();
  const expiresAt = ts + SIGNATURE_TTL_MS;
  await db
    .prepare(
      `INSERT INTO verbali_signatures
        (id, verbale_id, signer_name, signer_email, signer_order, token, document_hash,
         status, sent_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
    )
    .bind(
      id, data.verbaleId, data.signerName, data.signerEmail, data.signerOrder,
      token, data.documentHash, ts, expiresAt,
    )
    .run();
  const r = await db.prepare("SELECT * FROM verbali_signatures WHERE id = ?").bind(id).first();
  if (!r) throw new Error("createSignatureRequest failed");
  return rowToSignature(r as Record<string, unknown>);
}

export async function markViewed(db: D1Database, token: string): Promise<void> {
  await db
    .prepare("UPDATE verbali_signatures SET viewed_at = ?, status = CASE WHEN status = 'pending' THEN 'viewed' ELSE status END WHERE token = ? AND viewed_at IS NULL")
    .bind(now(), token)
    .run();
}

export async function recordSignature(
  db: D1Database,
  token: string,
  data: {
    typedSignature: string;                                          // sempre richiesto (anche con immagine, come fallback testuale + matching)
    imageSignatureData?: string | null;                              // data URL PNG, opzionale
    signatureMethod?: "typed" | "drawn" | "uploaded";                // default "typed"
    ipHash: string | null;
    userAgent: string | null;
    locale: string | null;
  },
): Promise<{ ok: true; signature: VerbaleSignature } | { ok: false; error: string }> {
  const existing = await getSignatureByToken(db, token);
  if (!existing) return { ok: false, error: "Token non valido" };
  if (existing.status === "signed") return { ok: false, error: "Già firmato" };
  if (existing.status === "declined") return { ok: false, error: "Richiesta declinata" };
  if (existing.status === "expired" || existing.status === "revoked") {
    return { ok: false, error: "Link scaduto o revocato" };
  }
  if (existing.expiresAt < Date.now()) {
    await db.prepare("UPDATE verbali_signatures SET status = 'expired' WHERE token = ?").bind(token).run();
    return { ok: false, error: "Link scaduto" };
  }

  const ts = now();
  await db
    .prepare(
      `UPDATE verbali_signatures
       SET status = 'signed', signed_at = ?, typed_signature = ?,
           image_signature_data = ?, signature_method = ?,
           consent_text = ?, consent_given_at = ?,
           signer_ip_hash = ?, signer_user_agent = ?, signer_locale = ?
       WHERE token = ?`,
    )
    .bind(
      ts,
      data.typedSignature.trim(),
      data.imageSignatureData ?? null,
      data.signatureMethod ?? "typed",
      CONSENT_TEXT, ts,
      data.ipHash, data.userAgent, data.locale, token,
    )
    .run();

  const updated = await getSignatureByToken(db, token);
  return { ok: true, signature: updated! };
}

export async function recordDecline(
  db: D1Database,
  token: string,
  reason: string | null,
): Promise<void> {
  await db
    .prepare(
      `UPDATE verbali_signatures SET status = 'declined', declined_at = ?, decline_reason = ? WHERE token = ?`,
    )
    .bind(now(), reason, token)
    .run();
}

/** Tutti firmato? */
export async function allSigned(db: D1Database, verbaleId: string): Promise<boolean> {
  const r = await db
    .prepare("SELECT COUNT(*) as total, SUM(CASE WHEN status = 'signed' THEN 1 ELSE 0 END) as signed FROM verbali_signatures WHERE verbale_id = ?")
    .bind(verbaleId)
    .first<{ total: number; signed: number }>();
  if (!r || r.total === 0) return false;
  return r.signed === r.total;
}
