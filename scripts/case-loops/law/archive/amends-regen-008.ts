/* Case ③ Law loop — batch-008: amends edge regeneration v4 (PREPARE only).
 *
 * Re-run against the batch-008 census, which carries batch-007-round2-audit.md's F1 fix (a Čl.
 * block's forward heading-window scan is now clipped at an intervening ČÁST boundary — recovers
 * tisk 215 -> 280/2009, the audit's one disclosed recall gap). This script ALSO wires in the
 * audit's F2 finding: a per-citation title-role gate (see TITLE-ROLE GATE below) that rejects a
 * title-derived ref when it is a LINEAGE citation ("ve znění zákona č. X" — X is a prior amending
 * law of the real target, not itself amended by this bill) or NESTED inside another cited law's
 * own official name — corpus-verified (f2-title-gate-test.ts) to remove exactly the 5 false
 * title_fallback edges the audit named (tisk 153->468/1991, 88->360/2025, 124->300/2025,
 * 36->89/2012, 42->416/2009) and nothing else — the 2 genuine census-recall rescues (tisk
 * 107->159/1999, 243->223/2016) are untouched.
 *
 * Run against .pglite-copy-law-008 (a fresh copy of .pglite-copy-law-005, which already carries
 * the 187 missing-law-node ingest applied) — same resolution universe as batch-005/006/007.
 * batch-007/amends-regen-007.ts kept unchanged for history.
 *
 * Builds the full regenerated `amends` (bill → law) edge PROPOSAL set from the batch-008 census:
 *   - for bills with a batch-008 census_full proposal (set-difference trigger), use the UNION of
 *     the body-extracted citation list and the title-derived amended_laws prop (now role-gated,
 *     see above);
 *   - for the other bills, fall back to title-derived only (also role-gated);
 *   - a citation only becomes an edge proposal if a `law` node actually exists for it AND that
 *     node's e-Sbírka title marks it as an act of parliament (D8 gate, unchanged) — citations to
 *     statutes with NO corresponding law node are counted and listed separately (a "missing law
 *     nodes" census), never invented as edges.
 *
 * Read-only against a copy of the live graph (PGLITE_PATH must point at a `cp -r` copy, never
 * the live `./.pglite`). Does NOT write to the graph — this is a preparation script only; the
 * orchestrator serializes the actual topology change via apply-amends-regen.ts (batch-006,
 * re-pointed at this payload — still stale, unchanged this batch, same as batch-007's boundary).
 *
 *   PGLITE_PATH=./.pglite-copy-law-008 npx tsx scripts/case-loops/law/amends-regen-008.ts
 * → docs/data-analysis/case-law/payloads/batch-008-amends-regen.json
 * → docs/data-analysis/case-law/payloads/batch-008-amends-regen-impact.md
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { getStore } from "@/lib/db/store";

const CENSUS_IN = "docs/data-analysis/case-law/payloads/batch-008-amends-census.json";
const PROPOSAL_IN = "docs/data-analysis/case-law/payloads/batch-008-amended-laws-full-proposal-v2.json";
const OUT = "docs/data-analysis/case-law/payloads/batch-008-amends-regen.json";
const IMPACT_OUT = "docs/data-analysis/case-law/payloads/batch-008-amends-regen-impact.md";
const CACHE_DIR = ".data/law-collision-cache";

/* batch-008 F2 fix (round-2 audit): a title-derived ref (the bill's `amended_laws` graph prop,
 * extracted by psp-legislation.ts from the TITLE only, with no verb-semantics gate) is rejected
 * per-citation when its own syntactic role in the FULL title preamble (never the graph's
 * 200-char-truncated `label` — that trap defeated the round-1 title gate, see batch-007's N-A/
 * reflection findings) shows it is not an independent amend target:
 *   - LINEAGE: "ve znění zákona č. X Sb." — X is a PRIOR amending law of the real target, cited
 *     only to date-stamp it, not itself amended by this bill (tisk 88->360/2025, 124->300/2025).
 *   - NESTED-AMEND: "zákon č. Y Sb., kterým se mění zákon č. X Sb." where X is not the bill's own
 *     FIRST-cited target — X is part of describing what Y itself is (an amending act named after
 *     what it amends), not a second thing this bill changes (tisk 36->89/2012, 42->416/2009). The
 *     "not first" guard matters: the bill's OWN primary target is always introduced by the exact
 *     same "kterým se mění zákon č." construction as the very first citation in the enactment
 *     formula ("ZÁKON ze dne ..., kterým se mění zákon č. X ...") — only a SECOND-OR-LATER
 *     occurrence is nested inside an earlier law's name.
 *   - NESTED-NAME: "... a o změně a doplnění zákona č. X Sb." — X is part of an earlier-cited
 *     law's own official multi-part name (tisk 153->468/1991: "zákon č. 40/1995 Sb., o regulaci
 *     reklamy a o změně a doplnění zákona č. 468/1991 Sb." IS 40/1995's full legal name).
 * Corpus-verified (f2-title-gate-test.ts, all 141 bills' title preambles): removes exactly these
 * 5 refs and nothing else — the 2 genuine census-recall rescues (tisk 107->159/1999, 243->223/2016)
 * have no lineage/nesting shape and are untouched.
 * NFC-normalize is required: pdftotext inconsistently emits "č" as a decomposed "c" + U+030C
 * combining caron within the SAME document (found live on tisk 36's first "č." token) — an
 * unnormalized regex literal "č" silently misses those occurrences.
 */
