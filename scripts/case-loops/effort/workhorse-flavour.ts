/* Case ② Effort — batch 003 build support (O-effort-3, /zebricek quiet-workhorse surface).
 *
 * The existing `effort_workhorse` prop (batch 001/002, 12 MPs already live/pending) is a
 * bare boolean — it does not carry WHICH of the two positive-symmetry flavours (P31:
 * legislative-authorship vs oversight-institutional) the MP belongs to, so the /zebricek
 * build can't label or filter by flavour without this. `workhorseFlavour` has been
 * computed deterministically in triage.ts since batch 002 (billsAuthored > 0 ⇒
 * legislative, else oversight) but was never persisted as its own prop — this script
 * closes that gap with a single deterministic backfill covering every MP CURRENTLY
 * flagged quiet_workhorse in triage.json (the batch-001/002 MPs whose classification is
 * stable under recompute, PLUS this batch's new army picks), so the build has real data
 * to read the moment any batch's props go live. No LLM; no contribution_* touched.
 *
 *   PGLITE_PATH=./.pglite-copy-effort npx tsx scripts/case-loops/effort/workhorse-flavour.ts
 * (run AFTER triage.ts so triage.json reflects the current batch)
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const OUT = "docs/data-analysis/case-effort";

interface TriageRow {
  pspId: number;
  name: string;
  club: string;
  quietWorkhorse: boolean;
  workhorseFlavour: "legislative" | "oversight" | null;
  quietWorkhorseIndex: number;
}

function main() {
  const triage = JSON.parse(readFileSync(`${OUT}/triage.json`, "utf8")) as { batch: number; rows: TriageRow[] };
  // Departure guard (batch-003 reflection catch): a quiet-workhorse badge asserts a CURRENT
  // role — an MP who departed mid-term (e.g. Beran → replaced by Forman 2026-05-29) must not
  // be badged as a current workhorse. Cross-check against the end-date-aware tenure payload
  // (tenure.ts must run first) and drop departed/never_seated MPs from the backfill.
  const tenure = JSON.parse(readFileSync(`${OUT}/payloads/batch-003-tenure.json`, "utf8")) as {
    proposals: { id: string; props: { effort_tenure_class: string } }[];
  };
  const departedIds = new Set(
    tenure.proposals
      .filter((p) => p.props.effort_tenure_class === "departed" || p.props.effort_tenure_class === "never_seated")
      .map((p) => Number(p.id.split(":").pop())),
  );
  const workhorses = triage.rows.filter((r) => r.quietWorkhorse && r.workhorseFlavour && !departedIds.has(r.pspId));
  const droppedDeparted = triage.rows.filter((r) => r.quietWorkhorse && r.workhorseFlavour && departedIds.has(r.pspId));

  mkdirSync(`${OUT}/payloads`, { recursive: true });
  const payload = {
    case: "effort",
    batch: 3,
    generatedAt: new Date().toISOString(),
    note:
      "O-effort-3 build-support backfill: effort_workhorse_flavour (legislative|oversight, P31) for every MP " +
      "currently flagged quiet_workhorse by the deterministic triage lens (stable recompute of batch-001/002's " +
      "known 12 plus this batch's new picks), MINUS departed/never_seated MPs (batch-003 reflection catch: the " +
      "badge asserts a CURRENT role). Deterministic — no LLM. review_state stays pending_review.",
    droppedDeparted: droppedDeparted.map((r) => ({ pspId: r.pspId, name: r.name })),
    count: workhorses.length,
    legislativeCount: workhorses.filter((r) => r.workhorseFlavour === "legislative").length,
    oversightCount: workhorses.filter((r) => r.workhorseFlavour === "oversight").length,
    proposals: workhorses.map((r) => ({
      id: `psp:person:${r.pspId}`,
      name: r.name,
      club: r.club,
      props: {
        effort_workhorse: true,
        effort_workhorse_flavour: r.workhorseFlavour,
      },
    })),
  };
  writeFileSync(`${OUT}/payloads/batch-003-workhorse-flavour.json`, JSON.stringify(payload, null, 2));
  console.log(`WORKHORSE FLAVOUR · ${workhorses.length} MPs (legislative ${payload.legislativeCount}, oversight ${payload.oversightCount})`);
  workhorses.forEach((r) => console.log(`  ${r.name.padEnd(28)} ${r.club.padEnd(8)} ${r.workhorseFlavour}`));
  if (droppedDeparted.length) {
    console.log(`dropped (departed/never_seated — badge asserts a current role):`);
    droppedDeparted.forEach((r) => console.log(`  ✗ ${r.name}`));
  }
}
main();
