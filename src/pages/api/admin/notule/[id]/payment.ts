/**
 * PATCH /api/admin/notule/:id/payment — set/unset manuale di una gamba di
 * pagamento. Body: { leg: "person" | "f24", paid: boolean }.
 * Fallback per gli F24 aggregati che il match automatico non collega.
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../../../server/db";
import { loadUserFromContext } from "../../../../../server/auth";
import { setNotePaymentLeg } from "../../../../../server/notule-reconcile";

export const prerender = false;

export const PATCH: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return j({ ok: false, error: "backend" }, 503);
  const user = await loadUserFromContext(ctx);
  if (!user) return j({ ok: false, error: "unauthorized" }, 401);
  if (user.role !== "admin") return j({ ok: false, error: "forbidden" }, 403);
  const id = ctx.params.id as string;
  const b = (await ctx.request.json().catch(() => ({}))) as Record<string, unknown>;
  const leg = b.leg === "f24" ? "f24" : b.leg === "person" ? "person" : null;
  if (!leg) return j({ ok: false, error: "leg non valida" }, 400);
  await setNotePaymentLeg(db, id, leg, !!b.paid);
  return j({ ok: true });
};

function j(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { "Content-Type": "application/json" } });
}
