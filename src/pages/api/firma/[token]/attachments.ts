/**
 * GET /api/firma/:token/attachments
 *   Lista degli allegati del verbale associato al token. Pubblico
 *   (l'accesso è autorizzato dal token segreto della richiesta firma).
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../../server/db";
import { getSignatureByToken } from "../../../../server/verbali-signatures";
import { listAttachments } from "../../../../server/verbali-attachments";

export const prerender = false;

export const GET: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return j({ ok: false, error: "backend" }, 503);
  const token = ctx.params.token as string;
  const sig = await getSignatureByToken(db, token);
  if (!sig) return j({ ok: false, error: "not found" }, 404);
  if (sig.expiresAt < Date.now() || sig.status === "revoked") {
    return j({ ok: false, error: "scaduto" }, 410);
  }
  const items = await listAttachments(db, sig.verbaleId);
  // Espongo solo metadata (no driveViewUrl di chi non ha accesso Drive: il
  // download passa attraverso il nostro endpoint /api/firma/<token>/attachments/<id>)
  const safe = items.map((a) => ({
    id: a.id,
    filename: a.filename,
    mimeType: a.mimeType,
    sizeBytes: a.sizeBytes,
    notes: a.notes,
  }));
  return j({ ok: true, attachments: safe });
};

function j(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { "Content-Type": "application/json" } });
}
