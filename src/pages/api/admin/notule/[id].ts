/**
 * PATCH  /api/admin/notule/:id  — aggiorna (solo se draft per i campi importo)
 * DELETE /api/admin/notule/:id  — elimina (rilascia il bollo eventualmente assegnato)
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../../server/db";
import { loadUserFromContext } from "../../../../server/auth";
import { getPaymentNoteById, updatePaymentNote, deletePaymentNote } from "../../../../server/payments";
import { findBolloForNote, releaseBollo } from "../../../../server/bolli";

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
  const e = await getPaymentNoteById(g.db!, id);
  if (!e) return j({ ok: false, error: "not found" }, 404);
  if (e.status !== "draft") return j({ ok: false, error: "Solo le notule in bozza sono modificabili" }, 400);
  const b = (await ctx.request.json().catch(() => ({}))) as Record<string, unknown>;
  const f: Parameters<typeof updatePaymentNote>[2] = {};
  if (b.date !== undefined) f.date = String(b.date);
  if (b.service_description !== undefined) f.service_description = String(b.service_description);
  if (b.service_period_start !== undefined) f.service_period_start = b.service_period_start == null ? null : String(b.service_period_start);
  if (b.service_period_end !== undefined) f.service_period_end = b.service_period_end == null ? null : String(b.service_period_end);
  if (b.hours !== undefined) f.hours = b.hours === "" || b.hours == null ? null : Number(b.hours);
  if (b.project_code !== undefined) f.project_code = b.project_code == null ? null : String(b.project_code);
  if (b.amount_gross !== undefined) f.amount_gross = Number(b.amount_gross);
  if (b.withholding_percentage !== undefined) f.withholding_percentage = Number(b.withholding_percentage);
  if (b.taxable_percentage !== undefined) f.taxable_percentage = Number(b.taxable_percentage);
  if (b.bollo_required !== undefined) f.bollo_required = Boolean(b.bollo_required);
  if (b.notes !== undefined) f.notes = b.notes == null ? null : String(b.notes);
  if (b.status !== undefined) f.status = String(b.status) as any;
  await updatePaymentNote(g.db!, id, f);
  return j({ ok: true });
};

export const DELETE: APIRoute = async (ctx) => {
  const g = await guard(ctx); if (g.err) return g.err;
  const id = ctx.params.id as string;
  // Rilascia il bollo eventualmente assegnato, poi elimina
  const b = await findBolloForNote(g.db!, id);
  if (b) await releaseBollo(g.db!, b.id);
  await deletePaymentNote(g.db!, id);
  return j({ ok: true });
};

function j(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { "Content-Type": "application/json" } });
}
