/**
 * POST /api/admin/incarichi/:id/send — invia la lettera d'incarico in firma.
 * Genera token, calcola l'hash del PDF, manda l'email al collaboratore (CC staff).
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../../../server/db";
import { loadUserFromContext } from "../../../../../server/auth";
import { getIncaricoForPdf, updateIncarico } from "../../../../../server/incarichi";
import { renderIncaricoPdf } from "../../../../../server/incarico-pdf";
import { generateToken, sha256Hex } from "../../../../../server/verbali-signatures";
import { sendEmail, senderFor, STAFF_CC } from "../../../../../server/email";

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return j({ ok: false, error: "backend" }, 503);
  const user = await loadUserFromContext(ctx);
  if (!user) return j({ ok: false, error: "unauthorized" }, 401);
  if (user.role !== "admin") return j({ ok: false, error: "forbidden" }, 403);

  const id = ctx.params.id as string;
  const inc = await getIncaricoForPdf(db, id);
  if (!inc) return j({ ok: false, error: "incarico non trovato" }, 404);
  if (inc.status === "signed") return j({ ok: false, error: "Già firmato" }, 400);
  if (!inc.person_email) return j({ ok: false, error: "Il collaboratore non ha email" }, 400);

  // Token + hash del documento (lega la firma a questa versione del PDF)
  const token = inc.sign_token || generateToken();
  let documentHash: string | null = null;
  try {
    const bytes = await renderIncaricoPdf(env as Env, inc, null);
    documentHash = await sha256Hex(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  } catch (e) {
    console.error("[incarico-send] hash PDF fallito:", e);
  }

  await updateIncarico(db, id, {
    status: "sent_for_signature",
    sign_token: token,
    sent_at: Date.now(),
    document_hash: documentHash,
  });

  const base = (env.SITE_URL ?? "https://nexludica.org").replace(/\/$/, "");
  const link = `${base}/firma-incarico/${token}`;
  const first = inc.person_name.split(/\s+/)[0] || inc.person_name;
  const sender = senderFor(env, user);
  const html = `
    <div style="font-family:'Montserrat',system-ui,sans-serif;max-width:640px;margin:0 auto;color:#1b2528;padding:0 16px;">
      <p>Gentile ${first},</p>
      <p>ti inviamo la <strong>lettera d'incarico</strong> per <strong>${escapeHtml(inc.project_label)}</strong> da leggere e firmare elettronicamente.</p>
      <p style="margin:24px 0;">
        <a href="${link}" style="display:inline-block;background:#05abc4;color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:8px;">Apri e firma la lettera</a>
      </p>
      <p style="font-size:13px;color:#657179;">Oppure copia questo link: ${link}</p>
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
      <p style="font-size:12px;color:#b4b4b4;">Firma elettronica semplice (eIDAS art. 25). Il documento firmato sarà conservato da NexLudica APS.</p>
    </div>`;

  const result = await sendEmail(env, {
    from: sender,
    to: inc.person_email,
    cc: STAFF_CC,
    subject: `NexLudica — Lettera d'incarico per ${inc.project_label} da firmare`,
    html,
    replyTo: sender.email,
  });
  if (!result.ok) return j({ ok: false, error: result.error ?? "Invio email fallito" }, 500);

  return j({ ok: true, link });
};

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function j(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { "Content-Type": "application/json" } });
}
