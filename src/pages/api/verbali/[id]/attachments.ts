/**
 * POST /api/verbali/:id/attachments
 *   multipart/form-data: file=<File>, notes?=<string>
 *   Upload allegato su Drive nella cartella dedicata al verbale.
 *   Limite: 25 MB / file.
 *
 * GET /api/verbali/:id/attachments
 *   Lista allegati del verbale (admin).
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../../server/db";
import { loadUserFromContext } from "../../../../server/auth";
import { getVerbale } from "../../../../server/verbali";
import { addAttachment, listAttachments } from "../../../../server/verbali-attachments";
import { ensureFolder, uploadFileWithDetails } from "../../../../server/drive";

export const prerender = false;

// Cloudflare Workers Paid plan ammette body fino a 100 MB.
// Su Drive abbiamo spazio abbondante quindi alziamo qui.
const MAX_SIZE = 100 * 1024 * 1024; // 100 MB

export const GET: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return j({ ok: false, error: "backend" }, 503);
  const user = await loadUserFromContext(ctx);
  if (!user) return j({ ok: false, error: "unauthorized" }, 401);
  const id = ctx.params.id as string;
  const v = await getVerbale(db, id);
  if (!v) return j({ ok: false, error: "not found" }, 404);
  const items = await listAttachments(db, id);
  return j({ ok: true, attachments: items });
};

export const POST: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return j({ ok: false, error: "backend" }, 503);
  const user = await loadUserFromContext(ctx);
  if (!user) return j({ ok: false, error: "unauthorized" }, 401);
  if (user.role !== "admin") return j({ ok: false, error: "forbidden" }, 403);

  const id = ctx.params.id as string;
  const v = await getVerbale(db, id);
  if (!v) return j({ ok: false, error: "not found" }, 404);

  const root = env.DRIVE_ROOT_FOLDER_ID;
  if (!root) return j({ ok: false, error: "drive non configurato" }, 503);

  let form: FormData;
  try { form = await ctx.request.formData(); }
  catch { return j({ ok: false, error: "form data non valido" }, 400); }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return j({ ok: false, error: "Nessun file" }, 400);
  }
  if (file.size > MAX_SIZE) {
    return j({ ok: false, error: `File troppo grande (max ${MAX_SIZE / 1024 / 1024} MB)` }, 413);
  }
  const notes = String(form.get("notes") ?? "").trim().slice(0, 500) || null;

  // Cartella Drive: "Allegati verbali" / "<title sanitized>"
  const parent = await ensureFolder(env as Env, root, "Allegati verbali");
  if (!parent) return j({ ok: false, error: "drive folder create failed" }, 500);
  const safeTitle = v.title.replace(/[^a-zA-Z0-9-_ ]+/g, "").slice(0, 80) || `Verbale ${v.id.slice(0, 8)}`;
  const verbaleFolder = await ensureFolder(env as Env, parent.id, safeTitle);
  if (!verbaleFolder) return j({ ok: false, error: "drive subfolder create failed" }, 500);

  const driveRes = await uploadFileWithDetails(env as Env, verbaleFolder.id, {
    name: file.name,
    type: file.type,
    arrayBuffer: () => file.arrayBuffer(),
  });
  if (!driveRes.ok) {
    // Propaga il messaggio di errore reale di Drive così è debuggabile
    return j({ ok: false, error: `Upload su Drive fallita: ${driveRes.error}` }, 502);
  }
  const driveFile = driveRes.file;

  const att = await addAttachment(db, {
    verbaleId: v.id,
    filename: driveFile.name,
    mimeType: driveFile.mimeType,
    sizeBytes: file.size,
    driveFileId: driveFile.id,
    driveViewUrl: driveFile.webViewLink ?? null,
    driveDownloadUrl: driveFile.webContentLink ?? null,
    notes,
    uploadedBy: user.id,
  });
  return j({ ok: true, attachment: att });
};

function j(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { "Content-Type": "application/json" } });
}
