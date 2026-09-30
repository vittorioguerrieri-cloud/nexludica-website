/**
 * DELETE /api/admin/bolli/:id        — rimuove la marca dal pool
 * PATCH  /api/admin/bolli/:id { action: "release" } — la riporta disponibile
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../../server/db";
import { loadUserFromContext } from "../../../../server/auth";
import { deleteBollo, releaseBollo } from "../../../../server/bolli";

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

export const DELETE: APIRoute = async (ctx) => {
  const g = await guard(ctx); if (g.err) return g.err;
  await deleteBollo(g.db!, ctx.params.id as string);
  return j({ ok: true });
};

export const PATCH: APIRoute = async (ctx) => {
  const g = await guard(ctx); if (g.err) return g.err;
  const body = (await ctx.request.json().catch(() => ({}))) as Record<string, unknown>;
  if (body.action === "release") {
    await releaseBollo(g.db!, ctx.params.id as string);
    return j({ ok: true });
  }
  return j({ ok: false, error: "azione non valida" }, 400);
};

function j(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { "Content-Type": "application/json" } });
}
