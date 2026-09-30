/**
 * Admin: upload foto profilo per qualsiasi socio (per la pagina di
 * creazione "Nuovo socio" e per editare la foto di un altro utente).
 *
 * Mirror di /api/me/photo ma con target user_id dal path e check admin.
 */
import type { APIRoute } from "astro";
import { getDb, getEnv, now } from "../../../../../server/db";
import { loadUserFromContext } from "../../../../../server/auth";
import { validateFileMagic } from "../../../../../server/file-magic";

export const prerender = false;

const MAX_BYTES = 5 * 1024 * 1024;

export const POST: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  const storage = env?.STORAGE;
  if (!db || !storage) return json({ ok: false, error: "backend" }, 503);
  const me = await loadUserFromContext(ctx);
  if (!me) return json({ ok: false, error: "unauthorized" }, 401);
  if (me.role !== "admin") return json({ ok: false, error: "forbidden" }, 403);

  const targetId = ctx.params.id as string;
  if (!targetId) return json({ ok: false, error: "missing id" }, 400);

  // Verifica che il target esista
  const target = await db
    .prepare("SELECT id, name FROM users WHERE id = ?")
    .bind(targetId)
    .first<{ id: string; name: string }>();
  if (!target) return json({ ok: false, error: "Utente non trovato" }, 404);

  const fd = await ctx.request.formData();
  const file = fd.get("photo");
  if (!file || !(file instanceof File)) return json({ ok: false, error: "Nessun file" }, 400);
  if (file.size > MAX_BYTES) return json({ ok: false, error: `File troppo grande (max ${MAX_BYTES / 1024 / 1024} MB)` }, 413);
  const v = await validateFileMagic(file, ["image/jpeg", "image/png", "image/webp"]);
  if (!v.ok) return json({ ok: false, error: v.error + " (solo JPG/PNG/WebP)" }, 415);
  const detectedMime = v.mime;

  const ext = detectedMime === "image/png" ? "png" : detectedMime === "image/webp" ? "webp" : "jpg";
  const ts = Date.now();
  const key = `profiles/${target.id}/${ts}.${ext}`;
  await storage.put(key, file.stream(), {
    httpMetadata: {
      contentType: detectedMime,
      cacheControl: "public, max-age=31536000, immutable",
    },
  });

  const url = `/r2/${key}`;
  await db
    .prepare(
      `INSERT INTO profiles (user_id, display_name, photo_url, public_visible, email_public, sort_order, updated_at)
       VALUES (?, (SELECT name FROM users WHERE id = ?), ?, 1, 0, 100, ?)
       ON CONFLICT(user_id) DO UPDATE SET photo_url = excluded.photo_url, updated_at = excluded.updated_at`,
    )
    .bind(target.id, target.id, url, now())
    .run();

  return json({ ok: true, photoUrl: url });
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
