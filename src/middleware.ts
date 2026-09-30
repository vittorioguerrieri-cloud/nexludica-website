/**
 * Middleware globale.
 *
 * Funzione 1: rewriting per sottodominio research.nexludica.org
 *   - Tutto cio' che arriva su research.nexludica.org/x viene servito dalla
 *     rotta /research/x del worker, senza redirect (l'URL nella barra resta
 *     research.nexludica.org/x).
 *   - Cosi' le pagine di Research Platform vivono in src/pages/research/
 *     ma sono accessibili dal sottodominio come root.
 *
 * Funzione 2: rewriting per sottodominio playtest.nexludica.org
 *   - Stessa logica di research: i contenuti di src/pages/playtest/ sono
 *     mappati su playtest.nexludica.org/.
 *
 * Aggiunge un header X-NX-Middleware per debug.
 */

import { defineMiddleware } from "astro:middleware";

const RESEARCH_HOST = "research.nexludica.org";
const PLAYTEST_HOST = "playtest.nexludica.org";

// Path che NON vanno riscritti: endpoint API condivisi e asset statici.
const PASSTHROUGH_PREFIXES = ["/api/", "/r2/", "/images/", "/_astro/", "/favicon", "/qr/"];

/**
 * Intestazioni di sicurezza su tutte le risposte generate dal worker.
 * - HSTS: il browser usa solo HTTPS per un anno (senza includeSubDomains, per
 *   non vincolare sottodomini non web).
 * - nosniff, Referrer-Policy: comportamenti standard piu' prudenti.
 * - SAMEORIGIN: le pagine si possono incorniciare solo dal sito stesso (serve
 *   alle anteprime PDF di verbali e incarichi, che sono iframe interni).
 * - Permissions-Policy: nessuna pagina usa fotocamera, microfono o posizione.
 */
const SICUREZZA: Record<string, string> = {
  "Strict-Transport-Security": "max-age=31536000",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "SAMEORIGIN",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
};

function conSicurezza(r: Response): Response {
  try {
    for (const [k, v] of Object.entries(SICUREZZA)) {
      if (!r.headers.has(k)) r.headers.set(k, v);
    }
    return r;
  } catch {
    // Intestazioni immutabili (risposta di fetch): si copia la risposta.
    const h = new Headers(r.headers);
    for (const [k, v] of Object.entries(SICUREZZA)) if (!h.has(k)) h.set(k, v);
    return new Response(r.body, { status: r.status, statusText: r.statusText, headers: h });
  }
}

export const onRequest = defineMiddleware(async (ctx, next) => conSicurezza(await instrada(ctx, next)));

const instrada = async (ctx: Parameters<Parameters<typeof defineMiddleware>[0]>[0], next: () => Promise<Response>): Promise<Response> => {
  const url = new URL(ctx.request.url);


  // Routing per sottodominio: scegliamo il prefisso di rewriting in base
  // all'host. Niente subdomain → comportamento normale.
  let prefix: string | null = null;
  if (url.hostname === RESEARCH_HOST) prefix = "/research";
  else if (url.hostname === PLAYTEST_HOST) prefix = "/playtest";

  if (!prefix) {
    const r = await next();
    return r;
  }

  // Passthrough: rotte API/asset
  if (PASSTHROUGH_PREFIXES.some((p) => url.pathname.startsWith(p))) {
    const r = await next();
    r.headers.set("X-NX-Middleware", "passthrough");
    return r;
  }

  // Rewrite per pagine
  if (!url.pathname.startsWith(prefix)) {
    let newPath: string;
    if (url.pathname === "/" || url.pathname === "") {
      newPath = `${prefix}/`;
    } else if (url.pathname === "/home" || url.pathname === "/home/") {
      // Alias che serve la stessa landing della root.
      // Usato come destinazione del Redirect Rule su `/`, per by-passare la
      // cache CDN stale dell'asset /index.html del sito principale.
      newPath = `${prefix}/`;
    } else {
      newPath = prefix + url.pathname;
      if (!newPath.endsWith("/")) newPath += "/";
    }
    const newUrl = new URL(newPath + url.search, url);
    const r = await ctx.rewrite(newUrl);
    r.headers.set("X-NX-Middleware", `rewrite ${url.pathname} -> ${newPath}`);
    r.headers.set("Cache-Control", "no-store, must-revalidate");
    return r;
  }

  const r = await next();
  r.headers.set("X-NX-Middleware", "already-prefixed");
  return r;
};
