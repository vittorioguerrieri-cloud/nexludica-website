/**
 * GET  /api/admin/notule  — lista notule (con nome percipiente)
 * POST /api/admin/notule  — crea notula
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../../server/db";
import { loadUserFromContext } from "../../../../server/auth";
import { listPaymentNotesWithPerson, createPaymentNote } from "../../../../server/payments";

export const prerender = false;

export const GET: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return j({ ok: false, error: "backend" }, 503);
  const user = await loadUserFromContext(ctx);
  if (!user) return j({ ok: false, error: "unauthorized" }, 401);
  if (user.role !== "admin") return j({ ok: false, error: "forbidden" }, 403);
  return j({ ok: true, notule: await listPaymentNotesWithPerson(db) });
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
  const date = String(b.date ?? "");
  const service_description = String(b.service_description ?? "").trim();
  const amount_gross = Number(b.amount_gross);
  if (!user_id || !date || !service_description || !Number.isFinite(amount_gross) || amount_gross <= 0) {
    return j({ ok: false, error: "Percipiente, data, prestazione e importo lordo sono obbligatori" }, 400);
  }
  try {
    const note = await createPaymentNote(db, {
      user_id, date, service_description, amount_gross,
      service_period_start: b.service_period_start ? String(b.service_period_start) : null,
      service_period_end: b.service_period_end ? String(b.service_period_end) : null,
      hours: b.hours != null && b.hours !== "" ? Number(b.hours) : null,
      project_code: b.project_code != null ? String(b.project_code) : null,
      withholding_percentage: b.withholding_percentage != null && b.withholding_percentage !== "" ? Number(b.withholding_percentage) : undefined,
      taxable_percentage: b.taxable_percentage != null && b.taxable_percentage !== "" ? Number(b.taxable_percentage) : undefined,
      bollo_required: b.bollo_required === true || b.bollo_required === "1" ? true : b.bollo_required === false || b.bollo_required === "0" ? false : undefined,
      notes: b.notes != null ? String(b.notes) : null,
      incarico_id: b.incarico_id != null ? String(b.incarico_id) : null,
    });
    return j({ ok: true, note });
  } catch (e) {
    return j({ ok: false, error: e instanceof Error ? e.message : "errore" }, 500);
  }
};

function j(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { "Content-Type": "application/json" } });
}
