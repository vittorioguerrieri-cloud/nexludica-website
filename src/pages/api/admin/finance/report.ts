/**
 * GET /api/admin/finance/report
 *   Genera il PDF "Report di bilancio" (riepilogo + fondi per progetto).
 *   Non include l'elenco delle singole transazioni. Solo admin.
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../../server/db";
import { loadUserFromContext } from "../../../../server/auth";
import { getReportData } from "../../../../server/finance";
import { renderFinanceReportPdf } from "../../../../server/finance-report";

export const prerender = false;

export const GET: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return new Response("backend", { status: 503 });
  const user = await loadUserFromContext(ctx);
  if (!user) return new Response("unauthorized", { status: 401 });
  if (user.role !== "admin") return new Response("forbidden", { status: 403 });

  try {
    const data = await getReportData(db);
    const bytes = await renderFinanceReportPdf(env as Env, { ...data, generatedAt: Date.now() });
    const today = new Date().toISOString().slice(0, 10);
    return new Response(bytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="NexLudica-bilancio-${today}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("[finance-report] errore:", e);
    return new Response("errore generazione report", { status: 500 });
  }
};
