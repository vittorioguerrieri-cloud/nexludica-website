/**
 * POST /api/admin/meetludica/speaker-photos
 *   multipart/form-data: file=<image>
 *   Carica una foto speaker su Drive (cartella "MeetLudica/Foto speaker"),
 *   registra in meetludica_speaker_photos, ritorna l'URL pubblico via proxy.
 *
 *   Solo immagini (image/*). Max 8 MB.
 *
 * GET /api/admin/meetludica/speaker-photos
 *   → lista foto caricate (per riusare in altri broadcast).
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../../server/db";
import { loadUserFromContext } from "../../../../server/auth";
import { canManageMeetludica } from "../../../../server/permissions";
import { ensureFolder, uploadFileWithDetails } from "../../../../server/drive";
import {
  addSpeakerPhoto,
  listSpeakerPhotos,
} from "../../../../server/meetludica";

export const prerender = false;

const MAX_SIZE = 8 * 1024 * 1024; // 8 MB
const ALLOWED_MIME = /^image\/(jpeg|jpg|png|webp|gif|heic|heif)$/i;

function publicUrl(env: Env, id: string): string {
  const base = env.SITE_URL ?? "https://nexludica.org";
  return `${base.replace(/\/$/, "")}/api/meetludica/speaker-photo/${id}`;
}

export const GET: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return j({ ok: false, error: "backend" }, 503);
  const user = await loadUserFromContext(ctx);
  if (!user) return j({ ok: false, error: "unauthorized" }, 401);
  if (!canManageMeetludica(user)) return j({ ok: false, error: "forbidden" }, 403);
  const photos = await listSpeakerPhotos(db);
  return j({
    ok: true,
    photos: photos.map((p) => ({ ...p, url: publicUrl(env as Env, p.id) })),
  });
};

export const POST: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return j({ ok: false, error: "backend" }, 503);
  const user = await loadUserFromContext(ctx);
  if (!user) return j({ ok: false, error: "unauthorized" }, 401);
  if (!canManageMeetludica(user)) return j({ ok: false, error: "forbidden" }, 403);

  const root = env.DRIVE_ROOT_FOLDER_ID;
  if (!root) return j({ ok: false, error: "drive non configurato" }, 503);

  let form: FormData;
  try {
    form = await ctx.request.formData();
  } catch {
    return j({ ok: false, error: "form data non valido" }, 400);
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return j({ ok: false, error: "Nessun file" }, 400);
  }
  if (file.size > MAX_SIZE) {
    return j({ ok: false, error: `File troppo grande (max ${MAX_SIZE / 1024 / 1024} MB)` }, 413);
  }
  if (!ALLOWED_MIME.test(file.type || "")) {
    return j({ ok: false, error: "Solo immagini (jpg, png, webp, gif)" }, 400);
  }

  // Cartella Drive: <root>/MeetLudica/Foto speaker
  const parent = await ensureFolder(env as Env, root, "MeetLudica");
  if (!parent) return j({ ok: false, error: "drive folder create failed" }, 500);
  const photosFolder = await ensureFolder(env as Env, parent.id, "Foto speaker");
  if (!photosFolder) return j({ ok: false, error: "drive subfolder create failed" }, 500);

  // Nome univoco per evitare collisioni in Drive
  const ext = (file.name.match(/\.[a-z0-9]+$/i) ?? [""])[0];
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const baseName = file.name.replace(/\.[a-z0-9]+$/i, "").slice(0, 80) || "speaker";
  const driveName = `${stamp}_${baseName}${ext}`;

  const driveRes = await uploadFileWithDetails(env as Env, photosFolder.id, {
    name: driveName,
    type: file.type,
    arrayBuffer: () => file.arrayBuffer(),
  });
  if (!driveRes.ok) {
    return j({ ok: false, error: `Upload su Drive fallita: ${driveRes.error}` }, 502);
  }

  const photo = await addSpeakerPhoto(db, {
    driveFileId: driveRes.file.id,
    filename: driveRes.file.name,
    mimeType: driveRes.file.mimeType || file.type,
    sizeBytes: file.size,
    uploadedBy: user.id,
  });

  return j({
    ok: true,
    id: photo.id,
    url: publicUrl(env as Env, photo.id),
    filename: photo.filename,
    sizeBytes: photo.sizeBytes,
  });
};

function j(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), {
    status: s,
    headers: { "Content-Type": "application/json" },
  });
}
