/**
 * POST /api/verbali/:id/send-for-signing
 *
 * Genera il PDF, lo carica su SignWell, e invia le richieste di firma ai
 * firmatari configurati nel verbale. Aggiorna lo stato → sent_for_signature.
 *
 * Body opzionale:
 *   { test_mode?: boolean, subject?: string, message?: string }
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../../server/db";
import { loadUserFromContext } from "../../../../server/auth";
import {
  getTemplate, getVerbale, renderVerbalePdf, updateVerbale,
  DEFAULT_SIGNERS, typeLabel,
} from "../../../../server/verbali";
import { createDocumentFromPdf } from "../../../../server/signwell";

export const prerender = false;

// A4 page height in points (necessario per la conversione bottom-left → top-left
// che pretende SignWell)
const PAGE_H = 842;

export const POST: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return j({ ok: false, error: "backend" }, 503);
  const user = await loadUserFromContext(ctx);
  if (!user) return j({ ok: false, error: "unauthorized" }, 401);
  if (user.role !== "admin") return j({ ok: false, error: "forbidden" }, 403);

  const id = ctx.params.id as string;
  const v = await getVerbale(db, id);
  if (!v) return j({ ok: false, error: "not found" }, 404);
  if (v.status !== "draft" && v.status !== "generated") {
    return j({ ok: false, error: `Verbale in stato '${v.status}': impossibile inviare` }, 400);
  }

  const body = (await ctx.request.json().catch(() => ({}))) as Record<string, unknown>;
  const test_mode = !!body.test_mode;

  const signers = v.signers.length > 0 ? v.signers : DEFAULT_SIGNERS;
  if (signers.length === 0) return j({ ok: false, error: "Nessun firmatario configurato" }, 400);

  // Genera PDF + signature fields
  const template = v.templateId ? await getTemplate(db, v.templateId) : null;
  const { pdfBytes, signatureFields } = await renderVerbalePdf(v, template, env as Env);

  // Base64 encoding (Workers compatible)
  const pdfBase64 = arrayBufferToBase64(pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength));

  // Mappa recipients
  const recipients = signers.map((s, i) => ({
    id: `signer-${i}`,
    name: s.name,
    email: s.email,
  }));

  // Mappa signature fields → formato SignWell (top-left origin, 1-based page)
  const fields = signatureFields.map((f) => ({
    recipient_id: `signer-${f.recipient_index}`,
    type: "signature" as const,
    page_number: f.page + 1,
    // Conversione coordinate: pdf-lib usa bottom-left, SignWell top-left
    x: Math.round(f.x),
    y: Math.round(PAGE_H - f.y - f.height),
    width: Math.round(f.width),
    height: Math.round(f.height),
    required: true,
  }));

  const subject = typeof body.subject === "string" && body.subject.trim()
    ? body.subject.trim().slice(0, 200)
    : `Verbale ${typeLabel(v.type)} — firma richiesta`;
  const message = typeof body.message === "string"
    ? body.message.trim().slice(0, 1000)
    : `Ti chiediamo di firmare il verbale "${v.title}" della seduta del ${v.meetingDate}.\n\nGrazie,\nNexLudica APS`;

  const result = await createDocumentFromPdf(env as Env, {
    name: v.title,
    subject,
    message,
    test_mode,
    draft: false,
    recipients,
    fields,
    pdf_base64: pdfBase64,
    pdf_filename: `${v.title.replace(/[^a-zA-Z0-9-_ ]+/g, "")}.pdf`,
    cc_emails: ["info@nexludica.org"],
  });

  if (!result.ok) {
    return j({ ok: false, error: result.error }, 502);
  }

  // Aggiorna verbale: status + signwell ID + recipient IDs
  const updatedSigners = signers.map((s, i) => ({
    ...s,
    signwell_recipient_id: `signer-${i}`,
  }));
  await updateVerbale(db, id, {
    status: "sent_for_signature",
    signwellDocumentId: result.document.id,
    signwellSubject: subject,
    signers: updatedSigners,
    sentAt: Date.now(),
  });

  return j({
    ok: true,
    signwellDocumentId: result.document.id,
    recipients: result.document.recipients,
  });
};

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(bin);
}

function j(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { "Content-Type": "application/json" } });
}
