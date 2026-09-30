/**
 * POST /api/admin/meetludica/proposals/:id/mark-done
 *
 * Segna un talk come "fatto":
 *  - crea (se non esiste) un articolo PRIVATO (draft) collegato alla proposta,
 *    precompilato con titolo/relatore/abstract della proposta
 *  - archivia la proposta + done_at
 *  - ritorna il link di modifica per l'autore + un template email editabile
 *
 * NON invia l'email: l'admin la rivede e la manda dal modal (via l'endpoint
 * outreach esistente). Cosi' resta sempre modificabile prima dell'invio.
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../../../../server/db";
import { loadUserFromContext } from "../../../../../../server/auth";
import { canManageMeetludica } from "../../../../../../server/permissions";
import {
  getProposal,
  getEvent,
  markProposalDone,
} from "../../../../../../server/meetludica";
import {
  createArticle,
  getArticleLinkInfo,
} from "../../../../../../server/articles";

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return j({ ok: false, error: "backend" }, 503);
  const user = await loadUserFromContext(ctx);
  if (!user) return j({ ok: false, error: "unauthorized" }, 401);
  if (!canManageMeetludica(user)) return j({ ok: false, error: "forbidden" }, 403);

  const id = ctx.params.id as string;
  const proposal = await getProposal(db, id);
  if (!proposal) return j({ ok: false, error: "proposta non trovata" }, 404);

  // 1) Articolo collegato: riusa quello esistente o crea uno stub privato.
  let articleId = proposal.articleId;
  let info = articleId ? await getArticleLinkInfo(db, articleId) : null;
  if (!info) {
    // Data incontro: dalla serata assegnata o oggi
    let meetingDate = new Date().toISOString().slice(0, 10);
    if (proposal.eventId) {
      const ev = await getEvent(db, proposal.eventId);
      if (ev) meetingDate = new Date(ev.eventDate).toISOString().slice(0, 10);
    }
    articleId = await createArticle(db, user.id, {
      title: proposal.talkTitle || `Talk di ${proposal.name}`,
      speaker: proposal.name,
      meetingDate,
      abstract: proposal.abstract,
      status: "draft", // privato finché lo staff non approva
    });
    info = await getArticleLinkInfo(db, articleId);
  }

  // 2) Archivia la proposta + done
  await markProposalDone(db, id, articleId);

  // 3) Link di modifica + template email
  const base = (env.SITE_URL ?? "https://nexludica.org").replace(/\/$/, "");
  const editLink = info?.editToken ? `${base}/meetludica/modifica/${info.editToken}` : null;
  const firstName = proposal.name.split(/\s+/)[0] || proposal.name;
  const talkRef = proposal.talkTitle ? `"${proposal.talkTitle}"` : "il tuo talk";

  const subject = `MeetLudica — scrivi il resoconto di ${proposal.talkTitle ?? "il tuo talk"}`;
  const bodyMd =
`Ciao ${firstName},

grazie per aver presentato ${talkRef} a **MeetLudica**!

Vorremmo pubblicare un resoconto del tuo intervento nell'archivio di NexLudica. Abbiamo già preparato una bozza che puoi **scrivere e modificare liberamente da questo link** (non serve registrarsi):

${editLink ?? "(link non disponibile)"}

Puoi inserire titolo, abstract e il corpo dell'articolo (in markdown semplice). Una volta che hai finito, ce ne occupiamo noi: il nostro staff darà un'occhiata e lo pubblicherà. Fino ad allora resta privato e visibile solo tramite il tuo link.

Se hai dubbi, rispondi pure a questa email.

Grazie ancora e a presto,
NexLudica APS`;

  return j({
    ok: true,
    recipient: proposal.email,
    editLink,
    articleId,
    template: { subject, body: bodyMd },
  });
};

function j(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { "Content-Type": "application/json" } });
}
