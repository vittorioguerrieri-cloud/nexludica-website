/**
 * POST /api/playtest/checklist-items
 *   body { category, subcategory?, text, appliesTo, position? }
 *
 *   Crea un nuovo item nei template di sistema (game_id = NULL).
 *   Modificare i default impatta tutti i giochi che non hanno una copia
 *   personalizzata. Auth: soci loggati.
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../../server/db";
import { loadUserFromContext } from "../../../../server/auth";
import type { ChecklistApplies } from "../../../../server/playtest";
import { uuid } from "../../../../server/db";

export const prerender = false;

const VALID: ChecklistApplies[] = ["observation", "setup"];

export const POST: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return j({ ok: false, error: "backend" }, 503);
  const user = await loadUserFromContext(ctx);
  if (!user) return j({ ok: false, error: "unauthorized" }, 401);

  const body = (await ctx.request.json().catch(() => ({}))) as Record<string, unknown>;
  const category = String(body.category ?? "").trim().slice(0, 80);
  const subcategory = body.subcategory == null ? null : String(body.subcategory).trim().slice(0, 80) || null;
  const text = String(body.text ?? "").trim().slice(0, 400);
  const appliesTo = (body.appliesTo as ChecklistApplies) ?? "observation";
  if (!VALID.includes(appliesTo)) return j({ ok: false, error: "appliesTo invalido" }, 400);
  if (!category || !text) return j({ ok: false, error: "Categoria e testo obbligatori" }, 400);

  const position = Number(body.position ?? 9999);

  // Inserisco direttamente come item di sistema (game_id NULL).
  // Non posso usare createChecklistItem perché richiede gameId.
  const id = uuid();
  await db
    .prepare(
      `INSERT INTO playtest_checklist_items (id, game_id, category, subcategory, text, applies_to, position, active)
       VALUES (?, NULL, ?, ?, ?, ?, ?, 1)`,
    )
    .bind(id, category, subcategory, text, appliesTo, Number.isFinite(position) ? Math.round(position) : 9999)
    .run();

  const r = await db.prepare("SELECT * FROM playtest_checklist_items WHERE id = ?").bind(id).first();
  return j({ ok: true, item: r });
};

function j(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { "Content-Type": "application/json" } });
}
