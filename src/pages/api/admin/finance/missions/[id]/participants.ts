/**
 * Partecipanti di una missione.
 *  POST   /api/admin/finance/missions/:id/participants   → { userId, note? }  (aggiunge/aggiorna)
 *  DELETE /api/admin/finance/missions/:id/participants?userId=UID            (rimuove)
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../../../../server/db";
import { loadUserFromContext } from "../../../../../../server/auth";
import { getMission, addMissionParticipant, removeMissionParticipant } from "../../../../../../server/missions";

export const prerender = false;

async function guard(ctx: Parameters<APIRoute>[0]) {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return { err: j({ ok: false, error: "backend" }, 503) };
  const user = await loadUserFromContext(ctx);
  if (!user) return { err: j({ ok: false, error: "unauthorized" }, 401) };
  if (user.role !== "admin") return { err: j({ ok: false, error: "forbidden" }, 403) };
  return { db };
}

export const POST: APIRoute = async (ctx) => {
  const g = await guard(ctx); if (g.err) return g.err;
  const missionId = ctx.params.id as string;
  if (!(await getMission(g.db!, missionId))) return j({ ok: false, error: "not found" }, 404);
  const b = (await ctx.request.json().catch(() => ({}))) as Record<string, unknown>;
  const userId = b.userId != null ? String(b.userId) : "";
  if (!userId) return j({ ok: false, error: "userId mancante" }, 400);
  const note = b.note != null ? String(b.note) : null;
  await addMissionParticipant(g.db!, missionId, userId, note);
  return j({ ok: true });
};

export const DELETE: APIRoute = async (ctx) => {
  const g = await guard(ctx); if (g.err) return g.err;
  const missionId = ctx.params.id as string;
  const userId = new URL(ctx.request.url).searchParams.get("userId");
  if (!userId) return j({ ok: false, error: "userId mancante" }, 400);
  const ok = await removeMissionParticipant(g.db!, missionId, userId);
  return j({ ok });
};

function j(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { "Content-Type": "application/json" } });
}
