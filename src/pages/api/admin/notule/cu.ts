/**
 * GET /api/admin/notule/cu?year=YYYY[&format=csv]
 *   Riepilogo CU per anno e percipiente (compensi, ritenute, anagrafica).
 *   format=csv → scarica il CSV.
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../../server/db";
import { loadUserFromContext } from "../../../../server/auth";
import { getCUSummary } from "../../../../server/payments";

export const prerender = false;

export const GET: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return new Response("backend", { status: 503 });
  const user = await loadUserFromContext(ctx);
  if (!user) return new Response("unauthorized", { status: 401 });
  if (user.role !== "admin") return new Response("forbidden", { status: 403 });

  const url = new URL(ctx.request.url);
  const year = Number(url.searchParams.get("year")) || new Date().getFullYear();
  const rows = await getCUSummary(db, year);

  if (url.searchParams.get("format") === "csv") {
    const esc = (s: unknown) => {
      const v = s == null ? "" : String(s);
      return /[",\r\n;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
    };
    const header = ["Percipiente", "Codice fiscale", "Luogo nascita", "Data nascita", "Indirizzo", "Citta", "Prov", "IBAN", "N. notule", "Compenso lordo", "Ritenuta", "Netto"];
    const lines = [header.join(";")];
    for (const r of rows) {
      lines.push([
        esc(r.name), esc(r.fiscal_code), esc(r.birth_place), esc(r.birth_date),
        esc(r.address), esc(r.city), esc(r.province), esc(r.iban),
        r.count, String(r.gross).replace(".", ","), String(r.withholding).replace(".", ","), String(r.net).replace(".", ","),
      ].join(";"));
    }
    const csv = "﻿" + lines.join("\r\n");
    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv;charset=utf-8",
        "Content-Disposition": `attachment; filename="CU-riepilogo-${year}.csv"`,
      },
    });
  }

  return new Response(JSON.stringify({ ok: true, year, rows }), {
    status: 200, headers: { "Content-Type": "application/json" },
  });
};
