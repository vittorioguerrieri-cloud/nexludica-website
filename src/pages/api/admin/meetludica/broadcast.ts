/**
 * Admin broadcast email alla mailing list MeetLudica.
 *
 * - POST /api/admin/meetludica/broadcast
 *     { subject, body, dryRun? }
 *   → invia email a tutti i subscribers via BCC. Registra in
 *     meetludica_broadcasts come audit trail.
 *
 *   Se dryRun: ritorna solo il count senza inviare.
 *
 * - GET /api/admin/meetludica/broadcast  → storico broadcasts
 *
 * Implementazione:
 *  - Una sola call a Resend con tutti i subscribers in BCC
 *  - To: info@nexludica.org (cosi' non sembra "BCC-only" spam)
 *  - Reply-To: info@nexludica.org
 *  - HTML body costruito con renderer markdown classico + estensione :::speaker
 *    (vedi server/broadcast-renderer.ts)
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../../server/db";
import { loadUserFromContext } from "../../../../server/auth";
import { canManageMeetludica } from "../../../../server/permissions";
import { sendBatchEmails, senderFor } from "../../../../server/email";
import { renderBroadcastMarkdown } from "../../../../server/broadcast-renderer";
import {
  listSubscribers,
  listBroadcasts,
  recordBroadcast,
  recordBroadcastRecipients,
} from "../../../../server/meetludica";

export const prerender = false;

export const GET: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return json({ ok: false, error: "backend" }, 503);
  const user = await loadUserFromContext(ctx);
  if (!user) return json({ ok: false, error: "unauthorized" }, 401);
  if (!canManageMeetludica(user)) return json({ ok: false, error: "forbidden" }, 403);
  const broadcasts = await listBroadcasts(db);
  return json({ ok: true, broadcasts });
};

export const POST: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return json({ ok: false, error: "backend" }, 503);
  const user = await loadUserFromContext(ctx);
  if (!user) return json({ ok: false, error: "unauthorized" }, 401);
  if (!canManageMeetludica(user)) return json({ ok: false, error: "forbidden" }, 403);

  const body = (await ctx.request.json().catch(() => ({}))) as Record<string, unknown>;
  const subject = String(body.subject ?? "").trim().slice(0, 200);
  const text = String(body.body ?? "").trim().slice(0, 20000);
  const dryRun = !!body.dryRun;

  if (!subject || !text) {
    return json({ ok: false, error: "Subject e body obbligatori" }, 400);
  }

  // Correzione difensiva: un indirizzo incollato sopra un "https://" gia'
  // presente produce href del tipo https://https://esempio.org, che il browser
  // non sa risolvere. Il testo del link resta corretto, quindi l'errore e'
  // invisibile a chi scrive e si scopre solo quando qualcuno ci clicca.
  const body_ = text
    .replace(/https?:\/\/(?=https?:\/\/)/gi, "")
    .replace(/https?:\/\/(?:www\.)?(?=https?:\/\/)/gi, "");

  const subs = await listSubscribers(db);
  if (subs.length === 0) {
    return json({ ok: false, error: "Mailing list vuota" }, 400);
  }
  const emails = subs.map((s) => s.email);

  const bodyHtml = renderBroadcastMarkdown(body_);
  const html = `
    <div style="font-family: 'Montserrat', system-ui, sans-serif; max-width: 640px; margin: 0 auto; color: #1b2528; padding: 0 16px;">
      ${bodyHtml}
      <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0 16px;">
      <p style="font-size: 12px; color: #b4b4b4; margin: 0;">
        Hai ricevuto questa email perche' sei iscrittə alla mailing list di
        MeetLudica (<a href="https://nexludica.org/meetludica" style="color:#05abc4;">nexludica.org/meetludica</a>).
        Per disiscriverti scrivi a
        <a href="mailto:info@nexludica.org" style="color:#05abc4;">info@nexludica.org</a>.
      </p>
    </div>
  `;

  if (dryRun) {
    return json({ ok: true, dryRun: true, recipientCount: emails.length, preview: html });
  }

  // Un messaggio INDIVIDUALE per ciascun iscritto (Resend Batch API), non un
  // unico invio con tutti in BCC: il BCC massivo veniva filtrato/rifiutato dai
  // server riceventi (Gmail, mail universitarie) e molte mail non arrivavano
  // "nemmeno in spam". L'invio 1-a-1 replica le transazionali (che arrivano).
  // Il sender e' la mail dell'utente loggato (se @nexludica.org), altrimenti
  // ricade su FROM_EMAIL.
  const sender = senderFor(env, user);
  // Gli header List-Unsubscribe (RFC 2369 + RFC 8058) sono praticamente
  // obbligatori per mass-mailing su Gmail/Outlook: senza, le mail finiscono
  // sistematicamente in spam/promozioni.
  const host = (env.SITE_URL ?? "nexludica.org").replace(/^https?:\/\//, "");
  const unsubscribeUrl = `${env.SITE_URL ?? "https://nexludica.org"}/meetludica#unsubscribe`;
  const headers = {
    "List-Unsubscribe": `<mailto:${sender.email}?subject=Unsubscribe%20MeetLudica>, <${unsubscribeUrl}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    "List-Id": `MeetLudica <meetludica.${host}>`,
  };

  const messages = emails.map((email) => ({
    from: sender,
    to: email,
    subject,
    html,
    replyTo: sender.email,
    headers,
  }));

  const result = await sendBatchEmails(env, messages);

  if (!result.ok) {
    // Registriamo comunque quanti sono partiti prima dell'errore + i destinatari.
    if (result.sent > 0) {
      const bid = await recordBroadcast(db, subject, body_, result.sent, user.id);
      await recordBroadcastRecipients(db, bid, result.items.map((it) => ({ email: it.to, resendId: it.id })));
    }
    return json({ ok: false, error: result.error ?? "send failed", sent: result.sent }, 500);
  }

  const broadcastId = await recordBroadcast(db, subject, body_, result.sent, user.id);
  await recordBroadcastRecipients(db, broadcastId, result.items.map((it) => ({ email: it.to, resendId: it.id })));

  return json({ ok: true, sent: result.sent });
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
