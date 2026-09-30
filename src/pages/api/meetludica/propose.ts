/**
 * Endpoint pubblico per la proposta di un talk MeetLudica.
 * POST con { name, email, talkTitle?, abstract, company? (honeypot) }
 *
 * - Honeypot + rate-limit best-effort
 * - INSERT in meetludica_proposals (status='pending')
 * - Email a info@nexludica.org con Reply-To = proponente
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../server/db";
import { sendEmail } from "../../../server/email";
import { addProposal } from "../../../server/meetludica";

export const prerender = false;

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
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
  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const talkTitle = String(body.talkTitle ?? "").trim() || null;
  const abstract = String(body.abstract ?? "").trim();
  const honeypot = String(body.company ?? "").trim();

  if (honeypot) return json({ ok: true });

  if (!name || !email || !abstract) {
    return json({ ok: false, error: "Nome, email e abstract sono obbligatori" }, 400);
  }
  if (!/.+@.+\..+/.test(email)) {
    return json({ ok: false, error: "Email non valida" }, 400);
  }
  if (abstract.length < 30) {
    return json({ ok: false, error: "L'abstract è troppo corto (minimo 30 caratteri)" }, 400);
  }

  // Rate-limit: max 3 proposte/ora per IP
  const ip = ctx.request.headers.get("CF-Connecting-IP") ?? "0.0.0.0";
  const ipHash = await sha256Hex("meetludica-prop:" + ip);
  try {
    const hourAgo = Date.now() - 60 * 60 * 1000;
    const r = await db
      .prepare("SELECT COUNT(*) as n FROM meetludica_proposals WHERE ip_hash = ? AND created_at > ?")
      .bind(ipHash, hourAgo)
      .first<{ n: number }>();
    if (r && r.n >= 3) {
      return json({ ok: false, error: "Troppe proposte recenti. Riprova fra un'ora." }, 429);
    }
  } catch { /* fail-open */ }

  try {
    await addProposal(db, { name, email, talkTitle, abstract, ipHash });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ ok: false, error: msg }, 500);
  }

  // Email a info@nexludica.org
  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 640px; margin: 0 auto;">
      <h2 style="color: #1b2528;">Nuova proposta di talk per MeetLudica</h2>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr><td style="padding: 8px 12px; background: #f8fafb; font-weight: 600; width: 120px;">Nome</td>
            <td style="padding: 8px 12px;">${escapeHtml(name)}</td></tr>
        <tr><td style="padding: 8px 12px; background: #f8fafb; font-weight: 600;">Email</td>
            <td style="padding: 8px 12px;"><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></td></tr>
        ${talkTitle ? `
        <tr><td style="padding: 8px 12px; background: #f8fafb; font-weight: 600;">Titolo</td>
            <td style="padding: 8px 12px;"><strong>${escapeHtml(talkTitle)}</strong></td></tr>` : ""}
      </table>
      <h3 style="color: #1b2528; margin-top: 24px;">Abstract</h3>
      <div style="border-left: 4px solid #05abc4; padding: 12px 16px; background: #f8fafb; white-space: pre-wrap;">${escapeHtml(abstract)}</div>
      <p style="margin-top: 24px; color: #657179; font-size: 13px;">
        Per rispondere, basta rispondere a questa email — andra' direttamente a ${escapeHtml(name)} (${escapeHtml(email)}).
      </p>
    </div>
  `;
  await sendEmail(env, {
    to: "info@nexludica.org",
    subject: `[MeetLudica] Proposta talk: ${talkTitle || name}`,
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
