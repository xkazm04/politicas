/* Case ③ Law loop — cause attribution for the collision backlog.
 *
 * WHY. `collision-check.ts` emits one candidate row per (statute, bill-pair), and every count
 * downstream of it — `totalCollidingPairs`, the queue's `backlogRemaining`, the batch notes —
 * counts those rows. The rows are not independent. `duplicate-bills-009.ts` established the
 * shape: when one print's novelization instructions are carried inside another's, the two bills
 * collide on EVERY statute they share, and reading that statute-by-statute "multiplies one fact
 * into many" (batch-009-duplicate-bills.json §interpretation). It printed the consequence —
 * "2 bill-level relations explain 9 candidate pairs that the pair-by-pair method would have read
 * as independent findings" — and then the queue builder absorbed that result as a LITERAL:
 *
 *     const closedDuplicate = (a, b) => (a === 68 && b === 90) || (a === 90 && b === 68);
 *
 * One cause, subtracted by hand, in one direction. That is the defect this module removes: the
 * register already holds every relation the detector found, so the backlog reads it instead of
 * carrying one of its rows as a constant.
 *
 * WHAT IT IS NOT. This is not deduplication. Dedup asks whether two rows are the SAME row
 * (identity across sweeps, or one defect matched twice at one site); every row here is a
 * distinct, correctly emitted candidate at a distinct statute. The question is how many
 * independent FACTS the population contains, which is a second axis — so a row is attributed to
 * its cause rather than merged away, and nothing leaves the artifact.
 *
 * Deliberately not a threshold of its own. Whether a relation is strong enough to explain a row
 * is `duplicate-bills-009.ts`'s judgement (containment ≥ 0.25 over ≥ 4 instructions, verbatim
 * normalized match, no model); this module consumes the relations that detector published and
 * does not re-derive them.
 */

/** A candidate collision row as `collision-check.ts` and the batch-009 sweep emit it. */
export interface CandidatePair {
  lawRef: string;
  billA: number;
  billB: number;
}

/** A bill-level relation as `batch-009-duplicate-bills.json` publishes it. */
export interface BillRelation {
  billA: number;
  billB: number;
  relation: string;
}

/** Order-free key for a pair of prints. */
export function pairKey(a: number, b: number): string {
  return `${Math.min(a, b)}-${Math.max(a, b)}`;
}

export type CauseKind = "bill-relation" | "statute-pair";

export interface AttributedRow<P extends CandidatePair> {
  row: P;
  causeId: string;
  causeKind: CauseKind;
  /** The relation class when the cause is a bill-level fact; null when the row is its own cause. */
  relation: string | null;
}

export interface CauseSummary {
  id: string;
  kind: CauseKind;
  relation: string | null;
  /** How many candidate rows this one cause accounts for. */
  rows: number;
}

export interface CauseAttribution<P extends CandidatePair> {
  /** Every input row, in input order, each carrying its cause. Never fewer than the input. */
  rows: AttributedRow<P>[];
  /** Causes ordered by the number of rows they explain, descending, then by id. */
  causes: CauseSummary[];
  distinctCauses: number;
  /** Rows accounted for by a bill-level relation rather than standing alone. */
  rowsExplainedByRelation: number;
  /** Rows carrying no cause. Zero by construction; published so a caller can assert it. */
  unattributedRows: number;
}

/** Attribute every candidate row to a cause: a published bill-level relation where the row's
 * pair has one, otherwise the row itself. */
export function attributeCauses<P extends CandidatePair>(rows: readonly P[], register: readonly BillRelation[]): CauseAttribution<P> {
  const relationByPair = new Map(register.map((r) => [pairKey(r.billA, r.billB), r.relation]));
  const byCause = new Map<string, CauseSummary>();
  const attributed: AttributedRow<P>[] = [];

  for (const row of rows) {
    const key = pairKey(row.billA, row.billB);
    const relation = relationByPair.get(key) ?? null;
    const causeId = relation ? `bill:${key}` : `statute-pair:${row.lawRef}::${key}`;
    const causeKind: CauseKind = relation ? "bill-relation" : "statute-pair";
    attributed.push({ row, causeId, causeKind, relation });
    const seen = byCause.get(causeId);
    if (seen) seen.rows += 1;
    else byCause.set(causeId, { id: causeId, kind: causeKind, relation, rows: 1 });
  }

  const causes = [...byCause.values()].sort((a, b) => b.rows - a.rows || a.id.localeCompare(b.id));
  return {
    rows: attributed,
    causes,
    distinctCauses: causes.length,
    rowsExplainedByRelation: attributed.filter((a) => a.causeKind === "bill-relation").length,
    unattributedRows: attributed.filter((a) => !a.causeId).length,
  };
}

/** The count with its predicate. A backlog number published without the cause count reads as a
 * count of independent work, which the rows do not support — in either direction: the rows can
 * overstate the work (many rows, one relation), and the hand-subtracted constant understated it
 * (the relation closed seven rows and was then itself counted nowhere). */
export function renderCauseCount<P extends CandidatePair>(a: CauseAttribution<P>): string {
  const multi = a.causes.filter((c) => c.rows > 1);
  const head = `${a.rows.length} candidate row(s) from ${a.distinctCauses} distinct cause(s)`;
  if (multi.length === 0) return `${head}; every row is its own cause`;
  const worst = multi.map((c) => `${c.id} (${c.relation ?? "—"}) explains ${c.rows}`).join("; ");
  return `${head}; ${a.rowsExplainedByRelation} row(s) explained by ${multi.length} multi-row cause(s): ${worst}`;
}
