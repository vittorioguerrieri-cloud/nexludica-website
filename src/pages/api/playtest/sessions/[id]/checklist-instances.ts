/**
 * POST /api/playtest/sessions/:id/checklist-instances
 *   Crea una nuova istanza di checklist per la sessione (Set-up / Inizio /
 *   Fine / Partecipata), opzionalmente associata a un osservatore.
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../../../server/db";
import { loadUserFromContext } from "../../../../../server/auth";
import { createChecklistInstance, getSession, type ChecklistPhase } from "../../../../../server/playtest";

export const prerender = false;

const VALID_PHASES: ChecklistPhase[] = ["setup", "inizio", "fine", "partecipata"];

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
  const phase = String(body.phase ?? "");
  if (!VALID_PHASES.includes(phase as ChecklistPhase)) return j({ ok: false, error: "phase invalida" }, 400);

  const instance = await createChecklistInstance(db, {
    sessionId,
    phase: phase as ChecklistPhase,
    observerUserId: user.id,
    observerName: nstr(body.observerName, 40) ?? user.name?.split(" ")[0] ?? null,
    notes: nstr(body.notes, 500),
  });
  return j({ ok: true, instance });
};

function nstr(v: unknown, max: number): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s.slice(0, max) : null;
}
function j(d: unknown, s = 200) { return new Response(JSON.stringify(d), { status: s, headers: { "Content-Type": "application/json" } }); }
