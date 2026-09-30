/**
 * POST /api/admin/finance/receipts
 *   multipart/form-data: transactionId, file (PDF, JPEG, PNG o WebP, max 15 MB)
 *   Allega una ricevuta o fattura a un movimento. Solo amministratori.
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../../../server/db";
import { loadUserFromContext } from "../../../../../server/auth";
import { addReceipt, RECEIPT_MAX_BYTES, RECEIPT_TYPES } from "../../../../../server/finance-receipts";

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db || !env.STORAGE) return j({ ok: false, error: "backend" }, 503);
  const user = await loadUserFromContext(ctx);
  if (!user) return j({ ok: false, error: "unauthorized" }, 401);
  if (user.role !== "admin") return j({ ok: false, error: "forbidden" }, 403);

  let form: FormData;
  try { form = await ctx.request.formData(); }
  catch { return j({ ok: false, error: "form non valido" }, 400); }
  const transactionId = String(form.get("transactionId") ?? "");
  const file = form.get("file");
  if (!transactionId) return j({ ok: false, error: "Movimento mancante" }, 400);
  if (!(file instanceof File) || file.size === 0) return j({ ok: false, error: "Nessun file" }, 400);
  if (!RECEIPT_TYPES[file.type]) return j({ ok: false, error: "Formato non ammesso: PDF, JPEG, PNG o WebP" }, 415);
  if (file.size > RECEIPT_MAX_BYTES) return j({ ok: false, error: `File troppo grande (max ${RECEIPT_MAX_BYTES / 1048576} MB)` }, 413);

  const exists = await db.prepare("SELECT 1 FROM finance_transactions WHERE id = ?").bind(transactionId).first();
  if (!exists) return j({ ok: false, error: "Movimento inesistente" }, 404);

  const receipt = await addReceipt(db, env.STORAGE, {
    transactionId,
    filename: file.name,
    mimeType: file.type,
    bytes: await file.arrayBuffer(),
    userId: user.id,
  });
  return j({ ok: true, receipt: { id: receipt.id, filename: receipt.filename } });
};

function j(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { "Content-Type": "application/json" } });
}
