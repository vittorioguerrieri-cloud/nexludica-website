/**
 * Upload foto profilo dell'utente loggato.
 * - Accetta multipart/form-data con field "photo"
 * - Tipi accettati: image/jpeg, image/png, image/webp
 * - Max 5 MB
 * - Salva su R2 in profiles/{userId}/{timestamp}.{ext}
 * - Aggiorna profiles.photo_url con il proxy URL pubblico /r2/profiles/...
 *
 * Risposta: { ok: true, photoUrl: "/r2/profiles/..." }
 */
import type { APIRoute } from "astro";
import { getDb, getEnv, now } from "../../../server/db";
import { loadUserFromContext } from "../../../server/auth";

export const prerender = false;

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

export const POST: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  const storage = env?.STORAGE;
  if (!db || !storage) return json({ ok: false, error: "backend" }, 503);
  const user = await loadUserFromContext(ctx);
  if (!user) return json({ ok: false, error: "unauthorized" }, 401);

  const fd = await ctx.request.formData();
  const file = fd.get("photo");
  if (!file || !(file instanceof File)) return json({ ok: false, error: "Nessun file" }, 400);
  if (file.size > MAX_BYTES) return json({ ok: false, error: `File troppo grande (max ${MAX_BYTES / 1024 / 1024} MB)` }, 413);
  if (!ALLOWED.has(file.type)) return json({ ok: false, error: "Tipo file non supportato (solo JPG/PNG/WebP)" }, 415);

  // Estrai estensione dal mime
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const ts = Date.now();
  const key = `profiles/${user.id}/${ts}.${ext}`;
  await storage.put(key, file.stream(), {
    httpMetadata: {
      contentType: file.type,
      cacheControl: "public, max-age=31536000, immutable",
    },
  });

  const url = `/r2/${key}`;
  // Aggiorna anche profiles.photo_url cosi' /chi-siamo riflette subito
  await db
    .prepare(
      `INSERT INTO profiles (user_id, display_name, photo_url, public_visible, email_public, sort_order, updated_at)
       VALUES (?, (SELECT name FROM users WHERE id = ?), ?, 1, 0, 100, ?)
       ON CONFLICT(user_id) DO UPDATE SET photo_url = excluded.photo_url, updated_at = excluded.updated_at`,
    )
    .bind(user.id, user.id, url, now())
    .run();

  return json({ ok: true, photoUrl: url });
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
