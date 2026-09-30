/**
 * GET /api/admin/meetludica/proposals/:id/edit-link-email
 *   Ritorna il template editabile dell'email che invia all'autore il link di
 *   modifica dell'articolo collegato alla proposta. NON invia nulla: l'admin
 *   apre il modal, eventualmente modifica e invia (via l'endpoint outreach).
 *   Richiede che la proposta abbia un articolo collegato (article_id).
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../../../../server/db";
import { loadUserFromContext } from "../../../../../../server/auth";
import { canManageMeetludica } from "../../../../../../server/permissions";
import { getProposal } from "../../../../../../server/meetludica";
import { getArticleLinkInfo } from "../../../../../../server/articles";

export const prerender = false;

export const GET: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return j({ ok: false, error: "backend" }, 503);
  const user = await loadUserFromContext(ctx);
  if (!user) return j({ ok: false, error: "unauthorized" }, 401);
  if (!canManageMeetludica(user)) return j({ ok: false, error: "forbidden" }, 403);

  const id = ctx.params.id as string;
  const proposal = await getProposal(db, id);
  if (!proposal) return j({ ok: false, error: "proposta non trovata" }, 404);
  if (!proposal.articleId) {
    return j({ ok: false, error: "Nessun articolo collegato: collega prima un articolo alla proposta." }, 409);
  }
  const info = await getArticleLinkInfo(db, proposal.articleId);
  if (!info || !info.editToken) {
    return j({ ok: false, error: "Articolo collegato non trovato o senza link di modifica." }, 404);
  }

  const base = (env.SITE_URL ?? "https://nexludica.org").replace(/\/$/, "");
  const editLink = `${base}/meetludica/modifica/${info.editToken}`;
  const firstName = proposal.name.split(/\s+/)[0] || proposal.name;

  const subject = proposal.talkTitle
    ? `MeetLudica — il resoconto di "${proposal.talkTitle}"`
    : `MeetLudica — il resoconto del tuo talk`;
  const body =
`Ciao ${firstName},

grazie per aver presentato il tuo talk a **MeetLudica**

Puoi modificare il resoconto del tuo intervento direttamente da questo link (non serve registrarsi). Abbiamo già fatto una bozza, per cui modifica quello che vuoi e poi puoi direttamente pubblicarlo da qui quando credi sia pronto.

${editLink}

Fino a che non lo decidi te resta privato e visibile solo tramite il tuo link.

Grazie e a presto,
Vittorio e Letizia`;

  return j({ ok: true, recipient: proposal.email, editLink, template: { subject, body } });
};

function j(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { "Content-Type": "application/json" } });
}
