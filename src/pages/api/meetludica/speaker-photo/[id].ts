/**
 * GET /api/meetludica/speaker-photo/:id
 *   Endpoint PUBBLICO (senza auth) per servire le foto speaker embeddate
 *   nelle email broadcast di MeetLudica. Risolve l'id → drive_file_id e
 *   stream-a i bytes dal Drive del service account.
 *
 *   Cache aggressiva: le foto non cambiano una volta caricate. La risposta
 *   passa anche dal cache CDN di Cloudflare via Cache-Control immutable.
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../../server/db";
import { getSpeakerPhoto } from "../../../../server/meetludica";
import { getAccessToken } from "../../../../server/drive";

export const prerender = false;

export const GET: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return new Response("backend", { status: 503 });
  const id = ctx.params.id as string;
  const photo = await getSpeakerPhoto(db, id);
  if (!photo) return new Response("not found", { status: 404 });

  const accessToken = await getAccessToken(env as Env);
  if (!accessToken) return new Response("drive auth", { status: 503 });

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${photo.driveFileId}?alt=media&supportsAllDrives=true`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) {
    console.error("[speaker-photo] drive fetch failed:", res.status);
    return new Response("download failed", { status: 502 });
  }
  const buf = await res.arrayBuffer();
  return new Response(buf, {
    status: 200,
    headers: {
      "Content-Type": photo.mimeType || "image/jpeg",
      // 30 giorni di cache su CDN + browser. immutable: il contenuto non cambia.
      "Cache-Control": "public, max-age=2592000, immutable",
      "Access-Control-Allow-Origin": "*",
    },
  });
};
