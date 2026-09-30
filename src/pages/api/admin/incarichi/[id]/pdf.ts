/**
 * GET /api/admin/incarichi/:id/pdf — PDF della lettera d'incarico (admin).
 * Se firmata, include la firma SES del collaboratore.
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../../../server/db";
import { loadUserFromContext } from "../../../../../server/auth";
import { getIncaricoForPdf } from "../../../../../server/incarichi";
import { renderIncaricoPdf, type IncaricoSignature } from "../../../../../server/incarico-pdf";

export const prerender = false;

export const GET: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return new Response("backend", { status: 503 });
  const user = await loadUserFromContext(ctx);
  if (!user) return new Response("unauthorized", { status: 401 });
  if (user.role !== "admin") return new Response("forbidden", { status: 403 });

  const inc = await getIncaricoForPdf(db, ctx.params.id as string);
  if (!inc) return new Response("not found", { status: 404 });

  const sig: IncaricoSignature | null =
    inc.status === "signed" && (inc.signer_typed || inc.signer_image)
      ? { typed: inc.signer_typed ?? inc.person_name, image: inc.signer_image, signedAt: inc.signed_at ?? Date.now(), ipHash: inc.signer_ip_hash }
      : null;

  try {
    const bytes = await renderIncaricoPdf(env as Env, inc, sig);
    return new Response(bytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="incarico-${inc.person_name.replace(/[^a-zA-Z0-9]+/g, "-")}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("[incarico-pdf]", e);
    return new Response("errore PDF", { status: 500 });
  }
};
