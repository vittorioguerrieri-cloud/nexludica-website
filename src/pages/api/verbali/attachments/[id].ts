/**
 * DELETE /api/verbali/attachments/:id
 *   Rimuove l'allegato (Drive + DB). Solo admin.
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../../server/db";
import { loadUserFromContext } from "../../../../server/auth";
import { deleteAttachment, getAttachment } from "../../../../server/verbali-attachments";
import { deleteFile as driveDelete } from "../../../../server/drive";

export const prerender = false;

export const DELETE: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return j({ ok: false, error: "backend" }, 503);
  const user = await loadUserFromContext(ctx);
  if (!user) return j({ ok: false, error: "unauthorized" }, 401);
  if (user.role !== "admin") return j({ ok: false, error: "forbidden" }, 403);

  const id = ctx.params.id as string;
  const att = await getAttachment(db, id);
  if (!att) return j({ ok: false, error: "not found" }, 404);

  // Best-effort delete su Drive; se fallisce comunque rimuoviamo dal DB.
  try { await driveDelete(env as Env, att.driveFileId); }
  catch (e) { console.error("[verbali] drive delete failed:", e); }
  await deleteAttachment(db, id);
  return j({ ok: true });
};

function j(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { "Content-Type": "application/json" } });
}
