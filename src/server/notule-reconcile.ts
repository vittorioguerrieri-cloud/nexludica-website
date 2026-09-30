/**
 * Riconciliazione automatica delle notule col bilancio.
 *
 *  - Gamba PERSONA: cerca un'uscita del bilancio col nome del percipiente nella
 *    controparte e importo == netto della notula → segna pagato alla persona.
 *  - Gamba F24: cerca un'uscita "F24/Agenzia Entrate/erario" con importo ==
 *    ritenuta → segna versato (l'F24 spesso è aggregato: in quel caso resta da
 *    segnare a mano dalla UI).
 *
 * Una notula passa a "paid" quando entrambe le gambe sono verificate.
 * Una transazione del bilancio è usata per UNA sola gamba (no doppio match).
 */
import { now } from "./db";

function norm(s: string | null | undefined): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function nameMatches(personName: string, counterparty: string | null): boolean {
  const tokens = norm(personName).split(" ").filter((t) => t.length > 1);
  if (tokens.length === 0) return false;
  const c = norm(counterparty);
  if (!c) return false;
  return tokens.every((t) => c.includes(t));
}

const F24_RE = /(^|\b)(f24|agenzia\s*entrate|erario|ritenut|imposte)/i;
const eqAmt = (a: number, b: number) => Math.abs(Math.abs(a) - Math.abs(b)) < 0.01;

export interface ReconcileResult {
  matchedPerson: number;
  matchedF24: number;
  nowPaid: number;
  scanned: number;
}

export async function reconcileNotule(db: D1Database): Promise<ReconcileResult> {
  // Uscite del bilancio (non escluse)
  const txnsRes = await db
    .prepare("SELECT id, counterparty, description, amount_eur FROM finance_transactions WHERE excluded = 0 AND amount_eur < 0")
    .all<{ id: string; counterparty: string | null; description: string | null; amount_eur: number }>();
  const txns = txnsRes.results ?? [];

  // Transazioni già collegate a una qualche gamba (evita doppio uso)
  const usedRes = await db
    .prepare("SELECT paid_person_txn_id, f24_txn_id FROM payment_notes")
    .all<{ paid_person_txn_id: string | null; f24_txn_id: string | null }>();
  const used = new Set<string>();
  for (const u of usedRes.results ?? []) {
    if (u.paid_person_txn_id) used.add(u.paid_person_txn_id);
    if (u.f24_txn_id) used.add(u.f24_txn_id);
  }

  // Notule firmate/pagate ancora con almeno una gamba aperta
  const notesRes = await db
    .prepare(
      `SELECT pn.id, pn.status, pn.amount_net, pn.withholding_amount, pn.paid_person_at, pn.f24_paid_at, u.name AS person_name
       FROM payment_notes pn JOIN users u ON u.id = pn.user_id
       WHERE pn.status IN ('signed','paid') AND (pn.paid_person_at IS NULL OR pn.f24_paid_at IS NULL)`,
    )
    .all<{ id: string; status: string; amount_net: number; withholding_amount: number; paid_person_at: number | null; f24_paid_at: number | null; person_name: string }>();
  const notes = notesRes.results ?? [];

  let matchedPerson = 0, matchedF24 = 0, nowPaid = 0;
  const t = now();

  for (const n of notes) {
    let personTxn: string | null = n.paid_person_at ? "x" : null;
    let f24Txn: string | null = n.f24_paid_at ? "x" : null;

    if (!n.paid_person_at) {
      const m = txns.find((tx) => !used.has(tx.id) && eqAmt(tx.amount_eur, n.amount_net) && nameMatches(n.person_name, tx.counterparty));
      if (m) {
        await db.prepare("UPDATE payment_notes SET paid_person_at = ?, paid_person_txn_id = ?, updated_at = ? WHERE id = ?").bind(t, m.id, t, n.id).run();
        used.add(m.id); matchedPerson++; personTxn = m.id;
      }
    }
    if (!n.f24_paid_at && n.withholding_amount > 0) {
      const m = txns.find((tx) => !used.has(tx.id) && eqAmt(tx.amount_eur, n.withholding_amount) && (F24_RE.test(tx.counterparty ?? "") || F24_RE.test(tx.description ?? "")));
      if (m) {
        await db.prepare("UPDATE payment_notes SET f24_paid_at = ?, f24_txn_id = ?, updated_at = ? WHERE id = ?").bind(t, m.id, t, n.id).run();
        used.add(m.id); matchedF24++; f24Txn = m.id;
      }
    }
    // Se entrambe le gambe sono verificate → "paid"
    const f24Needed = n.withholding_amount > 0;
    if (personTxn && (f24Txn || !f24Needed) && n.status !== "paid") {
      await db.prepare("UPDATE payment_notes SET status = 'paid', updated_at = ? WHERE id = ?").bind(t, n.id).run();
      nowPaid++;
    }
  }

  return { matchedPerson, matchedF24, nowPaid, scanned: notes.length };
}

/** Set/unset manuale di una gamba di pagamento (fallback per F24 aggregati). */
export async function setNotePaymentLeg(
  db: D1Database,
  id: string,
  leg: "person" | "f24",
  paid: boolean,
): Promise<void> {
  const t = paid ? now() : null;
  if (leg === "person") {
    await db.prepare("UPDATE payment_notes SET paid_person_at = ?, paid_person_txn_id = CASE WHEN ? IS NULL THEN NULL ELSE paid_person_txn_id END, updated_at = ? WHERE id = ?")
      .bind(t, t, now(), id).run();
  } else {
    await db.prepare("UPDATE payment_notes SET f24_paid_at = ?, f24_txn_id = CASE WHEN ? IS NULL THEN NULL ELSE f24_txn_id END, updated_at = ? WHERE id = ?")
      .bind(t, t, now(), id).run();
  }
  // Ricalcola lo status
  const r = await db.prepare("SELECT status, paid_person_at, f24_paid_at, withholding_amount FROM payment_notes WHERE id = ?").bind(id).first<{ status: string; paid_person_at: number | null; f24_paid_at: number | null; withholding_amount: number }>();
  if (r) {
    const f24Needed = r.withholding_amount > 0;
    const fullyPaid = r.paid_person_at && (r.f24_paid_at || !f24Needed);
    if (fullyPaid && r.status === "signed") {
      await db.prepare("UPDATE payment_notes SET status = 'paid', updated_at = ? WHERE id = ?").bind(now(), id).run();
    } else if (!fullyPaid && r.status === "paid") {
      await db.prepare("UPDATE payment_notes SET status = 'signed', updated_at = ? WHERE id = ?").bind(now(), id).run();
    }
  }
}
