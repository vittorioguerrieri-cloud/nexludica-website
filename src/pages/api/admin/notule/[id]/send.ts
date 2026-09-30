/**
 * POST /api/admin/notule/:id/send — invia la notula in firma al percipiente.
 * Se richiede la marca, ne assegna una dal pool (claimBollo) qui, in modo da
 * consumarla solo all'invio. Calcola l'hash del PDF e manda l'email (CC staff).
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../../../server/db";
import { loadUserFromContext } from "../../../../../server/auth";
import { getNoteForPdf, setNoteSendState } from "../../../../../server/payments";
import { findBolloForNote, claimBollo } from "../../../../../server/bolli";
import { renderNotulaPdf } from "../../../../../server/notula-pdf";
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
  const n = await getNoteForPdf(db, id);
  if (!n) return j({ ok: false, error: "notula non trovata" }, 404);
  if (n.status === "signed") return j({ ok: false, error: "Già firmata" }, 400);
  if (!n.person_email) return j({ ok: false, error: "Il percipiente non ha email" }, 400);

  // Marca da bollo: assegna dal pool se serve (solo ora, non in anteprima)
  let bollo = n.bollo_required ? await findBolloForNote(db, id) : null;
  if (n.bollo_required && !bollo) {
    bollo = await claimBollo(db, id);
    if (!bollo) return j({ ok: false, error: "Nessuna marca da bollo disponibile nel pool. Caricane in 'Marche da bollo'." }, 409);
  }

  const token = n.sign_token || generateToken();
  let documentHash: string | null = null;
  try {
    const bytes = await renderNotulaPdf(env as Env, n, { bollo: bollo ? { bytes: bollo.image_data, mime: bollo.mime } : null });
    documentHash = await sha256Hex(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  } catch (e) { console.error("[notula-send] hash fallito", e); }

  await setNoteSendState(db, id, token, documentHash);

  const base = (env.SITE_URL ?? "https://nexludica.org").replace(/\/$/, "");
  const link = `${base}/firma-notula/${token}`;
  const first = n.person_name.split(/\s+/)[0] || n.person_name;
  const sender = senderFor(env, user);
  const html = `
    <div style="font-family:'Montserrat',system-ui,sans-serif;max-width:640px;margin:0 auto;color:#1b2528;padding:0 16px;">
      <p>Gentile ${first},</p>
      <p>ti inviamo la <strong>notula n. ${n.numero_personale ?? n.numero}/${n.year}</strong> relativa al compenso per la prestazione svolta, da firmare per accettazione.</p>
      <p style="margin:24px 0;"><a href="${link}" style="display:inline-block;background:#05abc4;color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:8px;">Apri e firma la notula</a></p>
      <p style="font-size:13px;color:#657179;">Oppure copia questo link: ${link}</p>
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
      <p style="font-size:12px;color:#b4b4b4;">Firma elettronica semplice (eIDAS art. 25). Documento conservato da NexLudica APS.</p>
    </div>`;
  const result = await sendEmail(env, {
    from: sender, to: n.person_email, cc: STAFF_CC,
    subject: `NexLudica — Notula n. ${n.numero_personale ?? n.numero}/${n.year} da firmare`,
    html, replyTo: sender.email,
  });
  if (!result.ok) return j({ ok: false, error: result.error ?? "Invio email fallito" }, 500);

  return j({ ok: true, link });
};

function j(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { "Content-Type": "application/json" } });
}
