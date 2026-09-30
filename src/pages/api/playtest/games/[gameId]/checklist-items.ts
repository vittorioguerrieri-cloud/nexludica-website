/**
 * Gestione item checklist per un gioco specifico.
 *
 * GET  /api/playtest/games/:gameId/checklist-items?appliesTo=observation|setup
 *   Lista gli item attualmente in uso per quel gioco (custom se ne esistono,
 *   altrimenti i template di sistema). Include flag `isCustom` per indicare
 *   se il gioco ha già una copia personalizzata.
 *
 * POST /api/playtest/games/:gameId/checklist-items
 *   body { category, subcategory?, text, appliesTo, position? }
 *   Crea un nuovo item custom per il gioco. Se non ci sono ancora item custom,
 *   prima clona gli item di sistema (così l'aggiunta non "perde" i default).
 *
 * POST /api/playtest/games/:gameId/checklist-items?action=clone
 *   Clona gli item di sistema come custom del gioco (per partire da modello).
 *
 * POST /api/playtest/games/:gameId/checklist-items?action=reset
 *   Cancella tutti gli item custom: il gioco torna a usare i default di sistema.
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../../../server/db";
import { loadUserFromContext } from "../../../../../server/auth";
import {
  getGameById,
  listChecklistItems,
  hasCustomChecklistItems,
  cloneSystemChecklistToGame,
  resetGameChecklist,
  createChecklistItem,
  type ChecklistApplies,
} from "../../../../../server/playtest";

export const prerender = false;

const VALID_APPLIES: ChecklistApplies[] = ["observation", "setup"];

export const GET: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return j({ ok: false, error: "backend" }, 503);
  const user = await loadUserFromContext(ctx);
  if (!user) return j({ ok: false, error: "unauthorized" }, 401);

  const gameId = ctx.params.gameId as string;
  const game = await getGameById(db, gameId);
  if (!game) return j({ ok: false, error: "game not found" }, 404);

  const appliesTo = (ctx.url.searchParams.get("appliesTo") ?? "observation") as ChecklistApplies;
  if (!VALID_APPLIES.includes(appliesTo)) return j({ ok: false, error: "appliesTo invalido" }, 400);

  const isCustom = await hasCustomChecklistItems(db, gameId, appliesTo);
  const items = await listChecklistItems(db, appliesTo, gameId);
  return j({ ok: true, isCustom, items, appliesTo });
};

export const POST: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return j({ ok: false, error: "backend" }, 503);
  const user = await loadUserFromContext(ctx);
  if (!user) return j({ ok: false, error: "unauthorized" }, 401);

  const gameId = ctx.params.gameId as string;
  const game = await getGameById(db, gameId);
  if (!game) return j({ ok: false, error: "game not found" }, 404);

  const action = ctx.url.searchParams.get("action");
  const appliesToRaw = (ctx.url.searchParams.get("appliesTo") ?? "observation") as ChecklistApplies;
  if (!VALID_APPLIES.includes(appliesToRaw)) return j({ ok: false, error: "appliesTo invalido" }, 400);

  if (action === "clone") {
    const n = await cloneSystemChecklistToGame(db, gameId, appliesToRaw);
    return j({ ok: true, cloned: n });
  }
  if (action === "reset") {
    await resetGameChecklist(db, gameId, appliesToRaw);
    return j({ ok: true });
  }

  // Default: crea nuovo item
  const body = (await ctx.request.json().catch(() => ({}))) as Record<string, unknown>;
  const category = String(body.category ?? "").trim().slice(0, 80);
  const subcategory = nstr(body.subcategory, 80);
  const text = String(body.text ?? "").trim().slice(0, 400);
  const appliesTo = (body.appliesTo as ChecklistApplies) ?? appliesToRaw;
  if (!VALID_APPLIES.includes(appliesTo)) return j({ ok: false, error: "appliesTo invalido" }, 400);
  if (!category || !text) return j({ ok: false, error: "Categoria e testo obbligatori" }, 400);

  // Se è il primo item custom: clona prima i system → cosi' l'aggiunta non
  // fa scomparire gli altri default.
  await cloneSystemChecklistToGame(db, gameId, appliesTo);

  const position = Number(body.position ?? 9999);
  const item = await createChecklistItem(db, {
    gameId,
    category,
    subcategory,
    text,
    appliesTo,
    position: Number.isFinite(position) ? Math.round(position) : 9999,
  });
  return j({ ok: true, item });
};

function nstr(v: unknown, max: number): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s.slice(0, max) : null;
}
function j(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { "Content-Type": "application/json" } });
}
