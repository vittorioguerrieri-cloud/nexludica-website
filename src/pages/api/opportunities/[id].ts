/**
 * PATCH  /api/opportunities/:id  — modifica
 * DELETE /api/opportunities/:id  — elimina
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../server/db";
import { loadUserFromContext } from "../../../server/auth";
import { updateOpportunity, deleteOpportunity, getOpportunity } from "../../../server/opportunities";

export const prerender = false;

async function guard(ctx: Parameters<APIRoute>[0]) {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return { err: j({ ok: false, error: "backend" }, 503) };
  const user = await loadUserFromContext(ctx);
  if (!user) return { err: j({ ok: false, error: "unauthorized" }, 401) };
  return { db };
}

export const PATCH: APIRoute = async (ctx) => {
  const g = await guard(ctx); if (g.err) return g.err;
  const id = ctx.params.id as string;
  if (!(await getOpportunity(g.db!, id))) return j({ ok: false, error: "not found" }, 404);
  const b = (await ctx.request.json().catch(() => ({}))) as Record<string, unknown>;
  const f: Parameters<typeof updateOpportunity>[2] = {};
  if (b.kind !== undefined) f.kind = String(b.kind) as any;
  if (b.title !== undefined) f.title = String(b.title);
  if (b.organization !== undefined) f.organization = b.organization == null ? null : String(b.organization);
  if (b.eventDate !== undefined) f.eventDate = b.eventDate == null ? null : String(b.eventDate);
  if (b.endDate !== undefined) f.endDate = b.endDate == null ? null : String(b.endDate);
  if (b.url !== undefined) f.url = b.url == null ? null : String(b.url);
  if (b.location !== undefined) f.location = b.location == null ? null : String(b.location);
  if (b.amount !== undefined) f.amount = b.amount == null ? null : String(b.amount);
  if (b.notes !== undefined) f.notes = b.notes == null ? null : String(b.notes);
  if (b.archived !== undefined) f.archived = Boolean(b.archived);
  await updateOpportunity(g.db!, id, f);
  return j({ ok: true });
};

export const DELETE: APIRoute = async (ctx) => {
  const g = await guard(ctx); if (g.err) return g.err;
  await deleteOpportunity(g.db!, ctx.params.id as string);
  return j({ ok: true });
};

function j(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { "Content-Type": "application/json" } });
}
