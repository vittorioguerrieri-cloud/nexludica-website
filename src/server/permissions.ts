/**
 * Permessi per-sezione che NON coincidono con il ruolo admin pieno.
 *
 * "Gestione MeetLudica" e' accessibile agli admin e a uno specifico allowlist
 * di soci, per non dover concedere loro l'intero pannello di amministrazione
 * (finanze, notule, libro soci, ecc.).
 */
export interface PermUser {
  id?: string;
  role: string;
  email: string;
}

/**
 * Soci (oltre agli admin) abilitati alla gestione MeetLudica.
 * Il repository e' pubblico: gli account con un indirizzo personale si
 * riconoscono dall'id utente, cosi' l'indirizzo non compare nel codice.
 */
const MEETLUDICA_MANAGER_IDS = new Set([
  "10a25042-3555-4394-85f5-211f9ff2b983", // Letizia Vaccarella
]);
const MEETLUDICA_MANAGER_EMAILS = new Set([
  "raluca.fulgu@nexludica.org",
  "letizia.vaccarella@nexludica.org",
]);

export function canManageMeetludica(user: PermUser | null | undefined): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;
  if (user.id && MEETLUDICA_MANAGER_IDS.has(user.id)) return true;
  return MEETLUDICA_MANAGER_EMAILS.has(user.email.trim().toLowerCase());
}
