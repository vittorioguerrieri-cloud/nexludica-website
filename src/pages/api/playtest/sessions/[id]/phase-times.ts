/**
 * POST /api/playtest/sessions/:id/phase-times — fase speciale cronometrata.
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../../../server/db";
import { loadUserFromContext } from "../../../../../server/auth";
import { addPhaseTime, getSession } from "../../../../../server/playtest";

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
  const name = String(body.name ?? "").trim().slice(0, 60);
  const minutes = Number(body.minutes ?? 0);
  if (!name) return j({ ok: false, error: "Nome obbligatorio" }, 400);
  if (!Number.isFinite(minutes) || minutes <= 0) return j({ ok: false, error: "Minuti non validi" }, 400);

  const phaseTime = await addPhaseTime(db, { sessionId, name, minutes });
  return j({ ok: true, phaseTime });
};

function j(d: unknown, s = 200) { return new Response(JSON.stringify(d), { status: s, headers: { "Content-Type": "application/json" } }); }
