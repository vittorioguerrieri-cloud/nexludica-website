/** GET /api/admin/bolli/:id/image — bytes dell'immagine della marca da bollo. */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../../../server/db";
import { loadUserFromContext } from "../../../../../server/auth";
import { getBolloImage } from "../../../../../server/bolli";

export const prerender = false;

export const GET: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return new Response("backend", { status: 503 });
  const user = await loadUserFromContext(ctx);
  if (!user) return new Response("unauthorized", { status: 401 });
  if (user.role !== "admin") return new Response("forbidden", { status: 403 });

  const id = ctx.params.id ?? "";
  const r = await getBolloImage(db, id);
  if (!r) return new Response("not found", { status: 404 });

  let body: BodyInit;
  if (r.image_data instanceof ArrayBuffer) body = r.image_data;
  else if (ArrayBuffer.isView(r.image_data)) {
    const v = r.image_data as ArrayBufferView;
    body = v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength);
  } else {
    try { body = new Uint8Array(r.image_data as any).buffer; }
    catch { return new Response("decode fail", { status: 500 }); }
  }
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": r.mime || "image/png", "Cache-Control": "private, max-age=300" },
  });
};
