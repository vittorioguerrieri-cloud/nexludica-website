/**
 * Lista cartelle figlie della root NexLudica su Drive.
 * Usato dalla pagina /area-soci/verbali. Riservato ai soci loggati.
 */
import type { APIRoute } from "astro";
import { getEnv } from "../../../server/db";
import { loadUserFromContext } from "../../../server/auth";
import { listFolders } from "../../../server/drive";

export const prerender = false;

export const GET: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const user = await loadUserFromContext(ctx);
  if (!user) return json({ error: "unauthorized" }, 401);
  const root = env.DRIVE_ROOT_FOLDER_ID;
  if (!root) return json({ folders: [], error: "DRIVE_ROOT_FOLDER_ID not set" });
  const folders = await listFolders(env, root);
  return json({ folders });
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
