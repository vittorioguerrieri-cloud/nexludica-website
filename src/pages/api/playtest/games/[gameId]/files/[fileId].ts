/**
 * DELETE /api/playtest/games/:gameId/files/:fileId
 *   Rimuove il file da Drive + il record DB.
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../../../../server/db";
import { loadUserFromContext } from "../../../../../../server/auth";
import { deleteGameFile, getGameFileById } from "../../../../../../server/playtest";
import { deleteFile as driveDelete } from "../../../../../../server/drive";

export const prerender = false;

export const DELETE: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return j({ ok: false, error: "backend" }, 503);
  const user = await loadUserFromContext(ctx);
  if (!user) return j({ ok: false, error: "unauthorized" }, 401);

  const fileId = ctx.params.fileId as string;
  const f = await getGameFileById(db, fileId);
  if (!f) return j({ ok: false, error: "not found" }, 404);

  // Best effort: cancella su Drive (se fallisce, comunque rimuoviamo il record
  // DB per non bloccare l'utente).
  try { await driveDelete(env, f.driveFileId); } catch (e) { console.error("[playtest] drive delete failed:", e); }
  await deleteGameFile(db, fileId);
  return j({ ok: true });
};

function j(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { "Content-Type": "application/json" } });
}
