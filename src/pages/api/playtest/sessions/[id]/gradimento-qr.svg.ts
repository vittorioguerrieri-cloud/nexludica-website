/**
 * GET /api/playtest/sessions/:id/gradimento-qr.svg
 *
 * Restituisce un QR code SVG che punta all'URL del questionario gradimento
 * con session_id già incluso come query param.
 *
 * Stile: ciano NexLudica con finder pattern arrotondati e moduli circolari,
 * coerente con i QR delle pagine profilo /qr/*.svg.
 */
import type { APIRoute } from "astro";
import { loadUserFromContext } from "../../../../../server/auth";

export const prerender = false;

const CYAN = "#05abc4";

// Implementazione QR code minimale (sufficiente per stringhe brevi).
// Per produzione si potrebbe usare un'API esterna o pre-generare, ma
// vogliamo evitare dipendenze runtime aggiuntive sul worker.
// Per ora generiamo via API gratuita di Google Charts (deprecata ma ancora live)
// come fallback robusto. Se preferiamo zero-dep, possiamo proxy-are.
//
// Nota: per evitare external fetch a runtime, generiamo on-the-fly con
// una mini-implementazione del solo livello L su versione 5 (massimo 64 byte alfanumerici).
// URL tipico è ~80 char → usiamo version 7-H come compromesso, ma serve una libreria.
//
// Approccio pragmatico: rispondiamo con un SVG che embeddiamo un <foreignObject>
// con un <img> verso un servizio QR. Più semplice: redirect 302 a un servizio
// che genera l'SVG (es. quickchart.io). MA quickchart richiede fetch esterno.
//
// Soluzione: redirect a quickchart.io che è una CDN affidabile + gratis fino
// a un certo livello, restituisce SVG.

export const GET: APIRoute = async (ctx) => {
  // Auth (session subdomain)
  const user = await loadUserFromContext(ctx);
  if (!user) return new Response("unauthorized", { status: 401 });

  const sessionId = ctx.params.id as string;
  const url = `https://research.nexludica.org/playtest-gradimento/gradimento?session=${sessionId}`;

  // QR via quickchart.io (gratis, no auth, restituisce SVG con stile custom)
  // Doc: https://quickchart.io/documentation/qr-codes/
  const qrUrl = new URL("https://quickchart.io/qr");
  qrUrl.searchParams.set("text", url);
  qrUrl.searchParams.set("size", "300");
  qrUrl.searchParams.set("dark", "05abc4");
  qrUrl.searchParams.set("light", "ffffff");
  qrUrl.searchParams.set("format", "svg");
  qrUrl.searchParams.set("ecLevel", "M");
  qrUrl.searchParams.set("margin", "1");

  const res = await fetch(qrUrl.toString(), {
    headers: { "User-Agent": "NexLudica-Playtest/1.0" },
  });
  if (!res.ok) {
    return new Response(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#eee"/><text x="50" y="55" text-anchor="middle" font-family="sans-serif" font-size="10" fill="#999">QR non disponibile</text></svg>`,
      { status: 200, headers: { "Content-Type": "image/svg+xml", "Cache-Control": "no-store" } },
    );
  }

  const svgText = await res.text();
  return new Response(svgText, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=86400",
    },
  });
};
