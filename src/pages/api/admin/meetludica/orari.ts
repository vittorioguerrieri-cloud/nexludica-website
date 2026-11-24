/**
 * Admin sondaggio orari MeetLudica 2027:
 *  - GET    /api/admin/meetludica/orari          → CSV di tutte le risposte
 *  - DELETE /api/admin/meetludica/orari?id=ID    → elimina una risposta
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../../server/db";
import { loadUserFromContext } from "../../../../server/auth";
import { canManageMeetludica } from "../../../../server/permissions";
import {
  ORARI_GIORNI,
  ORARI_FASCE,
  listOrariRisposte,
  deleteOrariRisposta,
} from "../../../../server/meetludica-orari";

export const prerender = false;

function csvCell(v: string): string {
  return /[";\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export const GET: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return new Response("backend", { status: 503 });
  const user = await loadUserFromContext(ctx);
  if (!user) return new Response("unauthorized", { status: 401 });
  if (!canManageMeetludica(user)) return new Response("forbidden", { status: 403 });

  const risposte = await listOrariRisposte(db);
  const cols = ORARI_GIORNI.flatMap((g) =>
    ORARI_FASCE.map((f) => ({ key: `${g.key}-${f.key}`, label: `${g.short} ${f.label.replace(" – ", "-")}` })),
  );
  const header = ["Nome", "Email", "Ultimo invio", ...cols.map((c) => c.label), "Note"];
  const lines = [header.map(csvCell).join(";")];
  for (const r of risposte) {
    const set = new Set(r.slots);
    const when = new Date(r.updatedAt).toLocaleString("it-IT", { timeZone: "Europe/Rome" });
    lines.push(
      [r.name, r.email, when, ...cols.map((c) => (set.has(c.key) ? "1" : "0")), r.notes ?? ""]
        .map(csvCell)
        .join(";"),
    );
  }
  // BOM: Excel riconosce l'UTF-8 e mostra bene gli accenti.
  return new Response("﻿" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="meetludica-orari-2027.csv"',
    },
  });
};

export const DELETE: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return json({ ok: false, error: "backend" }, 503);
  const user = await loadUserFromContext(ctx);
  if (!user) return json({ ok: false, error: "unauthorized" }, 401);
  if (!canManageMeetludica(user)) return json({ ok: false, error: "forbidden" }, 403);
  const id = new URL(ctx.request.url).searchParams.get("id");
  if (!id) return json({ ok: false, error: "id mancante" }, 400);
  const ok = await deleteOrariRisposta(db, id);
  return json({ ok });
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
