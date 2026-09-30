/**
 * GET /api/admin/notule/:id/pdf — PDF della notula (admin).
 * Mostra la marca da bollo solo se già assegnata (l'assegnazione avviene
 * all'invio in firma, per non consumare il pool in anteprima).
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../../../server/db";
import { loadUserFromContext } from "../../../../../server/auth";
import { getNoteForPdf } from "../../../../../server/payments";
import { findBolloForNote } from "../../../../../server/bolli";
import { renderNotulaPdf, type NotulaSignature } from "../../../../../server/notula-pdf";

export const prerender = false;

export const GET: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return new Response("backend", { status: 503 });
  const user = await loadUserFromContext(ctx);
  if (!user) return new Response("unauthorized", { status: 401 });
  if (user.role !== "admin") return new Response("forbidden", { status: 403 });

  const n = await getNoteForPdf(db, ctx.params.id as string);
  if (!n) return new Response("not found", { status: 404 });

  const b = n.bollo_required ? await findBolloForNote(db, n.id) : null;
  const sig: NotulaSignature | null =
    n.status === "signed" && (n.signer_typed || n.signer_image)
      ? { typed: n.signer_typed ?? n.person_name, image: n.signer_image, signedAt: n.signed_at ?? Date.now(), ipHash: n.signer_ip_hash }
      : null;

  try {
    const bytes = await renderNotulaPdf(env as Env, n, {
      bollo: b ? { bytes: b.image_data, mime: b.mime } : null,
      signature: sig,
    });
    return new Response(bytes, {
      status: 200,
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="notula-${n.numero_personale ?? n.numero}-${n.year}.pdf"`, "Cache-Control": "no-store" },
    });
  } catch (e) {
    console.error("[notula-pdf]", e);
    return new Response("errore PDF", { status: 500 });
  }
};
