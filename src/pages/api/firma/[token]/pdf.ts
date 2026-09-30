/**
 * GET /api/firma/:token/pdf
 *
 * Serve il PDF live del verbale al firmatario (pubblico, no auth: il token
 * è il bearer). Include le firme già raccolte (degli altri co-firmatari).
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../../server/db";
import { getSignatureByToken, listSignaturesForVerbale } from "../../../../server/verbali-signatures";
import { getVerbale, getTemplate, renderVerbalePdf } from "../../../../server/verbali";
import { listAttachments } from "../../../../server/verbali-attachments";

export const prerender = false;

export const GET: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return new Response("backend", { status: 503 });
  const token = ctx.params.token as string;
  if (!token) return new Response("token mancante", { status: 400 });

  const sig = await getSignatureByToken(db, token);
  if (!sig) return new Response("not found", { status: 404 });
  if (sig.expiresAt < Date.now() || sig.status === "revoked") {
    return new Response("link scaduto o revocato", { status: 410 });
  }

  const v = await getVerbale(db, sig.verbaleId);
  if (!v) return new Response("verbale not found", { status: 404 });

  const template = v.templateId ? await getTemplate(db, v.templateId) : null;
  const allSigs = await listSignaturesForVerbale(db, v.id);
  const sigsForPdf = allSigs.map((s) => ({
    signerName: s.signerName,
    signerEmail: s.signerEmail,
    typedSignature: s.typedSignature,
    imageSignatureData: s.imageSignatureData,
    signedAt: s.signedAt,
    signerIpHash: s.signerIpHash,
    sentAt: s.sentAt,
    signerUserAgent: s.signerUserAgent,
    signerLocale: s.signerLocale,
    signatureMethod: s.signatureMethod,
    consentGivenAt: s.consentGivenAt,
    documentHash: s.documentHash,
    status: s.status,
  }));

  const atts = await listAttachments(db, v.id);
  const attsForPdf = atts.map((a) => ({
    filename: a.filename, mimeType: a.mimeType, sizeBytes: a.sizeBytes, notes: a.notes,
  }));
  const { pdfBytes } = await renderVerbalePdf(v, template, env, sigsForPdf, attsForPdf);
  return new Response(pdfBytes, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${v.title.replace(/[^a-zA-Z0-9-_ ]+/g, "")}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
};
