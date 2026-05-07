/**
 * Client Google Drive API per Cloudflare Workers.
 *
 * Autenticazione via service account JWT (RS256). Il JSON della chiave
 * service account viene letto da env.GOOGLE_SERVICE_ACCOUNT_JSON
 * (settato come secret Cloudflare).
 *
 * Cartella radice di NexLudica: env.DRIVE_ROOT_FOLDER_ID
 * (l'id estratto dall'URL della cartella condivisa).
 *
 * Lo scope richiesto e' `drive` (full read/write sui file accessibili
 * al service account, ovvero la cartella condivisa con esso).
 */

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";

interface ServiceAccountKey {
  type: "service_account";
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  token_uri?: string;
}

let cachedToken: { token: string; exp: number } | null = null;

/**
 * Carica e parse-a la JSON del service account dall'env.
 */
function loadKey(env: Env): ServiceAccountKey | null {
  const raw = env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ServiceAccountKey;
  } catch (e) {
    console.error("[drive] failed to parse GOOGLE_SERVICE_ACCOUNT_JSON:", e);
    return null;
  }
}

/**
 * Converte una chiave PEM PKCS#8 in CryptoKey importabile da WebCrypto.
 */
async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const cleaned = pem
    .replace(/-----BEGIN [^-]+-----/, "")
    .replace(/-----END [^-]+-----/, "")
    .replace(/\s+/g, "");
  const der = Uint8Array.from(atob(cleaned), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    "pkcs8",
    der.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

function base64UrlEncode(data: ArrayBuffer | string): string {
  const bytes =
    typeof data === "string"
      ? new TextEncoder().encode(data)
      : new Uint8Array(data);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Crea un JWT firmato con la chiave del service account, lo scambia per
 * un access_token Google. Cache locale per riutilizzare il token finche'
 * non scade.
 */
export async function getAccessToken(env: Env): Promise<string | null> {
  const key = loadKey(env);
  if (!key) return null;

  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.exp - 60 > now) {
    return cachedToken.token;
  }

  const header = { alg: "RS256", typ: "JWT", kid: key.private_key_id };
  const payload = {
    iss: key.client_email,
    scope: "https://www.googleapis.com/auth/drive",
    aud: key.token_uri ?? TOKEN_ENDPOINT,
    iat: now,
    exp: now + 3600,
  };
  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const data = `${headerB64}.${payloadB64}`;

  const cryptoKey = await importPrivateKey(key.private_key);
  const sig = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" },
    cryptoKey,
    new TextEncoder().encode(data),
  );
  const jwt = `${data}.${base64UrlEncode(sig)}`;

  const res = await fetch(key.token_uri ?? TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) {
    console.error("[drive] token exchange failed:", await res.text());
    return null;
  }
  const json = await res.json<{ access_token: string; expires_in: number }>();
  cachedToken = { token: json.access_token, exp: now + json.expires_in };
  return json.access_token;
}

export interface DriveFolder {
  id: string;
  name: string;
  webViewLink: string;
  modifiedTime: string;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
  webContentLink?: string;
  size?: string;
  modifiedTime: string;
}

/**
 * Lista le cartelle figlie di parentId.
 */
export async function listFolders(
  env: Env,
  parentId: string,
): Promise<DriveFolder[]> {
  const token = await getAccessToken(env);
  if (!token) return [];
  const q = `'${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const url = new URL(`${DRIVE_API}/files`);
  url.searchParams.set("q", q);
  url.searchParams.set("fields", "files(id,name,webViewLink,modifiedTime)");
  url.searchParams.set("orderBy", "name");
  url.searchParams.set("pageSize", "100");
  url.searchParams.set("supportsAllDrives", "true");
  url.searchParams.set("includeItemsFromAllDrives", "true");
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    console.error("[drive] listFolders failed:", await res.text());
    return [];
  }
  const data = await res.json<{ files: DriveFolder[] }>();
  return data.files ?? [];
}

/**
 * Lista i file (no folders) figli di parentId.
 */
export async function listFiles(env: Env, parentId: string): Promise<DriveFile[]> {
  const token = await getAccessToken(env);
  if (!token) return [];
  const q = `'${parentId}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed = false`;
  const url = new URL(`${DRIVE_API}/files`);
  url.searchParams.set("q", q);
  url.searchParams.set(
    "fields",
    "files(id,name,mimeType,webViewLink,webContentLink,size,modifiedTime)",
  );
  url.searchParams.set("orderBy", "modifiedTime desc");
  url.searchParams.set("pageSize", "100");
  url.searchParams.set("supportsAllDrives", "true");
  url.searchParams.set("includeItemsFromAllDrives", "true");
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const data = await res.json<{ files: DriveFile[] }>();
  return data.files ?? [];
}

/**
 * Crea una cartella dentro parentId. Se esiste gia' una cartella col
 * nome esatto, ritorna quella (idempotente).
 */
export async function ensureFolder(
  env: Env,
  parentId: string,
  name: string,
): Promise<DriveFolder | null> {
  const token = await getAccessToken(env);
  if (!token) return null;

  // Check existing
  const existing = await listFolders(env, parentId);
  const match = existing.find((f) => f.name === name);
  if (match) return match;

  const res = await fetch(`${DRIVE_API}/files?supportsAllDrives=true`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    }),
  });
  if (!res.ok) {
    console.error("[drive] createFolder failed:", await res.text());
    return null;
  }
  const created = await res.json<DriveFolder>();
  return created;
}

/**
 * Carica un file in parentId.
 * Usa multipart upload (un'unica chiamata).
 */
export async function uploadFile(
  env: Env,
  parentId: string,
  file: { name: string; type: string; arrayBuffer: () => Promise<ArrayBuffer> },
): Promise<DriveFile | null> {
  const token = await getAccessToken(env);
  if (!token) return null;

  const buf = await file.arrayBuffer();
  const metadata = {
    name: file.name,
    parents: [parentId],
  };
  const boundary = "nexludica-" + crypto.randomUUID();
  const enc = new TextEncoder();
  const head =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify(metadata) +
    `\r\n--${boundary}\r\n` +
    `Content-Type: ${file.type || "application/octet-stream"}\r\n\r\n`;
  const tail = `\r\n--${boundary}--`;
  const headBytes = enc.encode(head);
  const tailBytes = enc.encode(tail);
  const body = new Uint8Array(headBytes.length + buf.byteLength + tailBytes.length);
  body.set(headBytes, 0);
  body.set(new Uint8Array(buf), headBytes.length);
  body.set(tailBytes, headBytes.length + buf.byteLength);

  const res = await fetch(
    `${DRIVE_UPLOAD_API}/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,mimeType,webViewLink,webContentLink,size,modifiedTime`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );
  if (!res.ok) {
    console.error("[drive] upload failed:", await res.text());
    return null;
  }
  return await res.json<DriveFile>();
}

/**
 * Rende un file accessibile via link "anyone with the link" e ritorna
 * il webViewLink. Operazione idempotente.
 */
export async function makePublic(env: Env, fileId: string): Promise<void> {
  const token = await getAccessToken(env);
  if (!token) return;
  await fetch(
    `${DRIVE_API}/files/${fileId}/permissions?supportsAllDrives=true`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ role: "reader", type: "anyone" }),
    },
  );
}

/**
 * Elimina un file/cartella.
 */
export async function deleteFile(env: Env, fileId: string): Promise<boolean> {
  const token = await getAccessToken(env);
  if (!token) return false;
  const res = await fetch(
    `${DRIVE_API}/files/${fileId}?supportsAllDrives=true`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  return res.ok;
}
