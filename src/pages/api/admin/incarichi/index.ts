/**
 * GET  /api/admin/incarichi        — lista
 * POST /api/admin/incarichi        — crea { user_id, project_label, period_from, period_to, ... }
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../../server/db";
import { loadUserFromContext } from "../../../../server/auth";
import { listIncarichi, createIncarico } from "../../../../server/incarichi";

export const prerender = false;

export const GET: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return j({ ok: false, error: "backend" }, 503);
  const user = await loadUserFromContext(ctx);
  if (!user) return j({ ok: false, error: "unauthorized" }, 401);
  if (user.role !== "admin") return j({ ok: false, error: "forbidden" }, 403);
  return j({ ok: true, incarichi: await listIncarichi(db) });
};

export const POST: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return j({ ok: false, error: "backend" }, 503);
  const user = await loadUserFromContext(ctx);
  if (!user) return j({ ok: false, error: "unauthorized" }, 401);
  if (user.role !== "admin") return j({ ok: false, error: "forbidden" }, 403);
  const b = (await ctx.request.json().catch(() => ({}))) as Record<string, unknown>;
  const user_id = String(b.user_id ?? "");
  const project_label = String(b.project_label ?? "").trim();
  const period_from = String(b.period_from ?? "");
  const period_to = String(b.period_to ?? "");
  if (!user_id || !project_label || !period_from || !period_to) {
    return j({ ok: false, error: "Collaboratore, progetto e periodo sono obbligatori" }, 400);
  }
  try {
    const inc = await createIncarico(db, {
      user_id, project_label, period_from, period_to,
      object_description: b.object_description != null ? String(b.object_description) : null,
      hours: b.hours != null && b.hours !== "" ? Number(b.hours) : null,
      hourly_rate: b.hourly_rate != null && b.hourly_rate !== "" ? Number(b.hourly_rate) : null,
      compenso_total: b.compenso_total != null && b.compenso_total !== "" ? Number(b.compenso_total) : null,
      legal_rep_name: b.legal_rep_name != null ? String(b.legal_rep_name) : null,
      notes: b.notes != null ? String(b.notes) : null,
    });
    return j({ ok: true, incarico: inc });
  } catch (e) {
    return j({ ok: false, error: e instanceof Error ? e.message : "errore" }, 500);
  }
};

function j(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { "Content-Type": "application/json" } });
}
