/**
 * GET /api/verbali/:id/preview — anteprima PDF del verbale (binary stream).
 * GET /api/verbali/:id/preview?format=md — anteprima Markdown.
 * GET /api/verbali/:id/preview?attachments=embed — versione "download":
 *   accoda al verbale, NELLO STESSO documento (font incorporati una sola
 *   volta), le pagine degli allegati e un report di bilancio attuale.
 */
import type { APIRoute } from "astro";
import { PDFDocument } from "pdf-lib";
import { getDb, getEnv } from "../../../../server/db";
import { loadUserFromContext } from "../../../../server/auth";
import { getTemplate, getVerbale, renderVerbaleMarkdown, renderVerbalePdf } from "../../../../server/verbali";
import { listSignaturesForVerbale } from "../../../../server/verbali-signatures";
import { listAttachments } from "../../../../server/verbali-attachments";
import { downloadFile } from "../../../../server/drive";
import { getReportData } from "../../../../server/finance";
import { renderFinanceReportInto } from "../../../../server/finance-report";

export const prerender = false;

/**
 * Accoda dentro `out` le pagine di un allegato scaricato da Drive.
 * PDF → copia tutte le pagine; immagini (png/jpeg) → una pagina A4.
 * Tipi non supportati vengono saltati (restano elencati nel verbale).
 */
async function appendAttachmentPages(
  out: any,
  bytes: Uint8Array,
  mimeType: string | null,
  filename: string,
): Promise<void> {
  const mime = (mimeType || "").toLowerCase();
  const isPdf = mime.includes("pdf") || filename.toLowerCase().endsWith(".pdf");
  const isPng = mime.includes("png") || filename.toLowerCase().endsWith(".png");
  const isJpg = mime.includes("jpeg") || mime.includes("jpg") || /\.jpe?g$/i.test(filename);
  if (isPdf) {
    const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const pages = await out.copyPages(src, src.getPageIndices());
    for (const p of pages) out.addPage(p);
  } else if (isPng || isJpg) {
    const img = isPng ? await out.embedPng(bytes) : await out.embedJpg(bytes);
    const PAGE_W = 595, PAGE_H = 842, M = 36;
    const page = out.addPage([PAGE_W, PAGE_H]);
    const maxW = PAGE_W - M * 2, maxH = PAGE_H - M * 2;
    const ratio = img.width / img.height;
    let w = maxW, h = w / ratio;
    if (h > maxH) { h = maxH; w = h * ratio; }
    page.drawImage(img, { x: (PAGE_W - w) / 2, y: (PAGE_H - h) / 2, width: w, height: h });
  }
}

export const GET: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return new Response("backend", { status: 503 });
  const user = await loadUserFromContext(ctx);
  if (!user) return new Response("unauthorized", { status: 401 });
  if (user.role !== "admin") return new Response("forbidden", { status: 403 });

  const id = ctx.params.id as string;
  const v = await getVerbale(db, id);
  if (!v) return new Response("not found", { status: 404 });

  const template = v.templateId ? await getTemplate(db, v.templateId) : null;
  const format = ctx.url.searchParams.get("format");
  if (format === "md") {
    const md = renderVerbaleMarkdown(v, template);
    return new Response(md, {
      status: 200,
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }

  // Carica le firme esistenti così il preview mostra il PDF aggiornato
  // (con firme embedded già accumulate, anche prima del "tutti firmato").
  const sigs = await listSignaturesForVerbale(db, v.id);
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

  // Solo al download (?attachments=embed) accodiamo allegati + bilancio nello
  // STESSO documento, tramite l'hook extend di renderVerbalePdf: i font sono
  // incorporati una sola volta. Il preview embedded resta il solo verbale.
  const wantExtras = ctx.url.searchParams.get("attachments") === "embed";

  let reportData: Awaited<ReturnType<typeof getReportData>> | null = null;
  if (wantExtras) {
    try {
      reportData = await getReportData(db);
    } catch (e) {
      console.error("[verbali] getReportData per download fallito:", e);
    }
  }

  const { pdfBytes } = await renderVerbalePdf(
    v, template, env as Env, sigsForPdf, attsForPdf,
    wantExtras
      ? {
          extend: async ({ pdfDoc, regular, bold, logo }) => {
            // 1) Allegati caricati (es. proforma): pagine reali in coda.
            for (const a of atts) {
              try {
                const bytes = await downloadFile(env as Env, a.driveFileId);
                if (bytes) await appendAttachmentPages(pdfDoc, bytes, a.mimeType, a.filename);
              } catch (e) {
                console.error("[verbali] allegato in download fallito:", a.filename, e);
              }
            }
            // 2) Report di bilancio attuale, disegnato nello stesso doc.
            if (reportData) {
              try {
                await renderFinanceReportInto(pdfDoc, regular, bold, logo, {
                  ...reportData, generatedAt: Date.now(),
                });
              } catch (e) {
                console.error("[verbali] report bilancio in download fallito:", e);
              }
            }
          },
        }
      : undefined,
  );

  return new Response(pdfBytes, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${v.title.replace(/[^a-zA-Z0-9-_ ]+/g, "")}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
};
