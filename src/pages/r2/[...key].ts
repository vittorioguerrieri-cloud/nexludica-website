/**
 * Proxy pubblico per file R2.
 * URL: /r2/articles/.../<file>.pdf  → key "articles/..."
 *      /r2/profiles/<userId>/<file>.jpg → key "profiles/..."
 *
 * Sicurezza:
 *  - Whitelist di prefissi (articles/, profiles/)
 *  - Per articles: verifica che l'articolo collegato sia in stato `published`
 *    (così draft/archived non sono leak-abili via guessing della key)
 *  - Per profiles: leak ridotto perché URL contiene timestamp casuale, ma
 *    chiunque conosca la key può scaricare. Documentato.
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../server/db";

export const prerender = false;

export const GET: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const storage = env?.STORAGE;
  if (!storage) return new Response("Storage non disponibile", { status: 503 });

  const keyParts = (ctx.params.key as string | undefined)?.split("/") ?? [];
  const key = keyParts.join("/");
  // mmf/: media del catalogo miniature (immagini e render), contenuti immutabili
  const ALLOWED_PREFIXES = ["articles/", "profiles/", "article-media/", "mmf/"];
  if (!key || !ALLOWED_PREFIXES.some((p) => key.startsWith(p))) {
    return new Response("Not Found", { status: 404 });
  }

  // Per articoli, verifica che siano published (no draft/archived leak)
  if (key.startsWith("articles/")) {
    const db = getDb(env);
    if (db) {
      const row = await db
        .prepare(
          "SELECT status FROM meetludica_articles WHERE document_key = ? LIMIT 1",
        )
        .bind(key)
        .first<{ status: string }>();
      if (row && row.status !== "published") {
        return new Response("Not Found", { status: 404 });
      }
      // Se row e' null, lasciamo passare (potrebbe essere un articolo senza
      // record DB ancora — caso unlikely ma fail-open per non bloccare).
    }
  }

  const obj = await storage.get(key);
  if (!obj) return new Response("Not Found", { status: 404 });

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("etag", obj.httpEtag);
  headers.set("Cache-Control", key.startsWith("mmf/") ? "public, max-age=31536000, immutable" : "public, max-age=3600");
  if (key.startsWith("mmf/")) headers.set("X-Robots-Tag", "noindex");
  return new Response(obj.body, { headers });
};
