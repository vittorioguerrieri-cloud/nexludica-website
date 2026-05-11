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
 * Aggiunge un header X-NX-Middleware per debug.
 */

import { defineMiddleware } from "astro:middleware";

const RESEARCH_HOST = "research.nexludica.org";

// Path che NON vanno riscritti: endpoint API condivisi e asset statici.
const PASSTHROUGH_PREFIXES = ["/api/", "/r2/", "/images/", "/_astro/", "/favicon"];

export const onRequest = defineMiddleware(async (ctx, next) => {
  const url = new URL(ctx.request.url);

  if (url.hostname !== RESEARCH_HOST) {
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
  if (!url.pathname.startsWith("/research")) {
    let newPath: string;
    if (url.pathname === "/" || url.pathname === "") {
      newPath = "/research/";
    } else {
      newPath = "/research" + url.pathname;
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
});
