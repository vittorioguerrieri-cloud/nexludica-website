/**
 * Protezione con password del catalogo miniature (archivio interno).
 *
 * Copre le pagine /catalogo-miniature/* e i media su /r2/mmf/* (immagini, render, mesh 3D):
 * senza cookie valido non si vede nulla, nemmeno linkando direttamente un file.
 *
 * Password: secret CATALOGO_PASSWORD del worker (wrangler secret put CATALOGO_PASSWORD),
 * letto da "cloudflare:workers" perche' in Astro 6 locals.runtime.env non esiste piu'.
 * Cookie: nx_cat=<scadenza>.<firma>, firma HMAC-SHA256 della scadenza con la password come chiave.
 * Niente password in chiaro nel cookie, e la firma decade da sola dopo 30 giorni.
 */

import { env } from "cloudflare:workers";

const COOKIE = "nx_cat";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 giorni
const PATHS = ["/catalogo-miniature", "/r2/mmf/"];

export function isGated(pathname: string): boolean {
  return PATHS.some((p) => pathname === p || pathname.startsWith(p));
}

async function sign(exp: number, password: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(password), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`catalogo|${exp}`));
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function equal(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hasValidCookie(request: Request, password: string): Promise<boolean> {
  const raw = request.headers.get("cookie") || "";
  const match = raw.split(";").map((c) => c.trim()).find((c) => c.startsWith(`${COOKIE}=`));
  if (!match) return false;
  const [exp, sig] = decodeURIComponent(match.slice(COOKIE.length + 1)).split(".");
  const expNum = Number(exp);
  if (!expNum || !sig || expNum < Date.now() / 1000) return false;
  return equal(sig, await sign(expNum, password));
}

function loginPage(errore: boolean): Response {
  const html = `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>Catalogo miniature — accesso</title>
<style>
  :root { color-scheme: light; }
  body { margin:0; min-height:100vh; display:grid; place-items:center; background:#f7f9fa;
         font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color:#1b2a33; }
  form { width:min(92vw, 360px); background:#fff; border:1px solid #dfe6ea; border-radius:14px;
         padding:28px 24px; box-shadow:0 8px 30px rgba(20,40,60,.07); }
  h1 { margin:0 0 4px; font-size:1.15rem; }
  p { margin:0 0 18px; font-size:.85rem; color:#5d6e79; }
  label { display:block; font-size:.8rem; font-weight:600; margin-bottom:6px; }
  input { width:100%; box-sizing:border-box; padding:10px 12px; font-size:1rem;
          border:1px solid #cbd6dc; border-radius:8px; background:#fbfdfe; }
  input:focus { outline:2px solid #17b8c4; outline-offset:1px; border-color:#17b8c4; }
  button { margin-top:14px; width:100%; padding:10px 12px; font-size:.95rem; font-weight:700;
           color:#fff; background:#17b8c4; border:0; border-radius:8px; cursor:pointer; }
  button:hover { background:#1391a8; }
  .err { margin-top:12px; font-size:.82rem; color:#b3261e; }
</style>
</head>
<body>
  <form method="post">
    <h1>Catalogo miniature</h1>
    <p>Archivio interno. Inserisci la password per continuare.</p>
    <label for="pw">Password</label>
    <input id="pw" name="pw" type="password" autocomplete="current-password" autofocus required />
    <button type="submit">Entra</button>
    ${errore ? '<p class="err">Password non corretta.</p>' : ""}
  </form>
</body>
</html>`;
  return new Response(html, {
    status: errore ? 401 : 200,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex, nofollow" },
  });
}

/** Restituisce una Response se la richiesta va bloccata o gestita (login), altrimenti null. */
export async function catalogoGate(request: Request, runtimeEnv?: any): Promise<Response | null> {
  const url = new URL(request.url);
  if (!isGated(url.pathname)) return null;

  // Durante la build (prerender) l'ambiente del worker non esiste: nessun controllo,
  // altrimenti il messaggio finirebbe dentro le pagine statiche generate.
  const password: string | undefined = (runtimeEnv ?? (env as any))?.CATALOGO_PASSWORD;
  if (!password) return null;

  if (await hasValidCookie(request, password)) return null;

  if (request.method === "POST") {
    const form = await request.formData().catch(() => null);
    const inserita = String(form?.get("pw") ?? "");
    if (equal(inserita, password)) {
      const exp = Math.floor(Date.now() / 1000) + MAX_AGE;
      const cookie = `${COOKIE}=${exp}.${await sign(exp, password)}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; Secure; SameSite=Lax`;
      return new Response(null, {
        status: 303,
        headers: { location: url.pathname + url.search, "set-cookie": cookie, "cache-control": "no-store" },
      });
    }
    return loginPage(true);
  }

  // I media non mostrano il modulo: rispondono 401 e basta (la pagina chiede gia' la password).
  if (url.pathname.startsWith("/r2/")) {
    return new Response("Accesso riservato", { status: 401, headers: { "cache-control": "no-store" } });
  }
  return loginPage(false);
}
