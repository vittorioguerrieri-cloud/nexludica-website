/**
 * Progetti/ambiti di bilancio.
 *  GET    /api/admin/finance/projects           → lista
 *  POST   /api/admin/finance/projects           → crea { name, kind, color, notes }
 *  PATCH  /api/admin/finance/projects?id=ID      → modifica
 *  DELETE /api/admin/finance/projects?id=ID      → elimina (transazioni → non attribuite)
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../../server/db";
import { loadUserFromContext } from "../../../../server/auth";
import { listProjects, addProject, updateProject, deleteProject } from "../../../../server/finance";

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

export const GET: APIRoute = async (ctx) => {
  const g = await guard(ctx); if (g.err) return g.err;
  return j({ ok: true, projects: await listProjects(g.db!) });
};

export const POST: APIRoute = async (ctx) => {
  const g = await guard(ctx); if (g.err) return g.err;
  const body = (await ctx.request.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    const p = await addProject(g.db!, {
      name: String(body.name ?? ""),
      kind: body.kind != null ? String(body.kind) : undefined,
      color: body.color != null ? String(body.color) : null,
      notes: body.notes != null ? String(body.notes) : null,
    });
    return j({ ok: true, project: p });
  } catch (e) {
    return j({ ok: false, error: e instanceof Error ? e.message : "errore" }, 400);
  }
};

export const PATCH: APIRoute = async (ctx) => {
  const g = await guard(ctx); if (g.err) return g.err;
  const id = new URL(ctx.request.url).searchParams.get("id");
  if (!id) return j({ ok: false, error: "id mancante" }, 400);
  const body = (await ctx.request.json().catch(() => ({}))) as Record<string, unknown>;
  const fields: Parameters<typeof updateProject>[2] = {};
  if (body.name !== undefined) fields.name = String(body.name);
  if (body.kind !== undefined) fields.kind = String(body.kind);
  if (body.color !== undefined) fields.color = body.color == null ? null : String(body.color);
  if (body.notes !== undefined) fields.notes = body.notes == null ? null : String(body.notes);
  if (body.archived !== undefined) fields.archived = Boolean(body.archived);
  const ok = await updateProject(g.db!, id, fields);
  return j({ ok });
};

export const DELETE: APIRoute = async (ctx) => {
  const g = await guard(ctx); if (g.err) return g.err;
  const id = new URL(ctx.request.url).searchParams.get("id");
  if (!id) return j({ ok: false, error: "id mancante" }, 400);
  const ok = await deleteProject(g.db!, id);
  return j({ ok });
};

function j(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { "Content-Type": "application/json" } });
}
