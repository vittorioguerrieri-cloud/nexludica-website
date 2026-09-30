/**
 * PATCH  /api/playtest/sessions/:id — update label/status/notes/playedAt/location
 * DELETE /api/playtest/sessions/:id — elimina la sessione (cascade su turns,
 *        players, observations, OMNI, checklist instances, phase times).
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../../../server/db";
import { loadUserFromContext } from "../../../../../server/auth";
import { deleteSession, getSession, updateSession } from "../../../../../server/playtest";

export const prerender = false;

export const PATCH: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return j({ ok: false, error: "backend" }, 503);
  const user = await loadUserFromContext(ctx);
  if (!user) return j({ ok: false, error: "unauthorized" }, 401);

  const id = ctx.params.id as string;
  const s = await getSession(db, id);
  if (!s) return j({ ok: false, error: "not found" }, 404);

  const body = (await ctx.request.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: Parameters<typeof updateSession>[2] = {};
  if (typeof body.label === "string") patch.label = body.label.trim().slice(0, 80);
  if (body.playedAt !== undefined) patch.playedAt = body.playedAt == null ? null : String(body.playedAt).slice(0, 20);
  if (body.location !== undefined) patch.location = body.location == null ? null : String(body.location).slice(0, 80);
  if (body.notes !== undefined) patch.notes = body.notes == null ? null : String(body.notes).slice(0, 5000);
  if (["planned", "in_progress", "completed", "archived"].includes(String(body.status))) {
    patch.status = body.status as any;
  }
  if (body.teamsOverride !== undefined) {
    if (body.teamsOverride === null) patch.teamsOverride = null;
    else if (Array.isArray(body.teamsOverride)) {
      patch.teamsOverride = body.teamsOverride
        .slice(0, 12)
        .map((t: any) => ({ name: String(t?.name ?? "").trim().slice(0, 30) || "Squadra" }));
    }
  }
  if (body.reportData !== undefined) {
    if (body.reportData === null) patch.reportData = null;
    else if (typeof body.reportData === "object") {
      patch.reportData = body.reportData as any;
    }
  }
  await updateSession(db, id, patch);
  return j({ ok: true });
};

export const DELETE: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return j({ ok: false, error: "backend" }, 503);
  const user = await loadUserFromContext(ctx);
  if (!user) return j({ ok: false, error: "unauthorized" }, 401);

  const id = ctx.params.id as string;
  const s = await getSession(db, id);
  if (!s) return j({ ok: false, error: "not found" }, 404);

  await deleteSession(db, id);
  return j({ ok: true });
};

function j(d: unknown, s = 200) { return new Response(JSON.stringify(d), { status: s, headers: { "Content-Type": "application/json" } }); }
