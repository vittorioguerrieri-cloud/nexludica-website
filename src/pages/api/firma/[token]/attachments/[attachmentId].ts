/**
 * GET /api/firma/:token/attachments/:attachmentId
 *   Scarica un singolo allegato. Pubblico via token; il server fetch-a
 *   il file da Drive tramite service account e lo proxa al firmatario.
 *   In questo modo il firmatario non ha bisogno di accesso a Drive.
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../../../server/db";
import { getSignatureByToken } from "../../../../../server/verbali-signatures";
import { getAttachment } from "../../../../../server/verbali-attachments";
import { getAccessToken } from "../../../../../server/drive";

export const prerender = false;

export const GET: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return new Response("backend", { status: 503 });
  const token = ctx.params.token as string;
  const attId = ctx.params.attachmentId as string;
  const sig = await getSignatureByToken(db, token);
  if (!sig) return new Response("not found", { status: 404 });
  if (sig.expiresAt < Date.now() || sig.status === "revoked") {
    return new Response("scaduto", { status: 410 });
  }
  const att = await getAttachment(db, attId);
  if (!att || att.verbaleId !== sig.verbaleId) {
    return new Response("not found", { status: 404 });
  }

  // Fetch del file da Drive con il service account access token
  const accessToken = await getAccessToken(env as Env);
  if (!accessToken) return new Response("drive auth", { status: 503 });
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${att.driveFileId}?alt=media&supportsAllDrives=true`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) {
    console.error("[firma-attachments] drive fetch failed:", res.status);
    return new Response("download failed", { status: 502 });
  }
  // Inoltra al client preservando MIME + filename
  const buf = await res.arrayBuffer();
  return new Response(buf, {
    status: 200,
    headers: {
      "Content-Type": att.mimeType ?? "application/octet-stream",
      "Content-Disposition": `attachment; filename="${att.filename.replace(/["\\]/g, "")}"`,
      "Cache-Control": "no-store",
    },
  });
};
