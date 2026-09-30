/**
 * Endpoint pubblico per iscrizione alla mailing list MeetLudica.
 *
 * Workflow:
 *   1. POST con { name, email, motivation?, company? (honeypot) }
 *   2. Honeypot check: se "company" e' compilato, finto-ok silenzioso
 *   3. Rate-limit best-effort tramite tabella meetludica_subscribers
 *   4. INSERT nel DB (UNIQUE email → 409 se gia' iscrittə)
 *   5. Email a info@nexludica.org con Reply-To = email del subscriber
 *   6. (opzionale) Email di conferma al subscriber stesso
 */
import type { APIRoute } from "astro";
import { getDb, getEnv, now } from "../../../server/db";
import { sendEmail } from "../../../server/email";

export const prerender = false;

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export const POST: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return json({ ok: false, error: "backend" }, 503);

  const body = (await ctx.request.json().catch(() => ({}))) as Record<string, unknown>;
  const name = String(body.name ?? "").trim().slice(0, 100);
  const email = String(body.email ?? "").trim().toLowerCase().slice(0, 200);
  const motivation = String(body.motivation ?? "").trim().slice(0, 1000);
  const honeypot = String(body.company ?? "").trim();

  // Honeypot — finta success per non far capire al bot che ha fallito
  if (honeypot) return json({ ok: true });

  if (!name || !email) return json({ ok: false, error: "Nome ed email sono obbligatori" }, 400);
  if (!/.+@.+\..+/.test(email)) return json({ ok: false, error: "Email non valida" }, 400);

  // Rate-limit best-effort: max 5 iscrizioni/ora per IP
  const ip = ctx.request.headers.get("CF-Connecting-IP") ?? "0.0.0.0";
  const ipHash = await sha256Hex("meetludica-sub:" + ip);
  try {
    const hourAgo = Date.now() - 60 * 60 * 1000;
    const r = await db
      .prepare("SELECT COUNT(*) as n FROM meetludica_subscribers WHERE ip_hash = ? AND created_at > ?")
      .bind(ipHash, hourAgo)
      .first<{ n: number }>();
    if (r && r.n >= 5) {
      return json({ ok: false, error: "Troppe iscrizioni recenti. Riprova fra un'ora." }, 429);
    }
  } catch { /* fail-open */ }

  // INSERT (UNIQUE email — se duplicate, gestione gentile)
  try {
    await db
      .prepare(
        `INSERT INTO meetludica_subscribers (id, name, email, motivation, ip_hash, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(crypto.randomUUID(), name, email, motivation || null, ipHash, now())
      .run();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/UNIQUE/i.test(msg)) {
      return json({ ok: false, error: "Sei già iscrittə alla mailing list con questa email." }, 409);
    }
    return json({ ok: false, error: "Errore database: " + msg }, 500);
  }

  // Avviso admin a info@nexludica.org
  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1b2528;">Nuova iscrizione alla mailing list MeetLudica</h2>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr><td style="padding: 8px 12px; background: #f8fafb; font-weight: 600; width: 120px;">Nome</td>
            <td style="padding: 8px 12px;">${escapeHtml(name)}</td></tr>
        <tr><td style="padding: 8px 12px; background: #f8fafb; font-weight: 600;">Email</td>
            <td style="padding: 8px 12px;"><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></td></tr>
        ${motivation ? `
        <tr><td style="padding: 8px 12px; background: #f8fafb; font-weight: 600; vertical-align: top;">Note</td>
            <td style="padding: 8px 12px; white-space: pre-wrap;">${escapeHtml(motivation)}</td></tr>` : ""}
      </table>
      <p style="margin-top: 24px; color: #657179; font-size: 13px;">
        Per rispondere puoi semplicemente rispondere a questa email — il destinatario sarà
        ${escapeHtml(name)} (${escapeHtml(email)}).
      </p>
    </div>
  `;
  const adminTo = env.FROM_EMAIL ? "info@nexludica.org" : "info@nexludica.org";
  await sendEmail(env, {
    to: adminTo,
    subject: `[MeetLudica] Nuova iscrizione: ${name}`,
    html,
    replyTo: email,
  });

  return json({ ok: true });
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
