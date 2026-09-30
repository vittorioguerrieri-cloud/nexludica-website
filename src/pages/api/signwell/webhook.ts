/**
 * POST /api/signwell/webhook
 *
 * Endpoint pubblico (no auth, ma verifica firma webhook quando SignWell la fornisce)
 * che riceve eventi da SignWell. Evento chiave: document_signed (tutti firmato).
 *
 * Quando arriva l'evento, scarichiamo il PDF firmato, lo carichiamo su Drive
 * nella sottocartella "Verbali" e aggiorniamo il verbale a status='signed'.
 *
 * Configurazione lato SignWell: settare il webhook URL a
 *   https://nexludica.org/api/signwell/webhook
 */
import type { APIRoute } from "astro";
import { getDb, getEnv, now } from "../../../server/db";
import { findBySignwellId, updateVerbale } from "../../../server/verbali";
import { downloadCompletedPdf } from "../../../server/signwell";
import { ensureFolder, uploadFile } from "../../../server/drive";

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return new Response("backend", { status: 503 });

  let body: any = {};
  try { body = await ctx.request.json(); } catch { return new Response("invalid json", { status: 400 }); }

  // Struttura tipica eventi SignWell:
  //   { event: { type: "document_signed", ... }, data: { object: <document> } }
  const eventType = body?.event?.type ?? body?.type ?? "";
  const document = body?.data?.object ?? body?.document ?? body;
  const docId = document?.id ?? body?.document_id;

  console.log("[signwell-webhook] event:", eventType, "doc:", docId);

  if (!docId) return new Response("missing document id", { status: 200 });

  const verbale = await findBySignwellId(db, docId);
  if (!verbale) {
    console.warn("[signwell-webhook] document not tracked:", docId);
    return new Response("not tracked", { status: 200 });
  }

  // Eventi rilevanti: document_completed, document_signed, document_voided, document_declined
  if (eventType === "document_completed" || eventType === "document_signed") {
    // Verifica che TUTTI abbiano firmato
    const recipients = document?.recipients ?? [];
    const allSigned = recipients.length > 0 && recipients.every((r: any) =>
      r.status === "completed" || r.status === "signed" || r.status === "Completed"
    );
    if (!allSigned && eventType !== "document_completed") {
      // Solo qualche firma: aggiorna signers ma non ancora "signed" overall
      const updatedSigners = verbale.signers.map((s) => {
        const found = recipients.find((r: any) => r.id === s.signwell_recipient_id);
        if (found && (found.status === "completed" || found.status === "signed")) {
          return { ...s, signed_at: Date.now() };
        }
        return s;
      });
      await updateVerbale(db, verbale.id, { signers: updatedSigners });
      return new Response("partial", { status: 200 });
    }

    // Scarica PDF firmato
    const pdfBuf = await downloadCompletedPdf(env as Env, docId);
    if (!pdfBuf) {
      console.error("[signwell-webhook] cannot download completed PDF for", docId);
      return new Response("download failed", { status: 200 });
    }

    // Upload su Drive: cartella radice → "Verbali firmati"
    const rootId = env.DRIVE_ROOT_FOLDER_ID;
    let driveFileId: string | null = null;
    let driveFileUrl: string | null = null;
    if (rootId) {
      try {
        const verbaliFolder = await ensureFolder(env as Env, rootId, "Verbali firmati");
        if (verbaliFolder) {
          const filename = `${verbale.title.replace(/[^a-zA-Z0-9-_ ]+/g, "")} — firmato.pdf`;
          const file = await uploadFile(env as Env, verbaliFolder.id, {
            name: filename,
            type: "application/pdf",
            arrayBuffer: () => Promise.resolve(pdfBuf),
          });
          if (file) {
            driveFileId = file.id;
            driveFileUrl = file.webViewLink ?? null;
          }
        }
      } catch (e) {
        console.error("[signwell-webhook] drive upload failed:", e);
      }
    }

    // Aggiorna tutti signers come firmati
    const signedSigners = verbale.signers.map((s) => ({ ...s, signed_at: s.signed_at ?? Date.now() }));
    await updateVerbale(db, verbale.id, {
      status: "signed",
      signers: signedSigners,
      driveFileId,
      driveFileUrl,
      signedAt: now(),
    });
    return new Response("ok", { status: 200 });
  }

  if (eventType === "document_voided" || eventType === "document_declined") {
    await updateVerbale(db, verbale.id, { status: "voided" });
    return new Response("voided", { status: 200 });
  }

  return new Response("ignored", { status: 200 });
};
