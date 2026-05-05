/**
 * Helper di guardia per pagine Astro:
 * - getUser(Astro): carica l'utente da cookie senza buttare eccezioni.
 *   Restituisce null se non loggato o se il backend non e' configurato.
 */

import type { AstroGlobal } from "astro";
import { loadUserFromContext } from "./auth";
import type { SessionUser } from "./auth";

export async function getUser(astro: AstroGlobal): Promise<SessionUser | null> {
  try {
    return await loadUserFromContext(astro as any);
  } catch (e) {
    console.error("[getUser] failed:", e);
    return null;
  }
}
