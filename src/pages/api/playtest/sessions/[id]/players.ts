/**
 * POST /api/playtest/sessions/:id/players — aggiunge un giocatore.
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../../../server/db";
import { loadUserFromContext } from "../../../../../server/auth";
import { addPlayer, getSession } from "../../../../../server/playtest";

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return j({ ok: false, error: "backend" }, 503);
  const user = await loadUserFromContext(ctx);
  if (!user) return j({ ok: false, error: "unauthorized" }, 401);

  const sessionId = ctx.params.id as string;
  const s = await getSession(db, sessionId);
  if (!s) return j({ ok: false, error: "session not found" }, 404);

  const body = (await ctx.request.json().catch(() => ({}))) as Record<string, unknown>;
  const displayName = String(body.displayName ?? "").trim().slice(0, 40);
  if (!displayName) return j({ ok: false, error: "Nome obbligatorio" }, 400);

  let teamIndex: number | null = null;
  if (body.teamIndex != null && body.teamIndex !== "") {
    const n = Number(body.teamIndex);
    if (Number.isFinite(n) && n >= 0 && n < 12) teamIndex = Math.round(n);
  }
  const player = await addPlayer(db, {
    sessionId,
    displayName,
    role: nstr(body.role, 40),
    experience: nstr(body.experience, 20),
    realName: nstr(body.realName, 80),
    notes: nstr(body.notes, 500),
    teamIndex,
  });
  return j({ ok: true, player });
};

function nstr(v: unknown, max: number): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s.slice(0, max) : null;
}
function j(d: unknown, s = 200) { return new Response(JSON.stringify(d), { status: s, headers: { "Content-Type": "application/json" } }); }
