/**
 * POST /api/verbali/:id/send-signatures
 *
 * Sostituisce la vecchia integrazione SignWell con la SES proprietaria.
 *
 * Per ogni firmatario del verbale:
 *  1. Crea una riga in verbali_signatures con token UUID univoco
 *  2. Calcola hash SHA-256 del PDF al momento dell'invio (integrità)
 *  3. Invia email con link https://nexludica.org/firma/<token>
 *
 * Aggiorna il verbale a status='sent_for_signature'.
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../../server/db";
import { loadUserFromContext } from "../../../../server/auth";
import {
  getTemplate, getVerbale, renderVerbalePdf, updateVerbale,
  DEFAULT_SIGNERS, typeLabel,
} from "../../../../server/verbali";
import {
  createSignatureRequest, sha256Hex,
} from "../../../../server/verbali-signatures";
import { sendEmail } from "../../../../server/email";

export const prerender = false;

const SITE_URL = "https://nexludica.org";

export const POST: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return j({ ok: false, error: "backend" }, 503);
  const user = await loadUserFromContext(ctx);
  if (!user) return j({ ok: false, error: "unauthorized" }, 401);
  if (user.role !== "admin") return j({ ok: false, error: "forbidden" }, 403);

  const id = ctx.params.id as string;
  const v = await getVerbale(db, id);
  if (!v) return j({ ok: false, error: "not found" }, 404);
  if (v.status !== "draft" && v.status !== "generated") {
    return j({ ok: false, error: `Verbale in stato '${v.status}': impossibile inviare` }, 400);
  }

  const signers = v.signers.length > 0 ? v.signers : DEFAULT_SIGNERS;
  if (signers.length === 0) return j({ ok: false, error: "Nessun firmatario configurato" }, 400);

  // Genera PDF al momento per calcolare hash (integrità del documento)
  const template = v.templateId ? await getTemplate(db, v.templateId) : null;
  const { pdfBytes } = await renderVerbalePdf(v, template, env, []);
  const docHash = await sha256Hex(pdfBytes.buffer.slice(
    pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength
  ) as ArrayBuffer);

  // Crea richiesta firma + manda email a ognuno
  const sent: Array<{ name: string; email: string; ok: boolean; error?: string }> = [];
  for (let i = 0; i < signers.length; i++) {
    const s = signers[i];
    try {
      const sig = await createSignatureRequest(db, {
        verbaleId: v.id,
        signerName: s.name,
        signerEmail: s.email,
        signerOrder: i,
        documentHash: docHash,
      });
      const link = `${SITE_URL}/firma/${sig.token}`;
      const emailRes = await sendEmail(env, {
        to: s.email,
        subject: `Firma richiesta: ${v.title}`,
        html: buildEmailHtml({
          signerName: s.name,
          verbaleTitle: v.title,
          verbaleType: typeLabel(v.type),
          meetingDate: v.meetingDate,
          link,
        }),
      });
      sent.push({
        name: s.name, email: s.email,
        ok: emailRes.ok,
        ...(emailRes.ok ? {} : { error: emailRes.error ?? "send failed" }),
      });
    } catch (e) {
      console.error("[send-signatures]", s.email, e);
      sent.push({ name: s.name, email: s.email, ok: false, error: String(e) });
    }
  }

  await updateVerbale(db, v.id, {
    status: "sent_for_signature",
    sentAt: Date.now(),
  });

  const allOk = sent.every((x) => x.ok);
  return j({ ok: allOk, sent, documentHash: docHash });
};

function buildEmailHtml(opts: {
  signerName: string;
  verbaleTitle: string;
  verbaleType: string;
  meetingDate: string;
  link: string;
}): string {
  const safe = (s: string) => s.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" }[c]!));
  const niceDate = (() => {
    try {
      const [y, m, d] = opts.meetingDate.split("-").map(Number);
      const months = ["gennaio","febbraio","marzo","aprile","maggio","giugno","luglio","agosto","settembre","ottobre","novembre","dicembre"];
      return `${d} ${months[m-1]} ${y}`;
    } catch { return opts.meetingDate; }
  })();

  return `<!doctype html>
<html lang="it"><head><meta charset="utf-8"><title>Firma richiesta</title></head>
<body style="margin:0;padding:0;background:#f8fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1b2528;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#f8fafb;padding:40px 20px;">
    <tr><td align="center">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
        <tr><td style="padding:32px 40px 24px;text-align:center;border-bottom:2px solid #05abc4;">
          <h1 style="margin:0;color:#1b2528;font-size:22px;font-weight:700;">
            <span style="color:#1b2528;">Nex</span><span style="color:#05abc4;">Ludica</span>
          </h1>
          <p style="margin:4px 0 0;color:#657179;font-size:11px;letter-spacing:0.1em;">GAME&nbsp;&nbsp;|&nbsp;&nbsp;RESEARCH&nbsp;&nbsp;|&nbsp;&nbsp;EQUITY</p>
        </td></tr>
        <tr><td style="padding:32px 40px 16px;">
          <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">Ciao <strong>${safe(opts.signerName)}</strong>,</p>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.55;">
            ti chiediamo di firmare elettronicamente il verbale della seduta del <strong>${safe(niceDate)}</strong>:
          </p>
          <p style="margin:0 0 24px;padding:16px;background:#f0f9fb;border-left:3px solid #05abc4;font-size:15px;">
            <strong style="display:block;color:#1b2528;">${safe(opts.verbaleTitle)}</strong>
            <span style="color:#657179;font-size:13px;">${safe(opts.verbaleType)}</span>
          </p>
          <p style="margin:0 0 12px;font-size:14px;line-height:1.55;color:#657179;">
            Sulla pagina di firma potrai consultare il documento, accettare il consenso e completare la firma in 2 minuti.
          </p>
        </td></tr>
        <tr><td align="center" style="padding:8px 40px 32px;">
          <a href="${opts.link}" style="display:inline-block;padding:14px 40px;background:#05abc4;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;border-radius:8px;text-transform:uppercase;letter-spacing:0.05em;">
            Apri e firma →
          </a>
          <p style="margin:16px 0 0;font-size:11px;color:#657179;">Oppure copia questo link nel browser:<br><span style="font-family:monospace;color:#05abc4;word-break:break-all;">${safe(opts.link)}</span></p>
        </td></tr>
        <tr><td style="padding:20px 40px;background:#f8fafb;font-size:11px;color:#657179;line-height:1.5;text-align:center;">
          Il link scade in 30 giorni. La firma elettronica semplice è valida ai sensi del Regolamento eIDAS 910/2014 (art. 25).<br>
          Se non hai richiesto tu questa firma, ignora questa email.<br><br>
          <strong>NexLudica APS</strong> · Vico Barnabiti 10, 16122 Genova · C.F. 95252550108
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function j(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { "Content-Type": "application/json" } });
}
