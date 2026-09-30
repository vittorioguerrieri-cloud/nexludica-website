/**
 * Punto d'ingresso del worker: avvolge quello di Astro.
 *
 * Serve perche' il catalogo miniature e' fatto di pagine prerenderizzate, e per quelle
 * il middleware di Astro gira solo in fase di build: il controllo della password deve
 * stare davanti a tutto, prima che il worker serva il file statico.
 */
import astro from "@astrojs/cloudflare/entrypoints/server";
import { catalogoGate, isGated } from "../src/lib/catalogo-gate";

export default {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    const gated = await catalogoGate(request, env);
    if (gated) return gated;

    const res = await (astro as any).fetch(request, env, ctx);

    // Le pagine del catalogo non devono restare nella cache della CDN: una copia cacheata
    // verrebbe servita senza passare dal controllo della password.
    if (isGated(new URL(request.url).pathname)) {
      const out = new Response(res.body, res);
      out.headers.set("cache-control", "private, no-store");
      out.headers.set("x-robots-tag", "noindex, nofollow");
      return out;
    }
    return res;
  },
};
