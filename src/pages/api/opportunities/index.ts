/**
 * GET  /api/opportunities  — lista bandi/conferenze
 * POST /api/opportunities  — crea (qualsiasi socio loggato)
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../server/db";
import { loadUserFromContext } from "../../../server/auth";
import { listOpportunities, createOpportunity } from "../../../server/opportunities";

export const prerender = false;

export const GET: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return j({ ok: false, error: "backend" }, 503);
  const user = await loadUserFromContext(ctx);
  if (!user) return j({ ok: false, error: "unauthorized" }, 401);
  return j({ ok: true, items: await listOpportunities(db) });
};

export const POST: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return j({ ok: false, error: "backend" }, 503);
  const user = await loadUserFromContext(ctx);
  if (!user) return j({ ok: false, error: "unauthorized" }, 401);
  const b = (await ctx.request.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    const item = await createOpportunity(db, {
      kind: String(b.kind ?? "") as any,
      title: String(b.title ?? ""),
      organization: b.organization != null ? String(b.organization) : null,
      eventDate: b.eventDate != null ? String(b.eventDate) : null,
      endDate: b.endDate != null ? String(b.endDate) : null,
      url: b.url != null ? String(b.url) : null,
      location: b.location != null ? String(b.location) : null,
      amount: b.amount != null ? String(b.amount) : null,
      notes: b.notes != null ? String(b.notes) : null,
    }, user.id);
    return j({ ok: true, item });
  } catch (e) {
    return j({ ok: false, error: e instanceof Error ? e.message : "errore" }, 400);
  }
};

function j(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { "Content-Type": "application/json" } });
}
