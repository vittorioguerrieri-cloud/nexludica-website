/**
 * PATCH  /api/admin/incarichi/:id  — aggiorna campi
 * DELETE /api/admin/incarichi/:id  — elimina
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../../server/db";
import { loadUserFromContext } from "../../../../server/auth";
import { updateIncarico, deleteIncarico, getIncaricoById } from "../../../../server/incarichi";

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

export const PATCH: APIRoute = async (ctx) => {
  const g = await guard(ctx); if (g.err) return g.err;
  const id = ctx.params.id as string;
  const e = await getIncaricoById(g.db!, id);
  if (!e) return j({ ok: false, error: "not found" }, 404);
  if (e.status !== "draft") return j({ ok: false, error: "Solo le lettere in bozza sono modificabili" }, 400);
  const b = (await ctx.request.json().catch(() => ({}))) as Record<string, unknown>;
  const f: Parameters<typeof updateIncarico>[2] = {};
  if (b.project_label !== undefined) f.project_label = String(b.project_label);
  if (b.object_description !== undefined) f.object_description = b.object_description == null ? null : String(b.object_description);
  if (b.period_from !== undefined) f.period_from = String(b.period_from);
  if (b.period_to !== undefined) f.period_to = String(b.period_to);
  if (b.hours !== undefined) f.hours = b.hours === "" || b.hours == null ? null : Number(b.hours);
  if (b.hourly_rate !== undefined) f.hourly_rate = b.hourly_rate === "" || b.hourly_rate == null ? null : Number(b.hourly_rate);
  if (b.compenso_total !== undefined) f.compenso_total = b.compenso_total === "" || b.compenso_total == null ? null : Number(b.compenso_total);
  if (b.legal_rep_name !== undefined) f.legal_rep_name = b.legal_rep_name == null ? null : String(b.legal_rep_name);
  if (b.notes !== undefined) f.notes = b.notes == null ? null : String(b.notes);
  if (b.status !== undefined) f.status = String(b.status) as any;
  await updateIncarico(g.db!, id, f);
  return j({ ok: true });
};

export const DELETE: APIRoute = async (ctx) => {
  const g = await guard(ctx); if (g.err) return g.err;
  await deleteIncarico(g.db!, ctx.params.id as string);
  return j({ ok: true });
};

function j(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { "Content-Type": "application/json" } });
}
