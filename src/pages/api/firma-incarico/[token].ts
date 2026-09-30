/**
 * POST /api/firma-incarico/:token
 *   { typedSignature, consent, imageSignatureData?, signatureMethod? }
 *   Registra la firma SES dell'incarico (pubblico). Audit: IP hash, UA.
 *   Best-effort: salva il PDF firmato su Drive ("Incarichi firmati").
 */
import type { APIRoute } from "astro";
import { getDb, getEnv, now as ts } from "../../../server/db";
import { sha256Hex } from "../../../server/verbali-signatures";
import { getIncaricoByToken, getIncaricoForPdf, recordIncaricoSignature } from "../../../server/incarichi";
import { renderIncaricoPdf } from "../../../server/incarico-pdf";
import { ensureFolder, uploadFile } from "../../../server/drive";

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return j({ ok: false, error: "backend" }, 503);
  const token = ctx.params.token as string;
  const inc = await getIncaricoByToken(db, token);
  if (!inc) return j({ ok: false, error: "Link non valido" }, 404);
  if (inc.status === "signed") return j({ ok: false, error: "Documento già firmato" }, 400);
  if (inc.status !== "sent_for_signature") return j({ ok: false, error: "Documento non in firma" }, 400);

  const body = (await ctx.request.json().catch(() => ({}))) as Record<string, unknown>;
  const typed = String(body.typedSignature ?? "").trim();
  const consent = !!body.consent;
  if (!typed) return j({ ok: false, error: "Nome obbligatorio" }, 400);
  if (typed.length > 80) return j({ ok: false, error: "Nome troppo lungo" }, 400);
  if (!consent) return j({ ok: false, error: "Consenso obbligatorio" }, 400);

  let image: string | null = null;
  let method = "typed";
  if (typeof body.imageSignatureData === "string" && body.imageSignatureData) {
    const d = body.imageSignatureData;
    if (!/^data:image\/(png|jpeg|jpg);base64,/i.test(d)) return j({ ok: false, error: "Immagine non valida" }, 400);
    if (d.length > 400_000) return j({ ok: false, error: "Immagine troppo grande" }, 413);
    image = d;
    method = body.signatureMethod === "uploaded" ? "uploaded" : "drawn";
  }

  const ip = ctx.request.headers.get("CF-Connecting-IP")
    ?? ctx.request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ?? "";
  const ipHash = ip ? await sha256Hex(ip) : null;
  const userAgent = (ctx.request.headers.get("User-Agent") ?? "").slice(0, 500);

  const ok = await recordIncaricoSignature(db, token, { typed, image, method, ipHash, userAgent: userAgent || null });
  if (!ok) return j({ ok: false, error: "Registrazione firma fallita" }, 500);

  // Best-effort: PDF firmato su Drive
  try {
    const full = await getIncaricoForPdf(db, inc.id);
    if (full) {
      const bytes = await renderIncaricoPdf(env as Env, full, {
        typed, image, signedAt: Date.now(), ipHash,
      });
      const root = env.DRIVE_ROOT_FOLDER_ID;
      if (root) {
        const folder = await ensureFolder(env as Env, root, "Incarichi firmati");
        if (folder) {
          const safe = full.person_name.replace(/[^a-zA-Z0-9-_ ]+/g, "") || "incarico";
          const file = await uploadFile(env as Env, folder.id, {
            name: `Incarico ${safe} — firmato.pdf`,
            type: "application/pdf",
            arrayBuffer: () => Promise.resolve(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer),
          });
          if (file) {
            await db.prepare("UPDATE incarichi SET signed_pdf_drive_id = ?, updated_at = ? WHERE id = ?")
              .bind(file.id, ts(), inc.id).run();
          }
        }
      }
    }
  } catch (e) {
    console.error("[firma-incarico] drive upload fallito:", e);
  }

  return j({ ok: true, signed: true });
};

function j(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { "Content-Type": "application/json" } });
}
