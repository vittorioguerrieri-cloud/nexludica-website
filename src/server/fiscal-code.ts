/**
 * Validazione Codice Fiscale italiano.
 *
 * Riferimento: D.M. 23 dicembre 1976 e successivi.
 * Il codice fiscale e' lungo 16 caratteri alfanumerici. La 16ª lettera
 * (carattere di controllo) e' calcolata sui primi 15 secondo due tabelle:
 *   - posizioni dispari (1, 3, 5, ..., 15)
 *   - posizioni pari (2, 4, 6, ..., 14)
 * La somma modulo 26 mappa una lettera A-Z di controllo.
 *
 * Questa funzione verifica formato + checksum. NON verifica corrispondenza
 * con nome/cognome/data di nascita/comune (richiederebbe il database ISTAT
 * dei codici catastali e l'algoritmo di estrazione consonanti/vocali).
 */

const FORMAT = /^[A-Z]{6}[0-9LMNPQRSTUV]{2}[A-EHLMPR-T][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/;

const ODD: Record<string, number> = {
  "0": 1,  "1": 0,  "2": 5,  "3": 7,  "4": 9,  "5": 13, "6": 15, "7": 17, "8": 19, "9": 21,
  A: 1,  B: 0,  C: 5,  D: 7,  E: 9,  F: 13, G: 15, H: 17, I: 19, J: 21,
  K: 2,  L: 4,  M: 18, N: 20, O: 11, P: 3,  Q: 6,  R: 8,  S: 12, T: 14,
  U: 16, V: 10, W: 22, X: 25, Y: 24, Z: 23,
};
const EVEN: Record<string, number> = {
  "0": 0, "1": 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9,
  A: 0, B: 1, C: 2, D: 3, E: 4, F: 5, G: 6, H: 7, I: 8, J: 9,
  K: 10, L: 11, M: 12, N: 13, O: 14, P: 15, Q: 16, R: 17, S: 18, T: 19,
  U: 20, V: 21, W: 22, X: 23, Y: 24, Z: 25,
};
const CHECK = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * Restituisce true se la stringa rispetta formato + checksum.
 * Accetta input con eventuali spazi/lowercase: viene normalizzato.
 */
export function isValidFiscalCode(input: string | null | undefined): boolean {
  if (!input) return false;
  const cf = input.trim().toUpperCase().replace(/\s+/g, "");
  if (cf.length !== 16) return false;
  if (!FORMAT.test(cf)) return false;
  let sum = 0;
  for (let i = 0; i < 15; i++) {
    const ch = cf[i];
    // posizioni 1-based: dispari = i pari (0,2,4...), pari = i dispari (1,3,5...)
    sum += (i % 2 === 0 ? ODD[ch] : EVEN[ch]) ?? -1000;
  }
  if (sum < 0) return false;
  return CHECK[sum % 26] === cf[15];
}

/**
 * Normalizza un codice fiscale per lo storage: uppercase, no spazi.
 * Non ne verifica la validita': usa isValidFiscalCode separatamente.
 */
export function normalizeFiscalCode(input: string | null | undefined): string | null {
  if (!input) return null;
  const cf = input.trim().toUpperCase().replace(/\s+/g, "");
  return cf || null;
}
