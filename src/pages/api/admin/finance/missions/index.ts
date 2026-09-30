/**
 * Missioni / trasferte di bilancio.
 *  GET    /api/admin/finance/missions           → lista (con totali)
 *  POST   /api/admin/finance/missions           → crea
 *  PATCH  /api/admin/finance/missions?id=ID      → modifica
 *  DELETE /api/admin/finance/missions?id=ID      → elimina (transazioni → senza missione)
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../../../server/db";
import { loadUserFromContext } from "../../../../../server/auth";
import {
  listMissionsWithTotals, createMission, updateMission, deleteMission,
} from "../../../../../server/missions";

export const prerender = false;

async function guard(ctx: Parameters<APIRoute>[0]) {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return { err: j({ ok: false, error: "backend" }, 503) };
  const user = await loadUserFromContext(ctx);
  if (!user) return { err: j({ ok: false, error: "unauthorized" }, 401) };
  if (user.role !== "admin") return { err: j({ ok: false, error: "forbidden" }, 403) };
  return { db, user };
}

function num(v: unknown): number | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  const n = parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export const GET: APIRoute = async (ctx) => {
  const g = await guard(ctx); if (g.err) return g.err;
  return j({ ok: true, missions: await listMissionsWithTotals(g.db!) });
};

export const POST: APIRoute = async (ctx) => {
  const g = await guard(ctx); if (g.err) return g.err;
  const b = (await ctx.request.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    const m = await createMission(g.db!, {
      title: String(b.title ?? ""),
      opportunityId: b.opportunityId != null ? String(b.opportunityId) : null,
      startDate: b.startDate != null ? String(b.startDate) : null,
      endDate: b.endDate != null ? String(b.endDate) : null,
      location: b.location != null ? String(b.location) : null,
      budgetEur: num(b.budgetEur) ?? null,
      status: b.status === "conclusa" ? "conclusa" : "pianificata",
      notes: b.notes != null ? String(b.notes) : null,
    }, g.user!.id);
    return j({ ok: true, mission: m });
  } catch (e) {
    return j({ ok: false, error: e instanceof Error ? e.message : "errore" }, 400);
  }
};

export const PATCH: APIRoute = async (ctx) => {
  const g = await guard(ctx); if (g.err) return g.err;
  const id = new URL(ctx.request.url).searchParams.get("id");
  if (!id) return j({ ok: false, error: "id mancante" }, 400);
  const b = (await ctx.request.json().catch(() => ({}))) as Record<string, unknown>;
  const fields: Parameters<typeof updateMission>[2] = {};
  if (b.title !== undefined) fields.title = String(b.title);
  if (b.opportunityId !== undefined) fields.opportunityId = b.opportunityId == null ? null : String(b.opportunityId);
  if (b.startDate !== undefined) fields.startDate = b.startDate == null ? null : String(b.startDate);
  if (b.endDate !== undefined) fields.endDate = b.endDate == null ? null : String(b.endDate);
  if (b.location !== undefined) fields.location = b.location == null ? null : String(b.location);
  if (b.budgetEur !== undefined) fields.budgetEur = num(b.budgetEur) ?? null;
  if (b.status !== undefined) fields.status = b.status === "conclusa" ? "conclusa" : "pianificata";
  if (b.notes !== undefined) fields.notes = b.notes == null ? null : String(b.notes);
  if (b.archived !== undefined) fields.archived = Boolean(b.archived);
  const ok = await updateMission(g.db!, id, fields);
  return j({ ok });
};

export const DELETE: APIRoute = async (ctx) => {
  const g = await guard(ctx); if (g.err) return g.err;
  const id = new URL(ctx.request.url).searchParams.get("id");
  if (!id) return j({ ok: false, error: "id mancante" }, 400);
  const ok = await deleteMission(g.db!, id);
  return j({ ok });
};

function j(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { "Content-Type": "application/json" } });
}
