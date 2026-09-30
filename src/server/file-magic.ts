/**
 * Validazione di tipo file basata sui magic bytes, non sull'header
 * Content-Type dichiarato dal client (che puo' essere falsificato).
 *
 * Supporta: JPEG, PNG, WebP, PDF.
 */

export type SafeMime = "image/jpeg" | "image/png" | "image/webp" | "application/pdf";

/**
 * Ispeziona i primi byte del file e ritorna il MIME riconosciuto, o null se
 * il file non corrisponde a nessun tipo supportato (= rifiutare).
 */
export async function detectFileType(file: Blob): Promise<SafeMime | null> {
  // Leggiamo i primi 16 byte: sufficienti per tutti i nostri formati.
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());

  // JPEG: FF D8 FF
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) {
    return "image/jpeg";
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47 &&
    head[4] === 0x0d && head[5] === 0x0a && head[6] === 0x1a && head[7] === 0x0a
  ) {
    return "image/png";
  }
  // WebP: "RIFF" .... "WEBP" (offset 8-11 = "WEBP")
  if (
    head[0] === 0x52 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x46 &&
    head[8] === 0x57 && head[9] === 0x45 && head[10] === 0x42 && head[11] === 0x50
  ) {
    return "image/webp";
  }
  // PDF: "%PDF-" (25 50 44 46 2D)
  if (
    head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46 &&
    head[4] === 0x2d
  ) {
    return "application/pdf";
  }
  return null;
}

/**
 * Verifica che il file sia uno dei tipi attesi. Ritorna { ok: true, mime }
 * se valido, altrimenti { ok: false, error }.
 */
export async function validateFileMagic(
  file: Blob,
  allowed: SafeMime[],
): Promise<{ ok: true; mime: SafeMime } | { ok: false; error: string }> {
  const detected = await detectFileType(file);
  if (!detected) {
    return { ok: false, error: "Tipo file non riconosciuto" };
  }
  if (!allowed.includes(detected)) {
    return { ok: false, error: `Tipo file non supportato (${detected})` };
  }
  return { ok: true, mime: detected };
}
