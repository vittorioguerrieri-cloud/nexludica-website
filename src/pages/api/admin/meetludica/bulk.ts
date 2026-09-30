/**
 * Admin: bulk import subscribers da una lista di email.
 * POST con { emails: "a@b.com, c@d.com\ne@f.com" oppure array di stringhe }
 * Accetta anche righe nel formato "Nome <email@domain>" o "Nome,email@domain".
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../../server/db";
import { loadUserFromContext } from "../../../../server/auth";
import { canManageMeetludica } from "../../../../server/permissions";
import { addSubscribersBulk } from "../../../../server/meetludica";

export const prerender = false;

interface ParsedEntry { name?: string; email: string; }

function parseLine(line: string): ParsedEntry | null {
  const t = line.trim();
  if (!t) return null;
  // Formato "Nome Cognome <email@domain.com>"
  const m1 = /^(.+?)\s*<([^>]+)>$/.exec(t);
  if (m1) return { name: m1[1].trim(), email: m1[2].trim() };
  // Formato "Nome,email@domain.com" o "Nome;email@domain.com" o "Nome\temail@domain.com"
  const m2 = /^(.+?)[,;\t]\s*([^\s,;]+@[^\s,;]+)$/.exec(t);
  if (m2) return { name: m2[1].trim(), email: m2[2].trim() };
  // Solo email
  if (/^\S+@\S+\.\S+$/.test(t)) return { email: t };
  return null;
}

export const POST: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return json({ ok: false, error: "backend" }, 503);
  const user = await loadUserFromContext(ctx);
  if (!user) return json({ ok: false, error: "unauthorized" }, 401);
  if (!canManageMeetludica(user)) return json({ ok: false, error: "forbidden" }, 403);

  const body = (await ctx.request.json().catch(() => ({}))) as Record<string, unknown>;
  let lines: string[] = [];
  if (typeof body.emails === "string") {
    // Split su \n, virgola, punto-e-virgola
    lines = (body.emails as string).split(/[\n,;]+/);
  } else if (Array.isArray(body.emails)) {
    lines = body.emails.map((x) => String(x));
  } else {
    return json({ ok: false, error: "Campo 'emails' mancante" }, 400);
  }

  const parsed: ParsedEntry[] = [];
  let unparsable = 0;
  for (const line of lines) {
    const p = parseLine(line);
    if (p) parsed.push(p);
    else if (line.trim()) unparsable++;
  }

  if (parsed.length === 0) {
    return json({ ok: false, error: "Nessuna email valida trovata", unparsable }, 400);
  }

  const result = await addSubscribersBulk(db, parsed);
  return json({ ok: true, ...result, unparsable, total: parsed.length });
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
