/**
 * PATCH /api/playtest/checklist-items/:id  — modifica un item custom
 *   body può contenere { category?, subcategory?, text?, position?, active? }
 *
 * DELETE /api/playtest/checklist-items/:id — elimina un item custom
 *   (gli item di sistema con game_id NULL non sono eliminabili: protetti dalla
 *    query SQL in `deleteChecklistItem`).
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../../server/db";
import { loadUserFromContext } from "../../../../server/auth";
import {
  deleteChecklistItem,
  getChecklistItem,
  updateChecklistItem,
} from "../../../../server/playtest";

export const prerender = false;

export const PATCH: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return j({ ok: false, error: "backend" }, 503);
  const user = await loadUserFromContext(ctx);
  if (!user) return j({ ok: false, error: "unauthorized" }, 401);

  const id = ctx.params.id as string;
  const item = await getChecklistItem(db, id);
  if (!item) return j({ ok: false, error: "not found" }, 404);
  // Tutti gli item sono modificabili (anche i template di sistema):
  // siamo ancora in fase di testing delle checklist.

  const body = (await ctx.request.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: Parameters<typeof updateChecklistItem>[2] = {};
  if (typeof body.category === "string") patch.category = body.category.trim().slice(0, 80);
  if (body.subcategory !== undefined) patch.subcategory = body.subcategory == null ? null : String(body.subcategory).trim().slice(0, 80);
  if (typeof body.text === "string") patch.text = body.text.trim().slice(0, 400);
  if (body.position !== undefined) {
    const n = Number(body.position);
    if (Number.isFinite(n)) patch.position = Math.round(n);
  }
  if (typeof body.active === "boolean") patch.active = body.active;

  await updateChecklistItem(db, id, patch);
  const updated = await getChecklistItem(db, id);
  return j({ ok: true, item: updated });
};

export const DELETE: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return j({ ok: false, error: "backend" }, 503);
  const user = await loadUserFromContext(ctx);
  if (!user) return j({ ok: false, error: "unauthorized" }, 401);
  await deleteChecklistItem(db, ctx.params.id as string);
  return j({ ok: true });
};

function j(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { "Content-Type": "application/json" } });
}
