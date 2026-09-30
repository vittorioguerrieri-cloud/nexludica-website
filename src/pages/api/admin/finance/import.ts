/**
 * POST /api/admin/finance/import
 *   multipart/form-data: file=<zip export banca>
 *   Importa movimenti conto + carta dall'export. Idempotente (dedup).
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../../server/db";
import { loadUserFromContext } from "../../../../server/auth";
import { importBankZip } from "../../../../server/finance";

export const prerender = false;

// L'export della banca include i giustificativi e supera facilmente le decine
// di MB. La pagina admin tiene i soli CSV prima di caricare, ma il limite resta
// alto per chi chiama l'endpoint direttamente: tanto i non-CSV non vengono
// nemmeno decompressi (vedi importBankZip).
const MAX = 60 * 1024 * 1024; // 60 MB

export const POST: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return j({ ok: false, error: "backend" }, 503);
  const user = await loadUserFromContext(ctx);
  if (!user) return j({ ok: false, error: "unauthorized" }, 401);
  if (user.role !== "admin") return j({ ok: false, error: "forbidden" }, 403);

  let form: FormData;
  try { form = await ctx.request.formData(); }
  catch { return j({ ok: false, error: "form non valido" }, 400); }
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return j({ ok: false, error: "Nessun file" }, 400);
  if (file.size > MAX) return j({ ok: false, error: `File troppo grande (max ${MAX / 1024 / 1024} MB)` }, 413);

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const result = await importBankZip(db, bytes);
    return j({ ok: true, ...result });
  } catch (e) {
    return j({ ok: false, error: e instanceof Error ? e.message : "errore import" }, 500);
  }
};

function j(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { "Content-Type": "application/json" } });
}
