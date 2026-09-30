/**
 * Endpoint pubblico per inviare un messaggio a un socio dalla sua pagina
 * profilo (/chi-siamo/<slug>). Mittente non vede mai l'email del destinatario.
 *
 * Sicurezza/anti-abuso:
 *  - Honeypot field "company" (se compilato → 200 finto, niente invio)
 *  - Rate limit base via D1 (max 5 messaggi/ora per IP, fail-open se la
 *    tabella contact_messages non esiste)
 *  - Reply-To impostato al sender → il destinatario risponde direttamente
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../server/db";
import { getMemberByUserId, listPublicMembers } from "../../server/profiles";
import { sendEmail } from "../../server/email";

export const prerender = false;

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const POST: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return json({ ok: false, error: "backend" }, 503);

  const body = (await ctx.request.json().catch(() => ({}))) as Record<string, unknown>;
  const userId = String(body.userId ?? "").trim();
  const senderName = String(body.senderName ?? "").trim().slice(0, 100);
  const senderEmail = String(body.senderEmail ?? "").trim().toLowerCase().slice(0, 200);
  const subject = (String(body.subject ?? "").trim() || `Messaggio da ${senderName}`).slice(0, 200);
  const message = String(body.message ?? "").trim().slice(0, 3000);
  const honeypot = String(body.company ?? "").trim();

  if (honeypot) return json({ ok: true }); // honeypot: silent ok

  if (!userId || !senderName || !senderEmail || !message) {
    return json({ ok: false, error: "Compila tutti i campi obbligatori" }, 400);
  }
  if (!/.+@.+\..+/.test(senderEmail)) {
    return json({ ok: false, error: "Email non valida" }, 400);
  }
  if (message.length < 10) {
    return json({ ok: false, error: "Il messaggio e' troppo corto" }, 400);
  }

  // Whitelist: il destinatario deve essere fra i soci PUBBLICAMENTE visibili
  // (sta nella lista di /chi-siamo). Cosi' chi non ha un profilo pubblico o
  // e' pending/suspended/former non riceve email tramite questo endpoint.
  const publicMembers = await listPublicMembers(db);
  const allowed = publicMembers.some((m) => m.userId === userId);
  if (!allowed) {
    return json({ ok: false, error: "Destinatario non disponibile" }, 404);
  }
  const recipient = await getMemberByUserId(db, userId);
  if (!recipient || !recipient.email || recipient.email.endsWith(".invalid")) {
    return json({ ok: false, error: "Destinatario non disponibile" }, 404);
  }

  // Rate limit best-effort (skip se tabella manca)
  const ip = ctx.request.headers.get("CF-Connecting-IP") ?? "0.0.0.0";
  const ipHash = await sha256Hex(ip + ":contact-member");
  try {
    const hourAgo = Date.now() - 60 * 60 * 1000;
    const r = await db
      .prepare("SELECT COUNT(*) as n FROM contact_messages WHERE ip_hash = ? AND created_at > ?")
      .bind(ipHash, hourAgo)
      .first<{ n: number }>();
    if (r && r.n >= 5) {
      return json({ ok: false, error: "Troppi messaggi inviati di recente. Riprova fra un'ora." }, 429);
    }
  } catch { /* tabella mancante → fail-open */ }

  const firstName = recipient.name.split(" ")[0];
  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
      <p>Ciao ${escapeHtml(firstName)},</p>
      <p>Hai ricevuto un nuovo messaggio dalla tua pagina profilo su <strong>nexludica.org</strong>.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 24px 0;">
        <tr><td style="padding: 8px 12px; background: #f8fafb; font-weight: 600; width: 90px;">Da</td><td style="padding: 8px 12px;">${escapeHtml(senderName)} &lt;<a href="mailto:${escapeHtml(senderEmail)}">${escapeHtml(senderEmail)}</a>&gt;</td></tr>
        <tr><td style="padding: 8px 12px; background: #f8fafb; font-weight: 600;">Oggetto</td><td style="padding: 8px 12px;">${escapeHtml(subject)}</td></tr>
      </table>
      <div style="border-left: 4px solid #05abc4; padding: 8px 16px; background: #f8fafb; white-space: pre-wrap;">${escapeHtml(message)}</div>
      <p style="margin-top: 24px; color: #657179; font-size: 13px;">
        Per rispondere, basta rispondere a questa email — verra' recapitata a
        ${escapeHtml(senderName)} (${escapeHtml(senderEmail)}).
      </p>
    </div>
  `;
  const result = await sendEmail(env, {
    to: recipient.email,
    subject: `[NexLudica] ${subject}`,
    html,
    replyTo: senderEmail,
  });
  if (!result.ok) {
    return json({ ok: false, error: "Impossibile inviare l'email" }, 500);
  }

  // Log opzionale (tabella opzionale)
  try {
    await db
      .prepare(
        `INSERT INTO contact_messages (id, recipient_user_id, sender_name, sender_email, subject, message, ip_hash, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(crypto.randomUUID(), userId, senderName, senderEmail, subject, message, ipHash, Date.now())
      .run();
  } catch { /* opzionale */ }

  return json({ ok: true });
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
