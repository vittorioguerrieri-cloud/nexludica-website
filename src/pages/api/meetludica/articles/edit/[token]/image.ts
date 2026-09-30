/**
 * POST /api/meetludica/articles/edit/:token/image
 *   Carica un'immagine da inserire nel corpo dell'articolo. L'autorizzazione e'
 *   il possesso del token di modifica, come per il resto dell'editor.
 *
 *   Formati: JPEG e PNG. Sono gli unici che pdf-lib sa incorporare, quindi gli
 *   unici che compaiono sia sulla pagina sia nel PDF brandizzato. WebP e GIF
 *   sono rifiutati per non creare immagini visibili online ma assenti nel PDF.
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../../../../server/db";
import { getArticleByEditToken } from "../../../../../../server/articles";

export const prerender = false;

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
};

export const POST: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  const storage = env?.STORAGE;
  if (!db || !storage) return j({ ok: false, error: "backend non disponibile" }, 503);

  const token = ctx.params.token as string;
  const article = token ? await getArticleByEditToken(db, token) : null;
  if (!article) return j({ ok: false, error: "link di modifica non valido" }, 404);

  let fd: FormData;
  try {
    fd = await ctx.request.formData();
  } catch {
    return j({ ok: false, error: "richiesta non valida" }, 400);
  }
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return j({ ok: false, error: "nessun file ricevuto" }, 400);
  }
  if (file.size > MAX_BYTES) {
    return j({ ok: false, error: `immagine troppo grande (max ${MAX_BYTES / 1024 / 1024} MB)` }, 413);
  }
  const ext = ALLOWED[file.type];
  if (!ext) {
    return j({ ok: false, error: "formato non supportato: usa JPG o PNG" }, 415);
  }

  const base = (file.name || "immagine")
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "immagine";
  const key = `article-media/${article.slug}/${Date.now().toString(36)}-${base}.${ext}`;

  try {
    await storage.put(key, file.stream(), {
      httpMetadata: { contentType: file.type, cacheControl: "public, max-age=31536000" },
    });
  } catch (e) {
    console.error("[article-image] upload fallito:", e);
    return j({ ok: false, error: "caricamento non riuscito" }, 500);
  }

  return j({ ok: true, url: `/r2/${key}`, filename: file.name });
};

function j(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { "Content-Type": "application/json" } });
}
