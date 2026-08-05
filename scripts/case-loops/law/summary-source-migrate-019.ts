/* Case ③ Law loop — batch-019 P2: summary-source migration + the verdict-106 range correction.
 *
 * Two surgical store fixes, both PREPARE-by-default, both stamped with provenance:
 *
 * 1. batch-018 audit M20 — every bill node's `summary_source` prop cites a LOCAL CACHE PATH
 *    (".data\\law-collision-cache\\tisk-4\\265051.txt"), the forbidden citation class at 100 %
 *    coverage on a reader-facing line (BillDetail renders it beside „odvozeno z textu tisku").
 *    The public document the cache mirrors is the psp.cz print; the prop becomes that URL,
 *    matching the regenerated bill-summaries-cz.json (the render path reads the payload — the
 *    prop is the store's copy of the same fact and must not diverge from it).
 *
 * 2. batch-018 M2 carry-over — the published verdict-106 (pass 50) states tisk 106 inserts
 *    „nový § 9e až § 9m"; direct measurement of the cached print (batch-018, independently
 *    re-verified by that batch's audit) shows insertions through § 9n (no INSERTION reaches § 9o; the token itself occurs once, in the platné-znění annex cross-referencing the § 9o that tisk 107 would need). The
 *    single field is corrected to the measured range and the correction is stamped — verdict
 *    107 (pass 52) already states on the record that this measurement corrects the earlier
 *    assessment.
 *
 *   npx tsx scripts/case-loops/law/summary-source-migrate-019.ts [--commit] [--pass=N]
 */
import { getStore } from "@/lib/db/store";

const COMMIT = process.argv.includes("--commit");
const PASS = Number(process.argv.find((a) => a.startsWith("--pass="))?.slice(7) ?? 53);

const V106_BEFORE = "nový § 9e až § 9m";
const V106_AFTER = "nový § 9e až § 9n";

async function main() {
  const store = await getStore();
  if (!store) throw new Error("no store");
  const bills = await store.listKgNodes({ kind: "bill" });
  const toWrite = [];
  let sourceFixes = 0;
  let v106Fixed = false;
  for (const b of bills) {
    const props = structuredClone(b.props) as Record<string, unknown>;
    let dirty = false;
    const cislo = typeof props.cislo === "number" ? props.cislo : null;
    if (typeof props.summary_source === "string" && /law-collision-cache|\.txt/.test(props.summary_source)) {
      if (cislo === null) throw new Error(`${b.id}: cache-path summary_source but no cislo to build the URL from`);
      props.summary_source = `https://www.psp.cz/sqw/text/tiskt.sqw?o=10&ct=${cislo}&ct1=0`;
      props.summary_source_migration = { pass: PASS, ref: "summary-source-psp-url-019", computedAt: new Date().toISOString() };
      sourceFixes++;
      dirty = true;
    }
    if (cislo === 106) {
      const sr = props.forensic_stated_reasoning;
      if (typeof sr !== "string") throw new Error("tisk 106 carries no forensic_stated_reasoning");
      const hits = sr.split(V106_BEFORE).length - 1;
      if (hits !== 1) throw new Error(`tisk 106: expected exactly one occurrence of the 9e–9m range, found ${hits} — re-inspect before writing`);
      props.forensic_stated_reasoning = sr.replace(V106_BEFORE, V106_AFTER);
      const prov = props.forensic_provenance;
      if (!prov || typeof prov !== "object") throw new Error("tisk 106 carries no forensic_provenance capsule");
      (prov as Record<string, unknown>).range_correction = {
        pass: PASS,
        ref: "verdict-106-9n-range-019",
        field: "forensic_stated_reasoning",
        computedAt: new Date().toISOString(),
      };
      v106Fixed = true;
      dirty = true;
    }
    if (dirty) toWrite.push({ ...b, props });
  }
  if (!v106Fixed) throw new Error("tisk 106 not found");
  const withoutProp = bills.filter((b) => typeof (b.props as Record<string, unknown>).summary_source !== "string");
  console.log(`${sourceFixes} summary_source props → psp.cz URLs · verdict-106 range 9m → 9n (1 field)`);
  if (withoutProp.length > 0)
    console.log(`note: ${withoutProp.length} bill node(s) carry no summary_source prop at all and are untouched: ${withoutProp.map((b) => b.id).join(", ")}`);
  console.log("note: the archived verdicts-016/verdict-106.json payload deliberately keeps the original 9e–9m text — archives are not rewritten; the store carries the correction with its own provenance stamp.");
  if (COMMIT) {
    const n = await store.upsertKgNodes(toWrite);
    console.log(`COMMITTED: ${n} bill nodes (pass ${PASS}).`);
  } else {
    console.log("PREPARE only — add --commit after the batch closure to write.");
  }
  await store.close();
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
