/**
 * POST /api/firma/:token
 *   Body: { typedSignature: string, consent: true }
 *   Registra la firma con audit trail (IP hash, UA, locale). Pubblico (no auth).
 *
 * Quando tutti i firmatari del verbale hanno firmato, aggiorna il verbale
 * a status='signed' e (best-effort) upload del PDF firmato su Drive.
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../server/db";
import {
  getSignatureByToken, recordSignature, allSigned, sha256Hex,
} from "../../../server/verbali-signatures";
import {
  getVerbale, getTemplate, renderVerbalePdf, updateVerbale,
} from "../../../server/verbali";
import { listSignaturesForVerbale } from "../../../server/verbali-signatures";
import { listAttachments } from "../../../server/verbali-attachments";
import { ensureFolder, uploadFile } from "../../../server/drive";
import { now as ts } from "../../../server/db";

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return j({ ok: false, error: "backend" }, 503);
  const token = ctx.params.token as string;
  if (!token) return j({ ok: false, error: "token mancante" }, 400);

  const body = (await ctx.request.json().catch(() => ({}))) as Record<string, unknown>;
  const typedSignature = String(body.typedSignature ?? "").trim();
  const consent = !!body.consent;
  if (!typedSignature) return j({ ok: false, error: "Nome obbligatorio" }, 400);
  if (typedSignature.length > 80) return j({ ok: false, error: "Nome troppo lungo" }, 400);
  if (!consent) return j({ ok: false, error: "Consenso obbligatorio" }, 400);

  // Validazione immagine firma (opzionale): data URL PNG o JPEG, max 300KB
  let imageSignatureData: string | null = null;
  let signatureMethod: "typed" | "drawn" | "uploaded" = "typed";
  if (typeof body.imageSignatureData === "string" && body.imageSignatureData) {
    const dataUrl = body.imageSignatureData as string;
    if (!/^data:image\/(png|jpeg|jpg);base64,/i.test(dataUrl)) {
      return j({ ok: false, error: "Formato immagine non valido (atteso PNG o JPEG)" }, 400);
    }
    // ~300KB di base64 = ~225KB di binario
    if (dataUrl.length > 400_000) {
      return j({ ok: false, error: "Immagine troppo grande (max ~300KB)" }, 413);
    }
    imageSignatureData = dataUrl;
    const m = String(body.signatureMethod ?? "");
    signatureMethod = (m === "drawn" || m === "uploaded") ? m : "drawn";
  }

  // Audit forensico: IP hash + UA + locale
  const ip = ctx.request.headers.get("CF-Connecting-IP")
    ?? ctx.request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim()
    ?? "";
  const ipHash = ip ? await sha256Hex(ip) : null;
  const userAgent = (ctx.request.headers.get("User-Agent") ?? "").slice(0, 500);
  const locale = (ctx.request.headers.get("Accept-Language") ?? "").slice(0, 100);

  const res = await recordSignature(db, token, {
    typedSignature,
    imageSignatureData,
    signatureMethod,
    ipHash,
    userAgent: userAgent || null,
    locale: locale || null,
  });
  if (!res.ok) return j(res, 400);

  // Verifica se TUTTI hanno firmato → finalizza il verbale
  const sig = res.signature;
  const allDone = await allSigned(db, sig.verbaleId);
  if (allDone) {
    try {
      const v = await getVerbale(db, sig.verbaleId);
      if (v) {
        const template = v.templateId ? await getTemplate(db, v.templateId) : null;
        // Carica tutte le firme per il rendering del PDF finale
        const sigs = await listSignaturesForVerbale(db, sig.verbaleId);
        const sigsForPdf = sigs.map((s) => ({
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

        // Upload su Drive nella cartella "Verbali firmati"
        let driveFileId: string | null = null;
        let driveFileUrl: string | null = null;
        const root = env.DRIVE_ROOT_FOLDER_ID;
        if (root) {
          try {
            const folder = await ensureFolder(env, root, "Verbali firmati");
            if (folder) {
              const safeName = v.title.replace(/[^a-zA-Z0-9-_ ]+/g, "") || "Verbale";
              const file = await uploadFile(env, folder.id, {
                name: `${safeName} — firmato.pdf`,
                type: "application/pdf",
                arrayBuffer: () => Promise.resolve(
                  pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength) as ArrayBuffer
                ),
              });
              if (file) {
                driveFileId = file.id;
                driveFileUrl = file.webViewLink ?? null;
              }
            }
          } catch (e) {
            console.error("[firma] drive upload failed:", e);
          }
        }

        await updateVerbale(db, v.id, {
          status: "signed",
          signedAt: ts(),
          driveFileId,
          driveFileUrl,
        });
      }
    } catch (e) {
      console.error("[firma] finalize verbale failed:", e);
    }
  }

  return j({ ok: true, signed: true, allDone });
};

function j(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { "Content-Type": "application/json" } });
}