const LINEAGE_RE = /ve\s+zn[ěe]n[íi]\s+z[áa]kona\s*$/iu;
const NESTED_AMEND_TITLE_RE = /kter(?:[ýy]m|ou|[ýy]mi)\s+se\s+m[ěe]n[íi]\s+z[áa]kon\s*$/iu;
const NESTED_NAME_RE = /(?:a\s+)?o\s+zm[ěe]n[ěe]\s+a\s+dopln[ěe]n[íi]\s+z[áa]kona\s*$/iu;

function loadTitlePreamble(cislo: number): string | null {
  const dir = path.join(CACHE_DIR, `tisk-${cislo}`);
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir).filter((f) => f.endsWith(".txt"));
  if (files.length === 0) return null;
  const text = readFileSync(path.join(dir, files[0]), "utf8").normalize("NFC");
  const idx = text.search(/Parlament\s+se\s+usnesl/iu);
  return idx > 0 ? text.slice(0, idx) : text.slice(0, 2500);
}

/** Returns the set of title-derived refs to DROP for this bill (role-gated false positives). */
function titleRoleGateDrops(cislo: number, titleLaws: string[]): Set<string> {
  const drops = new Set<string>();
  if (titleLaws.length === 0) return drops;
  const preamble = loadTitlePreamble(cislo);
  if (!preamble) return drops; // no cached text — nothing to check, leave the ref alone (out of scope)

  const anyCitationRe = /č\.\s*(\d{1,4})\s*\/\s*(\d{4})\s*Sb\./g;
  let firstCitationIdx: number | null = null;
  let cm: RegExpExecArray | null;
  while ((cm = anyCitationRe.exec(preamble))) {
    if (firstCitationIdx === null) firstCitationIdx = cm.index;
  }

  for (const ref of titleLaws) {
    const [n, y] = ref.split("/");
    const re = new RegExp(`č\\.\\s*${n}\\s*/\\s*${y}\\s*Sb\\.`, "g");
    let m: RegExpExecArray | null;
    let anySuppressed = false;
    let found = false;
    while ((m = re.exec(preamble))) {
      found = true;
      const context = preamble.slice(Math.max(0, m.index - 90), m.index).replace(/\s+/g, " ");
      const isFirst = firstCitationIdx !== null && m.index === firstCitationIdx;
      const suppressed =
        LINEAGE_RE.test(context) || (!isFirst && NESTED_AMEND_TITLE_RE.test(context)) || NESTED_NAME_RE.test(context);
      if (!suppressed) {
        anySuppressed = false;
        break; // one un-suppressed occurrence is enough to keep the ref
      }
      anySuppressed = true;
    }
    if (found && anySuppressed) drops.add(ref);
  }
  return drops;
}

interface CensusRow {
  tiskId: string;
  cislo: number;
  origin: string;
  title: string;
  recordedAmends: number;
  recordedLaws: string[];
  realLaws: string[];
  realCount: number;
  undercount: number;
  docType: string;
  sourceUrl: string;
  repealedRefs?: string[];
}
interface CensusFile {
  skips: { cislo: number; stage: string; reason: string }[];
  rows: CensusRow[];
}
interface ProposalFile {
  proposals: { billNodeId: string; cislo: number; amended_laws_full: string[]; recordedLaws: string[]; undercount: number }[];
}

