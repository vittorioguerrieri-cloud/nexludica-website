/**
 * GET /api/admin/notule/:id/ricevuta — ricevuta di pagamento (PDF).
 * Disponibile solo dopo che il netto risulta pagato alla persona.
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../../../server/db";
import { loadUserFromContext } from "../../../../../server/auth";
import { getNoteForPdf } from "../../../../../server/payments";
import { renderRicevutaPdf } from "../../../../../server/notula-pdf";

export const prerender = false;

export const GET: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return new Response("backend", { status: 503 });
  const user = await loadUserFromContext(ctx);
  if (!user) return new Response("unauthorized", { status: 401 });
  if (user.role !== "admin") return new Response("forbidden", { status: 403 });

  const n = await getNoteForPdf(db, ctx.params.id as string);
  if (!n) return new Response("not found", { status: 404 });
  if (!n.paid_person_at) return new Response("Notula non ancora pagata alla persona", { status: 409 });

  const pres = await db.prepare("SELECT name FROM users WHERE board_role = 'presidente' LIMIT 1").first<{ name: string }>();
  try {
    const bytes = await renderRicevutaPdf(env as Env, n, { legalRepName: pres?.name ?? null });
    return new Response(bytes, {
      status: 200,
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="ricevuta-notula-${n.numero_personale ?? n.numero}-${n.year}.pdf"`, "Cache-Control": "no-store" },
    });
  } catch (e) {
    console.error("[ricevuta]", e);
    return new Response("errore PDF", { status: 500 });
  }
};
