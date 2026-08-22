/* Case ③ Law loop — batch-014 B3: tisk 217's live bill node lists a fifth sponsor (pspId 6743,
 * Robert Stržínek) whom the bill's own signature page (lines 218–224 of the cached print) does
 * not carry — no artifact in this repo evidences him as a sponsor. Publishing money ties against
 * a non-sponsor is the defamation-class defect the audit gate exists for; the batch-014 audit
 * ruled: record four sponsors (Babka 6623, Richter 6500, Sedláčková 7041, Nacher 6487).
 * Merge-preserving single-prop correction; refuses if the live state differs from expectation.
 *
 *   npx tsx scripts/case-loops/law/fix-217-sponsors-014.ts [--commit] [--pass=48]
 */
import { getStore } from "@/lib/db/store";

const COMMIT = process.argv.includes("--commit");
const PASS = Number(process.argv.find((a) => a.startsWith("--pass="))?.slice(7) ?? 48);
const NODE_ID = "bill:tisk:43339";
const DROP = 6743;
const EXPECT = [6623, 6500, 6487, 6743, 7041];

async function main() {
  const store = await getStore();
  if (!store) throw new Error("no store");
  const nodes = await store.listKgNodes({ kind: "bill" });
  const bill = nodes.find((n) => n.id === NODE_ID);
  if (!bill) throw new Error(`${NODE_ID} not found`);
  const sponsors = bill.props.sponsors as number[] | undefined;
  if (!Array.isArray(sponsors)) throw new Error("sponsors prop missing");
  if ([...sponsors].sort().join() !== [...EXPECT].sort().join())
    throw new Error(`live sponsors ${JSON.stringify(sponsors)} differ from expected pre-fix state — investigate before writing`);
  const fixed = sponsors.filter((s) => s !== DROP);
  console.log(`${NODE_ID}: sponsors ${JSON.stringify(sponsors)} → ${JSON.stringify(fixed)}`);
  if (COMMIT) {
    await store.upsertKgNodes([
      {
        ...bill,
        props: {
          ...bill.props,
          sponsors: fixed,
          sponsors_correction: {
            removed: DROP,
            reason: "signature page of tisk 217 carries four sponsors; pspId 6743 is not among them (batch-014 audit B3)",
            provenance: { track: "law", pass: PASS, method: "deterministic", ref: "sponsor-signature-page-check-014", computedAt: new Date().toISOString() },
          },
        },
      },
    ]);
    console.log(`COMMITTED (pass ${PASS}).`);
  } else {
    console.log("DRY-RUN — add --commit to write.");
  }
  await store.close();
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
