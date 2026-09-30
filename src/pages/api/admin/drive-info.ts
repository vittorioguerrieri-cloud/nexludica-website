/**
 * GET /api/admin/drive-info
 *
 * Restituisce email del service account + info sulla cartella radice di Drive,
 * incluso se è in un Drive Condiviso o in My Drive (utile per debug del 403
 * "Service Accounts do not have storage quota").
 */
import type { APIRoute } from "astro";
import { getEnv } from "../../../server/db";
import { loadUserFromContext } from "../../../server/auth";
import { getAccessToken } from "../../../server/drive";

export const prerender = false;

export const GET: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const user = await loadUserFromContext(ctx);
  if (!user) return j({ ok: false, error: "unauthorized" }, 401);
  if (user.role !== "admin") return j({ ok: false, error: "forbidden" }, 403);

  // 1) Email del service account dal JSON
  let serviceAccountEmail: string | null = null;
  try {
    const raw = (env as any).GOOGLE_SERVICE_ACCOUNT_JSON as string | undefined;
    if (raw) {
      const json = JSON.parse(raw);
      serviceAccountEmail = json.client_email ?? null;
    }
  } catch {}

  // 2) Info sulla cartella radice (è in un Shared Drive?)
  const rootId = env.DRIVE_ROOT_FOLDER_ID;
  let rootInfo: any = null;
  let canWriteWarning: string | null = null;
  if (rootId) {
    const token = await getAccessToken(env);
    if (token) {
      try {
        const res = await fetch(
          `https://www.googleapis.com/drive/v3/files/${rootId}?fields=id,name,driveId,parents,capabilities&supportsAllDrives=true`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (res.ok) {
          rootInfo = await res.json();
          if (!rootInfo.driveId) {
            canWriteWarning =
              "La cartella radice è in 'My Drive' (non in un Drive Condiviso). " +
              "I service account NON possono caricare file in My Drive. " +
              "Devi creare un Drive Condiviso, aggiungere il service account come Content Manager, " +
              "e spostare la cartella radice lì (o creare una nuova struttura nel Shared Drive).";
          }
        } else {
          rootInfo = { error: await res.text() };
        }
      } catch (e) {
        rootInfo = { error: String(e) };
      }
    }
  }

  // 3) Lista degli Shared Drive a cui la SA ha accesso (utile dopo che
  //    l'utente l'ha aggiunta a un nuovo Shared Drive: cosi' vediamo l'ID
  //    senza dover andare a pescarlo dall'URL).
  let accessibleSharedDrives: Array<{ id: string; name: string }> = [];
  if (rootId) {
    const token = await getAccessToken(env);
    if (token) {
      try {
        const res = await fetch(
          `https://www.googleapis.com/drive/v3/drives?pageSize=50&fields=drives(id,name)`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (res.ok) {
          const data = await res.json() as { drives?: Array<{ id: string; name: string }> };
          accessibleSharedDrives = data.drives ?? [];
        }
      } catch {}
    }
  }

  return j({
    ok: true,
    serviceAccountEmail,
    driveRootFolderId: rootId,
    rootInfo,
    canWriteWarning,
    accessibleSharedDrives,
    fixUrl: "https://developers.google.com/workspace/drive/api/guides/about-shareddrives",
  });
};

function j(d: unknown, s = 200) {
  return new Response(JSON.stringify(d, null, 2), { status: s, headers: { "Content-Type": "application/json" } });
}
