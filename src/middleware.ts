/**
 * Middleware globale: carica l'utente loggato in Astro.locals.user
 * per ogni request, in modo che le pagine SSR possano controllare
 * l'autenticazione senza ripetere il codice.
 */

import { defineMiddleware } from "astro:middleware";
import { loadUserFromContext } from "./server/auth";

export const onRequest = defineMiddleware(async (ctx, next) => {
  try {
    const user = await loadUserFromContext(ctx);
    // @ts-expect-error - definita in env.d.ts
    ctx.locals.user = user;
  } catch {
    // @ts-expect-error
    ctx.locals.user = null;
  }
  return next();
});
