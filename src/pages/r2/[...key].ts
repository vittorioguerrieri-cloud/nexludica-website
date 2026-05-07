/**
 * Proxy pubblico per file R2 dell'archivio articoli.
 * URL: /r2/articles/{userId}/{filename}.pdf -> oggetto R2 con key "articles/..."
 *
 * Per ora i resoconti pubblicati sono accessibili a tutti (sono materiali del
 * MeetLudica). Se in futuro servono ACL, controllare qui che l'articolo
 * associato sia in stato "published".
 */
import type { APIRoute } from "astro";
import { getEnv } from "../../server/db";

export const prerender = false;

export const GET: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const storage = env?.STORAGE;
  if (!storage) return new Response("Storage non disponibile", { status: 503 });

  const keyParts = (ctx.params.key as string | undefined)?.split("/") ?? [];
  const key = keyParts.join("/");
  // Whitelist dei prefissi pubblici
  const ALLOWED_PREFIXES = ["articles/", "profiles/"];
  if (!key || !ALLOWED_PREFIXES.some((p) => key.startsWith(p))) {
    return new Response("Not Found", { status: 404 });
  }

  const obj = await storage.get(key);
  if (!obj) return new Response("Not Found", { status: 404 });

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("etag", obj.httpEtag);
  headers.set("Cache-Control", "public, max-age=3600");
  return new Response(obj.body, { headers });
};
