/**
 * POST /api/admin/bolli/upload — multipart, campo `files` (1+ immagini).
 * Inserisce ogni immagine come marca da bollo disponibile nel pool.
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../../server/db";
import { loadUserFromContext } from "../../../../server/auth";
import { createBollo } from "../../../../server/bolli";

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return j({ ok: false, error: "backend" }, 503);
  const user = await loadUserFromContext(ctx);
  if (!user) return j({ ok: false, error: "unauthorized" }, 401);
  if (user.role !== "admin") return j({ ok: false, error: "forbidden" }, 403);

  let form: FormData;
  try { form = await ctx.request.formData(); } catch { return j({ ok: false, error: "form non valido" }, 400); }
  const files = form.getAll("files");
  let inserted = 0, skipped = 0;
  for (const f of files) {
    if (!(f instanceof File) || f.size === 0) continue;
    if (f.size > 1024 * 1024) { skipped++; continue; }
    const bytes = await f.arrayBuffer();
    const head = new Uint8Array(bytes.slice(0, 4));
    let mime: string;
    if (head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47) mime = "image/png";
    else if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) mime = "image/jpeg";
    else { skipped++; continue; }
    await createBollo(db, {
      filename: f.name || `bollo-${Date.now()}.${mime === "image/png" ? "png" : "jpg"}`,
      mime, bytes,
    });
    inserted++;
  }
  return j({ ok: true, inserted, skipped });
};

function j(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { "Content-Type": "application/json" } });
}
