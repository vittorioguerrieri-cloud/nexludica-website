/**
 * POST /api/playtest/games/:gameId/files
 *   multipart/form-data: file=<file>, kind?=<rules|design_doc|asset|other>,
 *   description?=<string>
 *
 *   Carica il file su Google Drive nella cartella dedicata al gioco
 *   (creata lazy alla prima upload, sotto la cartella radice NexLudica).
 *   Registra metadata su playtest_game_files.
 *
 * Auth: soci loggati.
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../../../server/db";
import { loadUserFromContext } from "../../../../../server/auth";
import {
  addGameFile,
  getGameById,
  updateGame,
  type GameFileKind,
} from "../../../../../server/playtest";
import { ensureFolder, uploadFile } from "../../../../../server/drive";

export const prerender = false;

const VALID_KINDS: GameFileKind[] = ["rules", "design_doc", "asset", "other"];

export const POST: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return j({ ok: false, error: "backend" }, 503);
  const user = await loadUserFromContext(ctx);
  if (!user) return j({ ok: false, error: "unauthorized" }, 401);

  const gameId = ctx.params.gameId as string;
  const game = await getGameById(db, gameId);
  if (!game) return j({ ok: false, error: "game not found" }, 404);

  const root = env.DRIVE_ROOT_FOLDER_ID;
  if (!root) return j({ ok: false, error: "drive non configurato" }, 503);

  let formData: FormData;
  try {
    formData = await ctx.request.formData();
  } catch {
    return j({ ok: false, error: "form data non valido" }, 400);
  }
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return j({ ok: false, error: "Nessun file" }, 400);
  }
  if (file.size > 50 * 1024 * 1024) {
    return j({ ok: false, error: "File troppo grande (max 50 MB)" }, 413);
  }
  const kindRaw = String(formData.get("kind") ?? "other");
  const kind: GameFileKind = VALID_KINDS.includes(kindRaw as GameFileKind)
    ? (kindRaw as GameFileKind)
    : "other";
  const description = String(formData.get("description") ?? "").trim().slice(0, 200) || null;

  // Cartella Drive del gioco: se non esiste ancora, creala sotto la radice
  // NexLudica con nome "Playtest — <game name>" (idempotente).
  let folderId = game.driveFolderId;
  if (!folderId) {
    const folder = await ensureFolder(env, root, `Playtest — ${game.name}`);
    if (!folder) return j({ ok: false, error: "drive folder create failed" }, 500);
    folderId = folder.id;
    await updateGame(db, gameId, { driveFolderId: folderId });
  }

  // Upload del file su Drive
  const driveFile = await uploadFile(env, folderId, {
    name: file.name,
    type: file.type,
    arrayBuffer: () => file.arrayBuffer(),
  });
  if (!driveFile) return j({ ok: false, error: "upload su Drive fallita" }, 500);

  // Registra in DB
  const row = await addGameFile(db, {
    gameId,
    driveFileId: driveFile.id,
    name: driveFile.name,
    mimeType: driveFile.mimeType,
    sizeBytes: file.size,
    webViewLink: driveFile.webViewLink ?? null,
    kind,
    description,
    uploadedBy: user.id,
  });

  return j({ ok: true, file: row });
};

function j(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { "Content-Type": "application/json" } });
}