async function main() {
  const generatedAt = new Date().toISOString(); // shared across edges (N3 fix) and the payload's own `generatedAt`
  const store = await getStore();
  if (!store) throw new Error("no store — set PGLITE_PATH to a copy, e.g. PGLITE_PATH=./.pglite-copy-law-regen");

  const nodes = await store.listKgNodes();
  const edges = await store.listKgEdges();
  const bills = nodes.filter((n) => n.kind === "bill");
  const laws = nodes.filter((n) => n.kind === "law");
  const lawNodeByRef = new Map(laws.map((n) => [String((n.props as Record<string, unknown>).ref ?? ""), n.id]));
  const currentAmendsEdges = edges.filter((e) => e.rel === "amends");

  const census: CensusFile = JSON.parse(readFileSync(CENSUS_IN, "utf8"));
  const proposal: ProposalFile = JSON.parse(readFileSync(PROPOSAL_IN, "utf8"));
  const proposalByBillId = new Map(proposal.proposals.map((p) => [p.billNodeId, p]));
  const skippedCislo = new Set(census.skips.map((s) => s.cislo));
  // batch-008 round 2 (reflection pass on tisk 231): repealedRefs per bill (amends-census.ts,
  // structurally captured — not a title-regex guess) is used below to suppress the SAME ref
  // arriving via the title-derived union, even when the bill's title ALSO carries a real
  // amendment (tisk 231: "kterým se mění zákon č. 483/1991 Sb. … a kterým se zrušuje zákon č.
  // 348/2005 Sb." — a title-level regex cannot discriminate per-citation; the census already did,
  // per-block, on the actual operative text).
  // CAUGHT DURING THIS BATCH (before shipping — re-running the pipeline surfaced it as a huge
  // edge-count drop, 585 -> 546, and a jump in no_data bills from 9 to 33): a ref can legitimately
  // appear in BOTH `realLaws` (a genuine earlier amend block) AND `repealedRefs` (e.g. a LATER
  // "Přechodné ustanovení" block for the SAME statute — normal Czech drafting: "for the period
  // before this amendment's effect, the OLD text of law X applies", citing the very law being
  // amended, not a different predecessor). Unconditionally suppressing any title-derived ref
  // present in `repealedRefs` wrongly dropped these — exclude a ref ONLY when it is NOT also a
  // genuinely real target elsewhere in the SAME bill.
  const repealedRefsByCislo = new Map(
    census.rows.map((r) => [r.cislo, new Set((r.repealedRefs ?? []).filter((ref) => !r.realLaws.includes(ref)))]),
  );

  // ---- CURRENT (before) churn ranking, from the live 150 amends edges ----
  const lawNodeById = new Map(laws.map((n) => [n.id, n]));
  const beforeChurn = new Map<string, number>(); // law node id -> edge count
  for (const e of currentAmendsEdges) beforeChurn.set(e.dst, (beforeChurn.get(e.dst) ?? 0) + 1);

  // ---- Build regenerated edge set ----
  interface EdgeProposal {
    from: string;
    to: string;
    ref: string;
    provenance: { track: "law"; pass: number; method: "deterministic"; ref: string; computedAt: string };
    source: "census_full" | "title_fallback" | "no_data";
  }
  const edgeMap = new Map<string, EdgeProposal>(); // dedupe key `${from}|${to}`
  const perBillLog: {
    billNodeId: string;
    cislo: number;
    source: "census_full" | "title_fallback" | "no_data";
    citationCount: number;
    resolvedCount: number;
    unresolvedRefs: string[];
  }[] = [];
  const missingLawCites = new Map<string, { statute: string; billIds: Set<string>; billCislo: Set<number> }>();

  // batch-005 D8 fix (Opus audit): a parliamentary bill can only amend an ACT OF PARLIAMENT
  // (zákon / ústavní zákon) — not a government regulation (nařízení vlády), ministerial decree
  // (vyhláška), or a communiqué (sdělení). 6 of the 191 newly-ingested law nodes are exactly
  // this class (proven false amends targets by the audit: e.g. "9/2002 Sb." is Nařízení vlády o
  // emisích hluku, not a law tisk 222 could amend — it was a footnote citation, not an amending
  // target, now separately fixed at the extraction layer too, see amends-census.ts). Gate on the
  // e-Sbírka title prefix (the same field the ingest resolved, esbirka_title) rather than
  // deleting the node — the node can stay (it is a REAL statute/regulation), it just may never
  // become an `amends` edge TARGET.
  const nonActPrefixes = ["Nařízení vlády", "Vyhláška", "Sdělení", "Usnesení", "Opatření"];
  const isAmendableAct = (lawNode: (typeof laws)[number]): boolean => {
    const title = String((lawNode.props as Record<string, unknown>).esbirka_title ?? "");
    if (!title) return true; // no title on record (e.g. a pre-batch-005 node without esbirka_title) — do not gate what we can't classify
    return !nonActPrefixes.some((p) => title.startsWith(p));
  };
  const excludedNonActRefs: { ref: string; title: string; billCislo: number[] }[] = [];
  const titleRoleGateExclusions: { cislo: number; ref: string }[] = [];

  // batch-008 fix (independent audit N-A, then the reflection pass's tisk-231 correction): the
  // title-derived `amended_laws` prop (psp-legislation.ts's LAW_CITATION extractor) picks every
  // "č. N/RRRR Sb." citation in the TITLE regardless of the surrounding verb — it cannot tell
  // "kterým se MĚNÍ zákon č. X" (amends) from "kterým se ZRUŠUJE zákon č. X" (repeals). The
  // census's title-verb gate correctly zeroes a PURE-repeal bill's census_full list (tisk 116),
  // but the UNION below previously re-added the stale title-derived ref anyway.
  //
  // Two layers, kept together because they catch different bills:
  //   1. isPureRepealTitle — a coarse title-level gate for bills with NO census proposal at all
  //      (so `repealedRefsByCislo` has nothing to check against): if the bill's own title says
  //      "kterým/kterou/kterými se RUŠÍ/ZRUŠUJE" and NEVER says "… se mění" anywhere, the whole
  //      bill is a repeal — zero its title-derived union (tisk 116, tisk 129's class if it ever
  //      lacked census data).
  //   2. repealedRefsByCislo — a PER-CITATION exclusion built from the census's own structural
  //      read of the operative text (amends-census.ts's repealedRefs, captured from
  //      "Zrušovací ustanovení"/"Zrušují se:" blocks it deliberately did not extract as amend
  //      targets). This is what correctly handles a MIXED title like tisk 231's ("kterým se mění
  //      zákon č. 483/1991 Sb. … a kterým se zrušuje zákon č. 348/2005 Sb.") — a title-level
  //      regex cannot discriminate WHICH of the title's several citations is the repealed one;
  //      the census already worked that out per-block on the real text. A first attempt at this
  //      fix used ONLY layer 1 with a blanket "any 'zrušuje' present -> blank titleLaws" rule,
  //      which wrongly dropped tisk 231's two real amendments too (caught by re-running the
  //      pipeline and seeing the edge count drop by more than the expected 1) — narrowing layer 1
  //      to pure-repeal titles and adding layer 2 for the mixed case is the fix that held.
  const REPEAL_TITLE_RE = /kter(?:ým|ou|ými)\s+se\s+(?:ruší|zrušuje)/iu;
  const AMENDING_TITLE_RE = /kter(?:ým|ou|ými)\s+se\s+mění/iu;

  for (const bill of bills) {
    const p = bill.props as Record<string, unknown>;
    const cislo = Number(p.cislo);
    const censusProp = proposalByBillId.get(bill.id);
    const billTitle = String(bill.label ?? p.title ?? "");
    const isPureRepealTitle = REPEAL_TITLE_RE.test(billTitle) && !AMENDING_TITLE_RE.test(billTitle);
    const billRepealedRefs = repealedRefsByCislo.get(cislo) ?? new Set<string>();
    const rawTitleLaws = isPureRepealTitle ? [] : Array.isArray(p.amended_laws) ? (p.amended_laws as string[]) : [];
    const repealFiltered = rawTitleLaws.filter((ref) => !billRepealedRefs.has(ref));
    // F2 fix (batch-008): per-citation syntactic-role gate — see titleRoleGateDrops above.
    const roleGateDrops = titleRoleGateDrops(cislo, repealFiltered);
    for (const ref of roleGateDrops) titleRoleGateExclusions.push({ cislo, ref });
    const titleLaws = repealFiltered.filter((ref) => !roleGateDrops.has(ref));
    // citationSource: per-ref provenance tag, since the union below can pull refs from either
    // the census body-extraction or the title-derived graph prop within the SAME bill.
    let citationSource: Map<string, "census_full" | "title_fallback">;
    let source: "census_full" | "title_fallback" | "no_data";

    if (censusProp) {
      // Defect 1 fix (per Opus audit, batch-004-amends-regen-audit.md): UNION the census
      // body-extracted list with the recorded/title-derived list, not a replace. The body
      // extraction can miss a statute the title records (e.g. tisk 88 / 360/2025) — a
      // replace silently drops a live edge. Union keeps both; refs from the census list are
      // tagged "census_full", refs found only via the title-derived list are tagged
      // "title_fallback" (matches validator's per-source provenance check).
      citationSource = new Map();
      for (const ref of censusProp.amended_laws_full) citationSource.set(ref, "census_full");
      for (const ref of titleLaws) if (!citationSource.has(ref)) citationSource.set(ref, "title_fallback");
      source = "census_full";
    } else {
      citationSource = new Map(titleLaws.map((ref) => [ref, "title_fallback" as const]));
      source = titleLaws.length > 0 ? "title_fallback" : "no_data";
      if (source === "no_data" && !skippedCislo.has(cislo)) {
        // Not one of the census skips, and no title-derived citation either — a genuinely
        // amends-less bill (e.g. a non-amending print) is plausible; log it either way, no
        // silent drop.
      }
    }

    const citations = [...citationSource.keys()];
    const resolved: string[] = [];
    const unresolved: string[] = [];
    for (const ref of citations) {
      const refSource = citationSource.get(ref)!;
      const lawNodeId = lawNodeByRef.get(ref);
      const lawNode = lawNodeId ? lawNodeById.get(lawNodeId) : undefined;
      if (lawNodeId && lawNode && !isAmendableAct(lawNode)) {
        const title = String((lawNode.props as Record<string, unknown>).esbirka_title ?? "");
        const rec = excludedNonActRefs.find((r) => r.ref === ref) ?? { ref, title, billCislo: [] };
        if (!excludedNonActRefs.includes(rec)) excludedNonActRefs.push(rec);
        rec.billCislo.push(cislo);
        unresolved.push(ref); // logged as unresolved for this bill's log (not fabricated into an edge), distinct list below carries the WHY
        continue;
      }
      if (lawNodeId) {
        resolved.push(ref);
        const key = `${bill.id}|${lawNodeId}`;
        if (!edgeMap.has(key)) {
          edgeMap.set(key, {
            from: bill.id,
            to: lawNodeId,
            ref,
            // D4 fix (Opus audit): pass:0 is an explicit provisional placeholder (kernel 5-field
            // provenance contract requires `pass` — the orchestrator's real apply must overwrite
            // it with the actual assigned pass number, same as the node payload's placeholder).
            // N3 fix (batch-006 audit): computedAt was missing on all 567 edges — now stamped at
            // generation time (shared across the run, same convention as the node payload).
            provenance: { track: "law", pass: 0, method: "deterministic", ref: "amends-regen-census-007", computedAt: generatedAt },
            source: refSource,
          });
        }
      } else {
        unresolved.push(ref);
        const rec = missingLawCites.get(ref) ?? { statute: ref, billIds: new Set(), billCislo: new Set() };
        rec.billIds.add(bill.id);
        rec.billCislo.add(cislo);
        missingLawCites.set(ref, rec);
      }
    }

    perBillLog.push({
      billNodeId: bill.id,
      cislo,
      source,
      citationCount: citations.length,
      resolvedCount: resolved.length,
      unresolvedRefs: unresolved,
    });
  }

  const regenEdges = [...edgeMap.values()];

  // ---- AFTER churn ranking (regenerated set) ----
  const afterChurn = new Map<string, number>(); // law node id -> edge count
  for (const e of regenEdges) afterChurn.set(e.to, (afterChurn.get(e.to) ?? 0) + 1);

  const refOf = (lawNodeId: string) => String((lawNodeById.get(lawNodeId)?.props as Record<string, unknown> | undefined)?.ref ?? lawNodeId);

  const beforeTop10 = [...beforeChurn.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id, count], i) => ({ rank: i + 1, lawNodeId: id, ref: refOf(id), count }));
  const afterTop10 = [...afterChurn.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id, count], i) => ({ rank: i + 1, lawNodeId: id, ref: refOf(id), count }));

  const beforeRankByRef = new Map(beforeTop10.map((r) => [r.ref, r.rank]));
  const rankShift = afterTop10.map((r) => ({
    ...r,
    beforeRank: beforeRankByRef.get(r.ref) ?? null,
    beforeCount: beforeChurn.get(r.lawNodeId) ?? 0,
    delta: r.count - (beforeChurn.get(r.lawNodeId) ?? 0),
  }));

  // ---- Skip/no-data bookkeeping (no silent truncation) ----
  const noDataBills = perBillLog.filter((b) => b.source === "no_data");
  const censusFullCount = perBillLog.filter((b) => b.source === "census_full").length;
  const titleFallbackCount = perBillLog.filter((b) => b.source === "title_fallback").length;

  const missingLawCensus = [...missingLawCites.values()]
    .map((r) => ({
      statute: r.statute,
      citingBillCount: r.billIds.size,
      sampleBillIds: [...r.billIds].slice(0, 5),
      sampleBillCislo: [...r.billCislo].sort((a, b) => a - b).slice(0, 5),
    }))
    .sort((a, b) => b.citingBillCount - a.citingBillCount);

  const totalUnresolvedCitations = perBillLog.reduce((a, b) => a + b.unresolvedRefs.length, 0);

  const out = {
    generatedAt,
    method:
      "batch-008 (post F1/F2 fix, batch-007-round2-audit.md): for bills with a batch-008 census (set-difference-triggered, batch-008-amended-laws-full-proposal-v2.json) census_full proposal, use the UNION of the body-extracted citation list and the title-derived amended_laws prop, now per-citation ROLE-GATED (titleRoleGateDrops — rejects lineage/nested-name/nested-amend refs, F2 fix). For the other bills, fall back to title-derived only, also role-gated. Run against .pglite-copy-law-008 (a copy of .pglite-copy-law-005), which already carries the 187 law nodes resolved by ingest-missing-laws.ts — so citations unresolved before that ingest now resolve. A citation becomes an edge ONLY IF a law node exists for it AND that node's e-Sbírka title marks it as an act of parliament (zákon/ústavní zákon), not a government regulation/decree/communiqué (D8 fix) — non-act targets are logged in excludedNonActRefs, never silently dropped or fabricated into an edge. Unresolved (no node at all) citations are counted in missingLawNodeCensus. The census (amends-census.ts) carries the F1 fix: a Čl. block's forward heading-window scan is now clipped at an intervening ČÁST boundary (tisk 215's real amendment to 280/2009, previously lost to heading-window bleed from the NEXT part's ÚČINNOST heading, is recovered).",
    boundary:
      "PREPARE only — read-only against .pglite-copy-law-008 (a fresh copy of .pglite-copy-law-005), not applied to the live graph. " +
      "IMPORTANT: apply-amends-regen.ts (batch-006) is NOT re-pointed at this payload — its " +
      "NODE_PAYLOAD/EDGE_PAYLOAD/REPORT_OUT constants and EXCLUDED_LOW_CONFIDENCE_EDGES list " +
      "still name batch-005's files/edges (deliberately left untouched this batch — it belongs " +
      "to a concurrent sibling agent generalizing its pattern elsewhere). Its own startup " +
      "assertion will REFUSE to run against this payload unmodified (none of its hardcoded " +
      "exclusion keys match batch-008's edges), which is a safe failure, not a working path — " +
      "do not attempt to run it against this payload without first re-pointing those constants " +
      "and re-deriving the exclusion list (this payload needs none — its false-edge exclusions " +
      "are structural, not an allowlist). See docs/data-analysis/case-law/handoff.md for the " +
      "full audit trail before any live apply.",
    LIVE_GRAPH_CAVEAT_READ_THIS_BEFORE_APPLYING:
      "The stats block below (currentAmendsEdgeCount, edgeCountDelta, etc.) is computed against " +
      "THIS SCRIPT'S COPY (.pglite-copy-law-008, a fresh copy of .pglite-copy-law-005), which " +
      "predates batch-007's live apply and therefore still shows a 150-edge baseline. It does " +
      "NOT reflect the real live graph, which already carries batch-007's 581-edge set (applied " +
      "2026-07-25, commit 257e723, pass 30) BEFORE this batch started. Read literally, " +
      "'edgeCountDelta: 427' looks like 427 new edges are needed — that is WRONG for a live " +
      "apply. The real, live-graph-relative change this payload represents is exactly SIX edges: " +
      "+1 (tisk 215 -> 280/2009, F1) and -5 (the F2 false-edge set, see docs/data-analysis/" +
      "case-law/payloads/batch-008-f2-deletion-payload.json), independently confirmed via " +
      "`PGLITE_PATH=./.pglite npx tsx scripts/case-loops/law/diff-amends-regen-deletions.ts " +
      "--payload=docs/data-analysis/case-law/payloads/batch-008-amends-regen.json` (read-only " +
      "against the LIVE graph): 1 added / 5 dropped / 0 unallowlisted, live count 581 -> 577. " +
      "Applying the full 577-edge payload via a props-merge-preserving apply path (once one is " +
      "re-pointed at this payload, see `boundary` above) is equivalent to that 6-edge targeted " +
      "change for the other 576 edges (identical keys, unchanged) — do NOT read the 150/+427 " +
      "figures as meaning 427 edges are missing from the live graph.",
    stats: {
      billsTotal: bills.length,
      billsUsingCensusFull: censusFullCount,
      billsUsingTitleFallback: titleFallbackCount,
      billsWithNoData: noDataBills.length,
      billsWithNoDataList: noDataBills.map((b) => ({ billNodeId: b.billNodeId, cislo: b.cislo, censusSkipped: skippedCislo.has(b.cislo) })),
      currentAmendsEdgeCount: currentAmendsEdges.length,
      regeneratedAmendsEdgeCount: regenEdges.length,
      edgeCountDelta: regenEdges.length - currentAmendsEdges.length,
      totalCitationsConsidered: perBillLog.reduce((a, b) => a + b.citationCount, 0),
      totalResolvedCitations: perBillLog.reduce((a, b) => a + b.resolvedCount, 0),
      totalUnresolvedCitations,
      distinctMissingLawStatutes: missingLawCensus.length,
      excludedNonActRefCount: excludedNonActRefs.length,
      titleRoleGateExclusionCount: titleRoleGateExclusions.length,
    },
    caveats: {
      precisionMeasurement:
        "measure-precision-008.ts is the full-population precision check for THIS regenerated " +
        "set — see docs/data-analysis/case-law/payloads/batch-008-precision-measurement.json. " +
        "Its own caveats note the proxy CANNOT distinguish a real amendment from a repeal clause " +
        "(both satisfy its amending-verb regex) — that class is excluded upstream instead, " +
        "structurally, by amends-census.ts's block-level heading gates, before an edge ever " +
        "reaches this measurement.",
      auditStatus:
        "This payload carries batch-007's own two-independent-Opus-pass history (READY WITH " +
        "CAVEATS, then a reflection pass) UNCHANGED at the census/regen core, plus two targeted " +
        "batch-008 fixes from a THIRD, narrowly-scoped Opus audit (batch-007-round2-audit.md): " +
        "F1 (a Čl. block's forward heading-window scan clipped at an intervening ČÁST boundary — " +
        "recovers tisk 215->280/2009, corpus-verified single-bill blast radius) and F2 (a " +
        "per-citation title-role gate removing 5 false title_fallback edges the audit named — " +
        "tisk 153/88/124/36/42 — corpus-verified against all 141 bills' title preambles to change " +
        "exactly those 5 and neither of the 2 genuine title-only rescues, tisk 107/243). Per the " +
        "audit's own verdict (APPLY), the round-2 delta this batch fixes was independently " +
        "cleared; this batch's OWN F1/F2 fixes are new work and have NOT yet been independently " +
        "audited by a fresh agent — that audit is part of this batch's own deliverables, see " +
        "handoff.md.",
    },
    excludedNonActRefs,
    titleRoleGateExclusions,
    missingLawNodeCensus: missingLawCensus,
    churnRanking: {
      beforeTop10,
      afterTop10,
      rankShift,
    },
    perBillLog,
    edges: regenEdges,
  };

  mkdirSync(path.dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(out, null, 1), "utf8");

  // ---- Impact analysis sidecar (human-readable) ----
  const md = buildImpactMd(out);
  writeFileSync(IMPACT_OUT, md, "utf8");

  console.log(`Bills: ${bills.length} total (${censusFullCount} census_full, ${titleFallbackCount} title_fallback, ${noDataBills.length} no_data)`);
  console.log(`Edges: current ${currentAmendsEdges.length} -> regenerated ${regenEdges.length} (Δ${regenEdges.length - currentAmendsEdges.length >= 0 ? "+" : ""}${regenEdges.length - currentAmendsEdges.length})`);
  console.log(`Missing law nodes: ${missingLawCensus.length} distinct statutes, ${totalUnresolvedCitations} bill-citations affected`);
  console.log(`Wrote ${OUT}`);
  console.log(`Wrote ${IMPACT_OUT}`);
  await store.close();
}

