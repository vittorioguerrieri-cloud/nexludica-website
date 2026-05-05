/**
 * Invio email via Resend (https://resend.com).
 *
 * - In produzione: serve RESEND_API_KEY (wrangler secret) + dominio FROM_EMAIL
 *   verificato in Resend.
 * - In dev / senza API key: l'email viene loggata su console e ritornata nel
 *   body della response API per permettere il flow di magic link manuale.
 */

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface SendResult {
  ok: boolean;
  /** Quando manca RESEND_API_KEY: il magic link viene esposto qui per debug. */
  loggedOnly?: boolean;
  error?: string;
  id?: string;
}

export async function sendEmail(env: Env, msg: EmailMessage): Promise<SendResult> {
  const apiKey = env.RESEND_API_KEY;
  const from = env.FROM_NAME
    ? `${env.FROM_NAME} <${env.FROM_EMAIL}>`
    : env.FROM_EMAIL;

  // Dev fallback: niente API key, logga e ritorna ok.
  if (!apiKey) {
    console.log("[email] (no RESEND_API_KEY) would send to", msg.to);
    console.log("[email] subject:", msg.subject);
    console.log("[email] html:", msg.html);
    return { ok: true, loggedOnly: true };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: msg.to,
        subject: msg.subject,
        html: msg.html,
        text: msg.text ?? stripHtml(msg.html),
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      return { ok: false, error: `Resend ${res.status}: ${body}` };
    }
    const data = await res.json<{ id: string }>();
    return { ok: true, id: data.id };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Template email di magic link.
 */
export function magicLinkEmail(opts: {
  toName: string;
  link: string;
  fromName: string;
}): EmailMessage {
  const { toName, link, fromName } = opts;
  return {
    to: "", // riempito dal chiamante
    subject: `${fromName}: accedi all'area soci`,
    html: `<!DOCTYPE html>
<html lang="it"><head><meta charset="utf-8"></head>
<body style="font-family:'Montserrat',Arial,sans-serif;background:#f8fafb;margin:0;padding:32px;color:#1b2528;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 1px 4px rgba(0,0,0,0.05)">
    <tr><td>
      <h1 style="font-size:24px;margin:0 0 8px;color:#1b2528">Ciao ${escapeHtml(toName)},</h1>
      <p style="font-size:16px;line-height:1.5;color:#657179;margin:0 0 24px">
        clicca il bottone qui sotto per accedere all'area soci di NexLudica.
        Il link scade tra 15 minuti.
      </p>
      <p style="text-align:center;margin:24px 0">
        <a href="${link}" style="display:inline-block;background:#05abc4;color:#fff;text-decoration:none;font-weight:bold;padding:14px 28px;border-radius:8px;letter-spacing:0.05em">
          ACCEDI ALL'AREA SOCI
        </a>
      </p>
      <p style="font-size:12px;color:#657179;margin:24px 0 0;line-height:1.5">
        Se il bottone non funziona, copia questo link nel browser:<br>
        <a href="${link}" style="color:#05abc4;word-break:break-all">${link}</a>
      </p>
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
      <p style="font-size:11px;color:#b4b4b4;margin:0">
        Se non hai richiesto questo link, ignora questa email. Nessuno avra' accesso al tuo account.
      </p>
    </td></tr>
  </table>
</body></html>`,
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
