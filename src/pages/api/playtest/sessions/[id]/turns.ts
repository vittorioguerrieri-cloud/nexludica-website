/**
 * POST /api/playtest/sessions/:id/turns — registra un turno (cronometro).
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../../../server/db";
import { loadUserFromContext } from "../../../../../server/auth";
import { addTurn, getSession } from "../../../../../server/playtest";

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
  const round = Number(body.round ?? 1);
  const durationSeconds = Number(body.durationSeconds ?? 0);
  if (!Number.isFinite(round) || round < 1 || round > 99) return j({ ok: false, error: "round invalido" }, 400);
  if (!Number.isFinite(durationSeconds) || durationSeconds < 1) return j({ ok: false, error: "duration invalida" }, 400);

  // teamPoints: array opzionale [v0, v1, ...] per giochi a N squadre.
  let teamPoints: number[] | null = null;
  if (Array.isArray(body.teamPoints)) {
    teamPoints = body.teamPoints.slice(0, 12).map((v) => Number(v) || 0);
  }

  const turn = await addTurn(db, {
    sessionId,
    round: Math.round(round),
    playerId: typeof body.playerId === "string" && body.playerId ? body.playerId : null,
    durationSeconds,
    points1: nnum(body.points1),
    points2: nnum(body.points2),
    teamPoints,
    event: nstr(body.event, 100),
    recordedBy: user.id,
  });
  return j({ ok: true, turn });
};

function nstr(v: unknown, max: number): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s.slice(0, max) : null;
}
function nnum(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function j(d: unknown, s = 200) { return new Response(JSON.stringify(d), { status: s, headers: { "Content-Type": "application/json" } }); }
