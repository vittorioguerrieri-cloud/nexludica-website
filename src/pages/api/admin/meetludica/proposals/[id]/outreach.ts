/**
 * Outreach email al responsabile di un talk (richiesta disponibilita').
 *
 * GET    /api/admin/meetludica/proposals/:id/outreach
 *   → ritorna { template: { subject, body }, history: [...] }
 *     Il template e' pre-compilato con dati di proposta + (se assegnata) serata.
 *     Cosi' il frontend apre un modal gia' pronto, modificabile.
 *
 * POST   /api/admin/meetludica/proposals/:id/outreach
 *   { subject, body }  → invia email via Resend, registra outreach,
 *                        aggiorna availability_status a 'asked'.
 *
 * Body markdown supportato (stesso renderer dei broadcast).
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../../../../server/db";
import { loadUserFromContext } from "../../../../../../server/auth";
import { canManageMeetludica } from "../../../../../../server/permissions";
import { sendEmail, senderFor, STAFF_CC } from "../../../../../../server/email";
import { renderBroadcastMarkdown } from "../../../../../../server/broadcast-renderer";
import {
  getProposal,
  getEvent,
  listOutreachForProposal,
  recordOutreach,
} from "../../../../../../server/meetludica";

export const prerender = false;

function fmtDate(ts: number): string {
  // DD/MM/YYYY HH:mm in Europe/Rome
  return new Date(ts).toLocaleString("it-IT", {
    timeZone: "Europe/Rome",
    day: "2-digit", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

/** "26 novembre 2026 alle ore 20:00" (ora italiana). */
function fmtDateTime(ts: number): string {
  const d = new Date(ts);
  const date = d.toLocaleDateString("it-IT", {
    timeZone: "Europe/Rome", day: "numeric", month: "long", year: "numeric",
  });
  const time = d.toLocaleTimeString("it-IT", {
    timeZone: "Europe/Rome", hour: "2-digit", minute: "2-digit",
  });
  return `${date} alle ore ${time}`;
}

function buildTemplate(opts: {
  proposal: { name: string; talkTitle: string | null; abstract: string };
  event: { title: string; eventDate: number; location: string | null } | null;
}): { subject: string; body: string } {
  const speakerFirst = opts.proposal.name.split(/\s+/)[0] || opts.proposal.name;
  const talkRef = opts.proposal.talkTitle
    ? `il tuo talk "${opts.proposal.talkTitle}"`
    : `il tuo talk`;

  if (opts.event) {
    const dateTimeStr = fmtDateTime(opts.event.eventDate);
    const subject = `MeetLudica del ${fmtDate(opts.event.eventDate).split(",")[0]} — disponibilita' per ${opts.proposal.talkTitle ?? "il tuo talk"}`;
    const body =
`Ciao ${speakerFirst},

ti scrivo per **MeetLudica**

Stiamo organizzando la serata **${opts.event.title}** del **${dateTimeStr}** su google meet.

**Avresti disponibilita' a presentarlo quella sera?**

Se confermi, ti chiedo anche un breve titolo abstract da pubblicare. Se non ti va per qualsiasi motivo, fammi sapere se ci sono altre date che ti andrebbero (le trovi qui: https://www.nexludica.org/meetludica).

Grazie e a presto,
Vittorio e Letizia`;
    return { subject, body };
  }

  // Caso senza evento assegnato
  const subject = `MeetLudica — disponibilita' per ${opts.proposal.talkTitle ?? "il tuo talk"}`;
  const body =
`Ciao ${speakerFirst},

ti scrivo per **MeetLudica**

Vorremmo programmare ${talkRef} in una delle prossime serate: avresti disponibilita'? Trovi le date qui: https://www.nexludica.org/meetludica

Se confermi, ti chiedo anche un breve titolo abstract da pubblicare.

Grazie e a presto,
Vittorio e Letizia`;
  return { subject, body };
}

export const GET: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return json({ ok: false, error: "backend" }, 503);
  const user = await loadUserFromContext(ctx);
  if (!user) return json({ ok: false, error: "unauthorized" }, 401);
  if (!canManageMeetludica(user)) return json({ ok: false, error: "forbidden" }, 403);

  const id = ctx.params.id as string;
  const proposal = await getProposal(db, id);
  if (!proposal) return json({ ok: false, error: "proposta non trovata" }, 404);

  const event = proposal.eventId ? await getEvent(db, proposal.eventId) : null;
  const template = buildTemplate({
    proposal: { name: proposal.name, talkTitle: proposal.talkTitle, abstract: proposal.abstract },
    event: event ? { title: event.title, eventDate: event.eventDate, location: event.location } : null,
  });
  const history = await listOutreachForProposal(db, id);
  return json({ ok: true, template, history, recipient: proposal.email });
};

export const POST: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return json({ ok: false, error: "backend" }, 503);
  const user = await loadUserFromContext(ctx);
  if (!user) return json({ ok: false, error: "unauthorized" }, 401);
  if (!canManageMeetludica(user)) return json({ ok: false, error: "forbidden" }, 403);

  const id = ctx.params.id as string;
  const proposal = await getProposal(db, id);
  if (!proposal) return json({ ok: false, error: "proposta non trovata" }, 404);

  const body = (await ctx.request.json().catch(() => ({}))) as Record<string, unknown>;
  const subject = String(body.subject ?? "").trim().slice(0, 200);
  const text = String(body.body ?? "").trim().slice(0, 20000);
  if (!subject || !text) {
    return json({ ok: false, error: "Subject e body obbligatori" }, 400);
  }

  const sender = senderFor(env, user);
  const renderedBody = renderBroadcastMarkdown(text);
  const html = `
    <div style="font-family: 'Montserrat', system-ui, sans-serif; max-width: 640px; margin: 0 auto; color: #1b2528; padding: 0 16px;">
      ${renderedBody}
      <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0 16px;">
      <p style="font-size: 12px; color: #b4b4b4; margin: 0;">
        Email inviata da ${sender.name} (${sender.email}) in merito alla tua proposta di talk per MeetLudica.
        Per rispondere, usa la funzione "Rispondi" del tuo client di posta.
      </p>
    </div>
  `;

  const result = await sendEmail(env, {
    from: sender,
    to: proposal.email,
    cc: STAFF_CC,
    subject,
    html,
    replyTo: sender.email,
  });
  if (!result.ok) {
    return json({ ok: false, error: result.error ?? "Invio email fallito" }, 500);
  }

  const outreach = await recordOutreach(db, {
    proposalId: proposal.id,
    eventId: proposal.eventId,
    recipientEmail: proposal.email,
    subject,
    body: text,
    sentBy: user.id,
  });
  return json({ ok: true, outreach });
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
