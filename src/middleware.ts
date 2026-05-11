/**
 * Middleware globale.
 *
 * Funzione 1: rewriting per sottodominio research.nexludica.org
 *   - Tutto cio' che arriva su research.nexludica.org/x viene servito dalla
 *     rotta /research/x del worker, senza redirect (l'URL nella barra resta
 *     research.nexludica.org/x).
 *   - Cosi' le pagine di Research Platform vivono in src/pages/research/
 *     ma sono accessibili dal sottodominio come root.
 */

import { defineMiddleware } from "astro:middleware";

const RESEARCH_HOST = "research.nexludica.org";

export const onRequest = defineMiddleware(async (ctx, next) => {
  const url = new URL(ctx.request.url);
  if (url.hostname !== RESEARCH_HOST) return next();

  // Path che NON vanno riscritti: endpoint API condivisi e asset statici.
  // Cosi' research.nexludica.org/api/research/responses raggiunge la stessa
  // rotta che e' anche su nexludica.org/api/research/responses.
  const passthrough = [
    "/api/",
    "/r2/",
    "/images/",
    "/_astro/",
    "/favicon",
  ];
  if (passthrough.some((p) => url.pathname.startsWith(p))) {
    return next();
  }

  if (!url.pathname.startsWith("/research")) {
    const newPath = url.pathname === "/" ? "/research" : "/research" + url.pathname;
    const newUrl = new URL(newPath + url.search, url);
    return ctx.rewrite(newUrl);
  }
  return next();
});
