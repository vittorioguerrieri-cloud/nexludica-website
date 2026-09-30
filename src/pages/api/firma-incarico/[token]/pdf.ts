/**
 * GET /api/firma-incarico/:token/pdf — PDF della lettera d'incarico per il
 * firmatario (pubblico via token). Include la firma SES se già firmata.
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../../server/db";
import { getIncaricoByToken, getIncaricoForPdf } from "../../../../server/incarichi";
import { renderIncaricoPdf, type IncaricoSignature } from "../../../../server/incarico-pdf";

export const prerender = false;

export const GET: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return new Response("backend", { status: 503 });
  const token = ctx.params.token as string;
  const base = await getIncaricoByToken(db, token);
  if (!base) return new Response("not found", { status: 404 });
  const inc = await getIncaricoForPdf(db, base.id);
  if (!inc) return new Response("not found", { status: 404 });

  const sig: IncaricoSignature | null =
    inc.status === "signed" && (inc.signer_typed || inc.signer_image)
      ? { typed: inc.signer_typed ?? inc.person_name, image: inc.signer_image, signedAt: inc.signed_at ?? Date.now(), ipHash: inc.signer_ip_hash }
      : null;

  try {
    const bytes = await renderIncaricoPdf(env as Env, inc, sig);
    return new Response(bytes, {
      status: 200,
      headers: { "Content-Type": "application/pdf", "Content-Disposition": "inline", "Cache-Control": "no-store" },
    });
  } catch (e) {
    console.error("[firma-incarico-pdf]", e);
    return new Response("errore PDF", { status: 500 });
  }
};
