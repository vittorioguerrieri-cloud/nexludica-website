/**
 * GET /api/verbali/expected-attendees?type=<verbale_type>
 *
 * Restituisce i partecipanti "attesi" in base al tipo di verbale:
 *   - assemblea_ordinaria / straordinaria → tutti i soci con membership attiva
 *   - consiglio_direttivo                 → solo soci con board_role != NULL
 *   - riunione_operativa                  → tutti i soci attivi (riunioni di team)
 *
 * Format risposta:
 *   { ok: true, type, attendees: [{ id, name, email, role, board_role, board_role_label }] }
 *
 * Auth: tutti i soci loggati.
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../server/db";
import { loadUserFromContext } from "../../../server/auth";
import type { VerbaleType } from "../../../server/verbali";

export const prerender = false;

const VALID_TYPES: VerbaleType[] = [
  "assemblea_ordinaria", "assemblea_straordinaria", "consiglio_direttivo", "riunione_operativa",
];

function boardRoleLabel(r: string | null): string | null {
  if (!r) return null;
  const map: Record<string, string> = {
    presidente: "Presidente",
    vice_presidente: "Vice Presidente",
    segretario: "Segretario/a",
    tesoriere: "Tesoriere",
    consigliere: "Consigliere",
  };
  return map[r] ?? r;
}

const BOARD_ROLE_ORDER: Record<string, number> = {
  presidente: 0, vice_presidente: 1, segretario: 2, tesoriere: 3, consigliere: 4,
};

export const GET: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return j({ ok: false, error: "backend" }, 503);
  const user = await loadUserFromContext(ctx);
  if (!user) return j({ ok: false, error: "unauthorized" }, 401);

  const type = String(ctx.url.searchParams.get("type") ?? "") as VerbaleType;
  if (!VALID_TYPES.includes(type)) return j({ ok: false, error: "type invalido" }, 400);

  // Base query: soci con account attivo
  // Per assemblee: filtro su membership_status = 'active' (tutti i soci della lista)
  // Per direttivo: filtro aggiuntivo su board_role IS NOT NULL
  // Per operativa: tutti gli active (team operativo)
  let sql: string;
  if (type === "consiglio_direttivo") {
    sql = `
      SELECT u.id, u.name, u.email, u.role, u.board_role
      FROM users u
      LEFT JOIN member_data md ON md.user_id = u.id
      WHERE u.active = 1
        AND u.board_role IS NOT NULL
        AND (md.termination_date IS NULL OR md.termination_date = '')
      ORDER BY u.name`;
  } else if (type === "assemblea_ordinaria" || type === "assemblea_straordinaria") {
    sql = `
      SELECT u.id, u.name, u.email, u.role, u.board_role
      FROM users u
      INNER JOIN member_data md ON md.user_id = u.id
      WHERE u.active = 1
        AND md.membership_status = 'active'
        AND (md.termination_date IS NULL OR md.termination_date = '')
      ORDER BY u.name`;
  } else {
    // riunione_operativa: tutti gli active
    sql = `
      SELECT u.id, u.name, u.email, u.role, u.board_role
      FROM users u
      WHERE u.active = 1
      ORDER BY u.name`;
  }

  const { results } = await db.prepare(sql).all();
  const attendees = (results ?? []).map((r) => {
    const br = (r as any).board_role as string | null;
    return {
      id: String((r as any).id),
      name: String((r as any).name),
      email: String((r as any).email),
      role: String((r as any).role),
      board_role: br,
      board_role_label: boardRoleLabel(br),
    };
  });
  // Sort: direttivo prima (per ruolo), poi alfabetico
  attendees.sort((a, b) => {
    const aOrder = a.board_role ? BOARD_ROLE_ORDER[a.board_role] ?? 99 : 999;
    const bOrder = b.board_role ? BOARD_ROLE_ORDER[b.board_role] ?? 99 : 999;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return a.name.localeCompare(b.name);
  });

  return j({ ok: true, type, attendees });
};

function j(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { "Content-Type": "application/json" } });
}
