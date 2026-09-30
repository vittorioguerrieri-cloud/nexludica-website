/**
 * POST /api/firma-notula/:token — registra la firma SES della notula (pubblico).
 * Best-effort: salva il PDF firmato su Drive ("Notule firmate").
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../server/db";
import { sha256Hex } from "../../../server/verbali-signatures";
import { getNoteByToken, getNoteForPdf, recordNoteSignature, setNoteSignedPdf } from "../../../server/payments";
import { findBolloForNote } from "../../../server/bolli";
import { renderNotulaPdf } from "../../../server/notula-pdf";
import { ensureFolder, uploadFile } from "../../../server/drive";

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return j({ ok: false, error: "backend" }, 503);
  const token = ctx.params.token as string;
  const n = await getNoteByToken(db, token);
  if (!n) return j({ ok: false, error: "Link non valido" }, 404);
  if (n.status === "signed") return j({ ok: false, error: "Già firmata" }, 400);
  if (n.status !== "sent_for_signature") return j({ ok: false, error: "Notula non in firma" }, 400);

  const body = (await ctx.request.json().catch(() => ({}))) as Record<string, unknown>;
  const typed = String(body.typedSignature ?? "").trim();
  if (!typed) return j({ ok: false, error: "Nome obbligatorio" }, 400);
  if (typed.length > 80) return j({ ok: false, error: "Nome troppo lungo" }, 400);
  if (!body.consent) return j({ ok: false, error: "Consenso obbligatorio" }, 400);

  let image: string | null = null, method = "typed";
  if (typeof body.imageSignatureData === "string" && body.imageSignatureData) {
    const d = body.imageSignatureData;
    if (!/^data:image\/(png|jpeg|jpg);base64,/i.test(d)) return j({ ok: false, error: "Immagine non valida" }, 400);
    if (d.length > 400_000) return j({ ok: false, error: "Immagine troppo grande" }, 413);
    image = d; method = "drawn";
  }

  const ip = ctx.request.headers.get("CF-Connecting-IP") ?? ctx.request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ?? "";
  const ipHash = ip ? await sha256Hex(ip) : null;
  const userAgent = (ctx.request.headers.get("User-Agent") ?? "").slice(0, 500);

  const ok = await recordNoteSignature(db, token, { typed, image, method, ipHash, userAgent: userAgent || null });
  if (!ok) return j({ ok: false, error: "Registrazione fallita" }, 500);

  try {
    const full = await getNoteForPdf(db, n.id);
    if (full) {
      const b = full.bollo_required ? await findBolloForNote(db, full.id) : null;
      const bytes = await renderNotulaPdf(env as Env, full, {
        bollo: b ? { bytes: b.image_data, mime: b.mime } : null,
        signature: { typed, image, signedAt: Date.now(), ipHash },
      });
      const root = env.DRIVE_ROOT_FOLDER_ID;
      if (root) {
        const folder = await ensureFolder(env as Env, root, "Notule firmate");
        if (folder) {
          const file = await uploadFile(env as Env, folder.id, {
            name: `Notula ${full.numero_personale ?? full.numero}-${full.year} ${full.person_name.replace(/[^a-zA-Z0-9-_ ]+/g, "")} — firmata.pdf`,
            type: "application/pdf",
            arrayBuffer: () => Promise.resolve(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer),
          });
          if (file) await setNoteSignedPdf(db, n.id, file.id);
        }
      }
    }
  } catch (e) { console.error("[firma-notula] drive upload fallito", e); }

  return j({ ok: true, signed: true });
};

function j(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { "Content-Type": "application/json" } });
}
