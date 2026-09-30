/**
 * POST /api/admin/meetludica/articles/:id/status
 *   { status: "draft" | "published" | "archived" }
 *   Approvazione/ritiro di un articolo da parte dello staff (qualsiasi admin,
 *   senza owner-check). "published" = pubblico; "draft" = privato.
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../../../../server/db";
import { loadUserFromContext } from "../../../../../../server/auth";
import { canManageMeetludica } from "../../../../../../server/permissions";
import { setArticleStatus } from "../../../../../../server/articles";

export const prerender = false;

const VALID = ["draft", "published", "archived"] as const;

export const POST: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return j({ ok: false, error: "backend" }, 503);
  const user = await loadUserFromContext(ctx);
  if (!user) return j({ ok: false, error: "unauthorized" }, 401);
  if (!canManageMeetludica(user)) return j({ ok: false, error: "forbidden" }, 403);

  const id = ctx.params.id as string;
  const body = (await ctx.request.json().catch(() => ({}))) as Record<string, unknown>;
  const status = String(body.status ?? "");
  if (!(VALID as readonly string[]).includes(status)) {
    return j({ ok: false, error: `status non valido (${VALID.join(", ")})` }, 400);
  }
  const ok = await setArticleStatus(db, id, status as (typeof VALID)[number]);
  return ok ? j({ ok: true }) : j({ ok: false, error: "articolo non trovato" }, 404);
};

function j(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { "Content-Type": "application/json" } });
}
