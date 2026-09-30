/**
 * DELETE /api/playtest/checklist-instances/:id — elimina l'istanza checklist
 * e tutte le response associate.
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../../../server/db";
import { loadUserFromContext } from "../../../../../server/auth";
import { deleteChecklistInstance } from "../../../../../server/playtest";

export const prerender = false;

export const DELETE: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return j({ ok: false, error: "backend" }, 503);
  const user = await loadUserFromContext(ctx);
  if (!user) return j({ ok: false, error: "unauthorized" }, 401);
  await deleteChecklistInstance(db, ctx.params.id as string);
  return j({ ok: true });
};

function j(d: unknown, s = 200) { return new Response(JSON.stringify(d), { status: s, headers: { "Content-Type": "application/json" } }); }
