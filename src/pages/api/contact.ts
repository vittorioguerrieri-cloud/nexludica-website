/**
 * Endpoint del form "Contattaci".
 * Riceve {name, email, subject, message} e inoltra via Resend a info@nexludica.org
 * (con replyTo settato sull'email del mittente).
 *
 * Anti-spam minimale: campo honeypot "website" che deve essere vuoto.
 */
import type { APIRoute } from "astro";
import { getEnv } from "../../server/db";
import { sendEmail } from "../../server/email";

export const prerender = false;

const RECIPIENT = "info@nexludica.org";

export const POST: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;

  let body: Record<string, string> = {};
  const ct = ctx.request.headers.get("Content-Type") ?? "";
  if (ct.includes("application/json")) {
    body = (await ctx.request.json()) as Record<string, string>;
  } else {
    const fd = await ctx.request.formData();
    fd.forEach((v, k) => (body[k] = String(v)));
  }

  // Honeypot: deve essere vuoto
  if ((body.website ?? "").trim()) {
    // Finto OK (non riveliamo all'attaccante che e' stato bloccato)
    return json({ ok: true });
  }

  const name = (body.name ?? "").trim().slice(0, 100);
  const email = (body.email ?? "").trim().slice(0, 200);
  const subject = (body.subject ?? "info").trim().slice(0, 50);
  const message = (body.message ?? "").trim().slice(0, 5000);

  if (!name || !email || !message) {
    return json({ ok: false, error: "Compila nome, email e messaggio." }, 400);
  }
  if (!/.+@.+\..+/.test(email)) {
    return json({ ok: false, error: "Email non valida." }, 400);
  }

  const subjectLabels: Record<string, string> = {
    info: "Informazioni generali",
    collaborazione: "Proposta di collaborazione",
    socio: "Diventare socio",
    altro: "Altro",
  };
  const subjectLabel = subjectLabels[subject] ?? subject;

  const html = `
    <h2>Nuovo messaggio dal form contattaci</h2>
    <p><strong>Da:</strong> ${escapeHtml(name)} &lt;${escapeHtml(email)}&gt;</p>
    <p><strong>Oggetto:</strong> ${escapeHtml(subjectLabel)}</p>
    <hr>
    <p style="white-space:pre-wrap;">${escapeHtml(message)}</p>
  `;

  const result = await sendEmail(env, {
    to: RECIPIENT,
    subject: `[contattaci] ${subjectLabel} — ${name}`,
    html,
    text: `Da: ${name} <${email}>\nOggetto: ${subjectLabel}\n\n${message}`,
    replyTo: email,
  });

  if (!result.ok) {
    return json({ ok: false, error: result.error ?? "Invio fallito" }, 500);
  }
  return json({ ok: true });
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