function buildImpactMd(out: {
  stats: Record<string, unknown>;
  churnRanking: {
    beforeTop10: { rank: number; ref: string; count: number }[];
    afterTop10: { rank: number; ref: string; count: number }[];
    rankShift: { rank: number; ref: string; count: number; beforeRank: number | null; beforeCount: number; delta: number }[];
  };
  missingLawNodeCensus: { statute: string; citingBillCount: number; sampleBillCislo: number[] }[];
}): string {
  const s = out.stats as {
    billsTotal: number;
    billsUsingCensusFull: number;
    billsUsingTitleFallback: number;
    billsWithNoData: number;
    currentAmendsEdgeCount: number;
    regeneratedAmendsEdgeCount: number;
    edgeCountDelta: number;
    distinctMissingLawStatutes: number;
    totalUnresolvedCitations: number;
  };
  const lines: string[] = [];
  lines.push("# batch-008 — amends edge regeneration (post-N1/N2 census fix): impact analysis (prepare only)");
  lines.push("");
  lines.push(
    `Edge count: **${s.currentAmendsEdgeCount} (current) → ${s.regeneratedAmendsEdgeCount} (regenerated)**, Δ${s.edgeCountDelta >= 0 ? "+" : ""}${s.edgeCountDelta}. ` +
      `${s.billsUsingCensusFull} bills use the census \`amended_laws_full\` list, ${s.billsUsingTitleFallback} fall back to the title-derived \`amended_laws\` prop, ${s.billsWithNoData} have neither (logged, not dropped).`,
  );
  lines.push(
    `Missing law nodes: **${s.distinctMissingLawStatutes} distinct statutes** cited with no corresponding \`law\` node in the graph, affecting **${s.totalUnresolvedCitations} bill-citations** — proposed follow-up census, not built this batch.`,
  );
  lines.push("");
  lines.push("## Churn re-ranking — top 10 most-amended statutes, before vs after");
  lines.push("");
  lines.push("| rank (after) | statute | after count | before rank | before count | Δ |");
  lines.push("|---|---|---|---|---|---|");
  for (const r of out.churnRanking.rankShift) {
    lines.push(`| ${r.rank} | ${r.ref} | ${r.count} | ${r.beforeRank ?? "—"} | ${r.beforeCount} | ${r.delta >= 0 ? "+" : ""}${r.delta} |`);
  }
  lines.push("");
  lines.push("### Before top 10 (current 150-edge graph), for reference");
  lines.push("");
  lines.push("| rank | statute | count |");
  lines.push("|---|---|---|");
  for (const r of out.churnRanking.beforeTop10) lines.push(`| ${r.rank} | ${r.ref} | ${r.count} |`);
  lines.push("");
  lines.push("## Top missing-law-node statutes (no graph node — cannot become an edge)");
  lines.push("");
  lines.push("| statute | citing bills | sample cislo |");
  lines.push("|---|---|---|");
  for (const m of out.missingLawNodeCensus.slice(0, 15)) lines.push(`| ${m.statute} | ${m.citingBillCount} | ${m.sampleBillCislo.join(", ")} |`);
  lines.push("");
  return lines.join("\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
