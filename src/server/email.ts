/**
 * Invio email via Resend (https://resend.com).
 *
 * - In produzione: serve RESEND_API_KEY (wrangler secret) + dominio FROM_EMAIL
 *   verificato in Resend.
 * - In dev / senza API key: l'email viene loggata su console e ritornata nel
 *   body della response API per permettere il flow di magic link manuale.
 */

export interface EmailMessage {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  /** Recipient in BCC (utile per broadcast a mailing list). */
  bcc?: string[];
  /** Recipient in CC (visibili al destinatario). */
  cc?: string[];
  /** Header custom (es. List-Unsubscribe per broadcast). */
  headers?: Record<string, string>;
  /**
   * Override del mittente. Se assente, viene usato {FROM_NAME, FROM_EMAIL} env.
   * IMPORTANTE: l'email deve essere su un dominio verificato in Resend
   * (oggi: @nexludica.org). Resend rifiuta gli altri.
   */
  from?: { email: string; name?: string };
}

/** Staff sempre in CC sulle email verso relatori/autori (Vittorio e Letizia). */
export const STAFF_CC = [
  "vittorio.guerrieri@nexludica.org",
  "letizia.vaccarella@nexludica.org",
];

export interface SendResult {
  ok: boolean;
  /** Quando manca RESEND_API_KEY: il magic link viene esposto qui per debug. */
  loggedOnly?: boolean;
  error?: string;
  id?: string;
}

export async function sendEmail(env: Env, msg: EmailMessage): Promise<SendResult> {
  const apiKey = env.RESEND_API_KEY;
  const fromEmail = msg.from?.email ?? env.FROM_EMAIL;
  const fromName = msg.from?.name ?? env.FROM_NAME;
  const from = fromName ? `${fromName} <${fromEmail}>` : fromEmail;

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
        ...(msg.replyTo ? { reply_to: msg.replyTo } : {}),
        ...(msg.bcc && msg.bcc.length > 0 ? { bcc: msg.bcc } : {}),
        ...(msg.cc && msg.cc.length > 0 ? { cc: msg.cc } : {}),
        ...(msg.headers ? { headers: msg.headers } : {}),
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

export interface BatchResult {
  ok: boolean;
  sent: number;
  error?: string;
  /** Mappa destinatario -> id messaggio Resend (per tracciare la consegna). */
  items: Array<{ to: string; id: string | null }>;
}

/**
 * Invio di MOLTE email come messaggi INDIVIDUALI (un destinatario ciascuno),
 * tramite Resend Batch API (max 100 per chiamata, le suddividiamo in chunk).
 *
 * Perche' non il BCC unico: un singolo messaggio con decine di destinatari in
 * BCC + header bulk e' filtrato/rifiutato in modo aggressivo dai server
 * riceventi (Gmail, mail universitarie) quando il dominio non ha reputazione
 * di invio massivo -> molte mail non arrivano "nemmeno in spam". Mandare invece
 * un messaggio 1-a-1 per ciascuno replica lo schema delle transazionali (che
 * arrivano) e migliora drasticamente la consegna.
 */
export async function sendBatchEmails(env: Env, messages: EmailMessage[]): Promise<BatchResult> {
  const apiKey = env.RESEND_API_KEY;
  const toStr = (t: string | string[]) => (Array.isArray(t) ? t[0] ?? "" : t);
  if (messages.length === 0) return { ok: true, sent: 0, items: [] };

  if (!apiKey) {
    console.log("[email] (no RESEND_API_KEY) would batch-send", messages.length, "emails");
    return { ok: true, sent: messages.length, items: messages.map((m) => ({ to: toStr(m.to), id: null })) };
  }

  let sent = 0;
  const items: Array<{ to: string; id: string | null }> = [];
  const CHUNK = 100;
  for (let i = 0; i < messages.length; i += CHUNK) {
    const chunk = messages.slice(i, i + CHUNK);
    const payload = chunk.map((m) => {
      const fromEmail = m.from?.email ?? env.FROM_EMAIL;
      const fromName = m.from?.name ?? env.FROM_NAME;
      const from = fromName ? `${fromName} <${fromEmail}>` : fromEmail;
      return {
        from,
        to: m.to,
        subject: m.subject,
        html: m.html,
        text: m.text ?? stripHtml(m.html),
        ...(m.replyTo ? { reply_to: m.replyTo } : {}),
        ...(m.headers ? { headers: m.headers } : {}),
      };
    });
    try {
      const res = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.text();
        return { ok: false, sent, error: `Resend batch ${res.status}: ${body}`, items };
      }
      // La risposta batch ha data[] nello stesso ordine dell'input.
      const data = await res.json<{ data?: Array<{ id: string }> }>().catch(() => ({ data: [] }));
      const ids = data.data ?? [];
      chunk.forEach((m, j) => items.push({ to: toStr(m.to), id: ids[j]?.id ?? null }));
      sent += chunk.length;
    } catch (e) {
      return { ok: false, sent, error: String(e), items };
    }
  }
  return { ok: true, sent, items };
}

/**
 * Restituisce l'indirizzo sender da usare per un'email inviata "a nome di"
 * un utente loggato. Se l'email del profilo e' su un dominio verificato in
 * Resend (oggi solo @nexludica.org), la usa; altrimenti ricade sul FROM_EMAIL
 * globale. Questo evita che Resend rifiuti l'invio per dominio non verificato.
 */
export function senderFor(
  env: Env,
  user: { email: string; name: string },
): { email: string; name: string } {
  const allowedDomain = "nexludica.org";
  const fallback = {
    email: env.FROM_EMAIL ?? `noreply@${allowedDomain}`,
    name: env.FROM_NAME ?? "NexLudica APS",
  };
  if (!user?.email) return fallback;
  const m = /@([a-z0-9.-]+)$/i.exec(user.email);
  if (!m) return fallback;
  const domain = m[1].toLowerCase();
  if (domain !== allowedDomain && !domain.endsWith(`.${allowedDomain}`)) {
    return fallback;
  }
  return {
    email: user.email,
    name: user.name?.trim() || env.FROM_NAME || "NexLudica APS",
  };
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
        <a href="${escapeHtml(link)}" style="display:inline-block;background:#05abc4;color:#fff;text-decoration:none;font-weight:bold;padding:14px 28px;border-radius:8px;letter-spacing:0.05em">
          ACCEDI ALL'AREA SOCI
        </a>
      </p>
      <p style="font-size:12px;color:#657179;margin:24px 0 0;line-height:1.5">
        Se il bottone non funziona, copia questo link nel browser:<br>
        <a href="${escapeHtml(link)}" style="color:#05abc4;word-break:break-all">${escapeHtml(link)}</a>
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
