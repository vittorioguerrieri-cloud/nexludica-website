/**
 * SignWell API client per richiesta firma elettronica dei verbali.
 *
 * Docs: https://developers.signwell.com/
 *
 * Auth: header `X-Api-Key: <key>` (la key è un secret Worker `SIGNWELL_API_KEY`)
 *
 * Workflow:
 *   1. createDocumentFromPdf(env, {...}) → invia PDF + recipients + signature fields
 *   2. SignWell manda email a ogni recipient con link unico
 *   3. Quando tutti firmano, SignWell chiama il webhook che configuriamo
 *   4. webhook handler scarica il PDF firmato e lo salva su Drive
 */

const SIGNWELL_BASE = "https://www.signwell.com/api/v1";

export interface SignWellRecipient {
  id: string;                // ID univoco assegnato da noi (es. "signer-0")
  name: string;
  email: string;
}

export interface SignWellField {
  recipient_id: string;       // riferisce SignWellRecipient.id
  type: "signature" | "initials" | "date_signed" | "text";
  page_number: number;        // 1-based su SignWell, ma noi lavoriamo 0-based; convertiamo
  x: number;                  // top-left, in points (origin top-left)
  y: number;
  width: number;
  height: number;
  required?: boolean;
}

export interface SignWellCreateDocumentParams {
  name: string;                          // nome del documento
  subject?: string;                      // oggetto email
  message?: string;                      // corpo email
  test_mode?: boolean;
  /** Se true, il documento è creato come draft (non inviato). */
  draft?: boolean;
  recipients: SignWellRecipient[];
  fields: SignWellField[];
  /** PDF in base64. */
  pdf_base64: string;
  pdf_filename: string;
  /** Email su cui SignWell notificherà eventi (CC su ogni email). */
  cc_emails?: string[];
  /** Webhook custom — di default usiamo quello globale account. */
  webhook_url?: string;
}

export interface SignWellDocument {
  id: string;
  name: string;
  status: string;
  recipients: Array<{ id: string; name: string; email: string; status?: string }>;
  files_url?: string;          // URL al PDF (finale o in corso)
  test_mode?: boolean;
}

export async function createDocumentFromPdf(
  env: Env,
  params: SignWellCreateDocumentParams,
): Promise<{ ok: true; document: SignWellDocument } | { ok: false; error: string; status: number }> {
  const apiKey = (env as any).SIGNWELL_API_KEY as string | undefined;
  if (!apiKey) return { ok: false, error: "SIGNWELL_API_KEY non configurata", status: 500 };

  // SignWell API:
  //   - `fields` è un ARRAY DI ARRAY: la dimensione esterna corrisponde al
  //     numero di file inviati (in ordine), quella interna contiene i field
  //     per quel file. Mandare un array piatto produce 400 "invalid_keys: fields".
  //   - `page` è 1-based.
  //   - Coordinate top-left (il chiamante deve già passare top-left,
  //     vedi send-for-signing.ts che converte da pdf-lib bottom-left).
  const fieldsForFile = params.fields.map((f) => ({
    type: f.type,
    page: f.page_number,
    x: f.x,
    y: f.y,
    width: f.width,
    height: f.height,
    required: f.required ?? true,
    recipient_id: f.recipient_id,
  }));

  const recipients = params.recipients.map((r, i) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    placeholder_name: r.name,
    order: i + 1,
  }));

  const body = {
    test_mode: !!params.test_mode,
    draft: !!params.draft,
    name: params.name,
    subject: params.subject ?? params.name,
    message: params.message ?? "",
    files: [
      {
        name: params.pdf_filename,
        file_base64: params.pdf_base64,
      },
    ],
    recipients,
    // 1 array di field per ogni file (qui un solo file → un solo sotto-array)
    fields: [fieldsForFile],
    apply_signing_order: false,
    cc_emails: params.cc_emails ?? [],
    ...(params.webhook_url ? { webhook_url: params.webhook_url } : {}),
  };

  const res = await fetch(`${SIGNWELL_BASE}/documents/`, {
    method: "POST",
    headers: {
      "X-Api-Key": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text();
    console.error("[signwell] create failed:", res.status, txt);
    return { ok: false, error: `SignWell ${res.status}: ${txt.slice(0, 500)}`, status: res.status };
  }
  const doc = (await res.json()) as SignWellDocument;
  return { ok: true, document: doc };
}

export async function getDocument(
  env: Env,
  documentId: string,
): Promise<{ ok: true; document: SignWellDocument } | { ok: false; error: string }> {
  const apiKey = (env as any).SIGNWELL_API_KEY as string | undefined;
  if (!apiKey) return { ok: false, error: "SIGNWELL_API_KEY non configurata" };
  const res = await fetch(`${SIGNWELL_BASE}/documents/${documentId}/`, {
    headers: { "X-Api-Key": apiKey, Accept: "application/json" },
  });
  if (!res.ok) {
    const txt = await res.text();
    return { ok: false, error: `SignWell ${res.status}: ${txt.slice(0, 500)}` };
  }
  return { ok: true, document: (await res.json()) as SignWellDocument };
}

/**
 * Scarica il PDF finale firmato da SignWell.
 * Da chiamare quando il documento è completed.
 */
export async function downloadCompletedPdf(
  env: Env,
  documentId: string,
): Promise<ArrayBuffer | null> {
  const apiKey = (env as any).SIGNWELL_API_KEY as string | undefined;
  if (!apiKey) return null;
  // Endpoint: /documents/:id/completed_pdf/
  const res = await fetch(`${SIGNWELL_BASE}/documents/${documentId}/completed_pdf/`, {
    headers: { "X-Api-Key": apiKey, Accept: "application/pdf" },
  });
  if (!res.ok) {
    console.error("[signwell] downloadCompletedPdf failed:", res.status, await res.text());
    return null;
  }
  return res.arrayBuffer();
}
