/* The vote→bill spine — a `decides` edge from the sitting's agenda.
 *
 * The graph had no edge between a roll call and the print it decided, so /zakony
 * drew bills with zero votes, /hlasovani drew votes with zero bills, and /volby
 * could not date a single law finding. The join key sat in the store on both sides
 * the whole time; the only probe ever run read the wrong column (`hist.unl` col 5 —
 * a document id) and the frontier recorded Q-law-2 as "blocked (ingest)" for it.
 *
 * What it writes:
 *   decides edges  vote → bill, props {votedOn, outcome, readingStage|null,
 *                  sessionNo, agendaItem, agendaLabel, itemPrintCount,
 *                  joinBasis: "schuze+bod"}. Nothing else. No node is rebuilt, so
 *                  the `kg-upsert-replaces-props` hazard cannot be triggered from
 *                  here — see memory/kg-upsert-replaces-props.md for why that is
 *                  a deliberate property of this writer and not an accident.
 *
 *   npx tsx scripts/data-analysis/kg-vote-bill-ingest.ts            # dry-run (default)
 *   npx tsx scripts/data-analysis/kg-vote-bill-ingest.ts --commit   # write
 * Flags: --commit  --term=PSP10  --pass=N  --refetch
 *
 * HONESTY CONTRACT. Three things this script will not do:
 *   1. It never guesses a print from a title. A roll call whose agenda item names
 *      no print stays unlinked and is counted (`votesWithoutPrint`).
 *   2. It never resolves an ambiguous agenda item down to one print. An item naming
 *      several prints emits an edge to each, every one of them carrying
 *      `itemPrintCount` so a reader sees the ambiguity it is looking at.
 *   3. It never invents a reading stage. No column in the dumps labels which reading
 *      a roll call belongs to, so `readingStage` is null on 100 % of edges today.
 * Every cap ships its population: the dry run prints the full denominator ledger,
 * and `--commit` refuses to write without printing it first.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { nextPass } from "@/lib/analysis/kg";
import { getStore } from "@/lib/db/store";
import { guardStampedRows, makeProvenance } from "@/lib/kg/provenance";
import type { KgEdgeRow, KgNodeRow, VoteEventRow } from "@/lib/db/types";
import { agendaKey, normalizeAgendaPrints, type AgendaPrintIndex } from "@/lib/ingest/sources/psp-activity";

function argOf(name: string, fallback = ""): string {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

const CACHE_DIR = process.env.PSP_CACHE_DIR || "./.data/psp";
const PSP_BASE = "https://www.psp.cz/eknih/cdrom/opendata";
const UA = "politicas-ingest/0.1 (+https://www.psp.cz/sqw/hp.sqw?k=1300; open-data mirror)";
async function getDump(fileName: string, refetch: boolean): Promise<Uint8Array | null> {
  mkdirSync(CACHE_DIR, { recursive: true });
  const path = join(CACHE_DIR, fileName);
  if (!refetch && existsSync(path)) return new Uint8Array(readFileSync(path));
  try {
    const res = await fetch(`${PSP_BASE}/${fileName}`, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(180_000) });
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    writeFileSync(path, bytes);
    return bytes;
  } catch (e) {
    console.warn(`  [getDump ${fileName}] ${e instanceof Error ? e.message : e}`);
    return null;
  }
}

/** The denominator ledger. Every one of these is printed; none is a residual. */
export interface VoteBillCoverage {
  /** roll calls of the term in the store, voided included. */
  voteEvents: number;
  /** …voided (zmatečné) — excluded from everything, as everywhere else in the repo. */
  voided: number;
  /** …valid: the population every rate below is against. */
  valid: number;
  /** valid roll calls carrying no agenda item at all (`bod = 0`) — procedural
   *  business (pořad schůze, closing debate). Not a coverage failure: no pass can
   *  ever link these, and folding them into the denominator understates the join. */
  votesWithNoAgendaItem: number;
  /** valid roll calls naming an item that the agenda as taken does not carry. */
  votesWithUnresolvedAgendaItem: number;
  /** valid roll calls whose item resolves but names no print. */
  votesOnItemWithoutPrint: number;
  /** the honest cap: every valid roll call that got no edge, for any reason. */
  votesWithoutPrint: number;
  /** valid roll calls that got at least one edge. */
  votesLinked: number;
  /** …of which landed on an item naming more than one print. */
  votesOnMultiPrintItem: number;
  /** agenda items of the term naming more than one print. */
  agendaItemsMultiPrint: number;
  /** edges emitted (≥ votesLinked, because of the many-to-many). */
  edges: number;
  /** distinct prints reached. */
  printsLinked: number;
  /** prints named by an agenda item that are NOT nodes in the graph — budget
   *  documents, reports, interpellations. Skipped, and said out loud. */
  printsOutsideGraph: number;
}

/**
 * Join a term's roll calls to the prints their agenda items carry.
 *
 * Pure: no store, no network. `billNodeIdByTiskId` is the graph's own bill
 * population — a print the graph does not carry gets no edge and is counted.
 */
export function joinVotesToPrints(
  votes: readonly VoteEventRow[],
  agenda: AgendaPrintIndex,
  billNodeIdByTiskId: ReadonlyMap<number, string>,
  provenance: Record<string, unknown>,
): { edges: KgEdgeRow[]; coverage: VoteBillCoverage } {
  const edges: KgEdgeRow[] = [];
  const prints = new Set<number>();
  const outsideGraph = new Set<number>();
  let voided = 0, noItem = 0, unresolved = 0, itemNoPrint = 0, linked = 0, onMulti = 0;

  for (const v of votes) {
    if (v.voided) {
      voided++;
      continue;
    }
    if (v.sessionNo == null || v.agendaItem == null || v.agendaItem < 1) {
      noItem++;
      continue;
    }
    const key = agendaKey(v.sessionNo, v.agendaItem);
    const tiskIds = agenda.printsByItem.get(key);
    if (!tiskIds || tiskIds.length === 0) {
      if (agenda.labelByItem.has(key)) itemNoPrint++;
      else unresolved++;
      continue;
    }
    const resolved = tiskIds.filter((t) => billNodeIdByTiskId.has(t));
    for (const t of tiskIds) if (!billNodeIdByTiskId.has(t)) outsideGraph.add(t);
    if (resolved.length === 0) {
      itemNoPrint++;
      continue;
    }
    linked++;
    if (tiskIds.length > 1) onMulti++;
    for (const t of resolved) {
      prints.add(t);
      edges.push({
        src: `psp:hlasovani:${v.pspId}`,
        rel: "decides",
        dst: billNodeIdByTiskId.get(t)!,
        weight: null,
        props: {
          votedOn: v.votedOn,
          outcome: v.outcome,
          // No dump column labels the reading a roll call belongs to. The prop is
          // declared so a later pass can fill it; it is never inferred from a title.
          readingStage: null,
          sessionNo: v.sessionNo,
          agendaItem: v.agendaItem,
          agendaLabel: agenda.labelByItem.get(key) ?? null,
          // The ambiguity travels ON the edge: a reader of a 17-print interpellation
          // block must be able to see that it was one, without re-deriving it.
          itemPrintCount: tiskIds.length,
          joinBasis: "schuze+bod",
        },
        provenance,
      });
    }
  }

  const valid = votes.length - voided;
  return {
    edges,
    coverage: {
      voteEvents: votes.length,
      voided,
      valid,
      votesWithNoAgendaItem: noItem,
      votesWithUnresolvedAgendaItem: unresolved,
      votesOnItemWithoutPrint: itemNoPrint,
      votesWithoutPrint: valid - linked,
      votesLinked: linked,
      votesOnMultiPrintItem: onMulti,
      agendaItemsMultiPrint: agenda.coverage.agendaItemsMultiPrint,
      edges: edges.length,
      printsLinked: prints.size,
      printsOutsideGraph: outsideGraph.size,
    },
  };
}

/** The ledger, printed whole. A cap without its population is not a measurement. */
export function formatCoverage(c: VoteBillCoverage): string {
  const pct = (n: number, d: number) => (d ? `${((100 * n) / d).toFixed(1).replace(".", ",")} %` : "—");
  const naming = c.valid - c.votesWithNoAgendaItem;
  return [
    `  roll calls in the term ${c.voteEvents} · voided ${c.voided} · VALID ${c.valid}`,
    `    carrying no agenda item at all (procedural, bod = 0) ${c.votesWithNoAgendaItem} (${pct(c.votesWithNoAgendaItem, c.valid)} of valid)`,
    `    naming an agenda item ${naming}`,
    `      item not on the agenda as taken ........ ${c.votesWithUnresolvedAgendaItem}`,
    `      item carries no print in the graph ..... ${c.votesOnItemWithoutPrint}`,
    `      LINKED ................................ ${c.votesLinked} (${pct(c.votesLinked, c.valid)} of valid, ${pct(c.votesLinked, naming)} of those naming an item)`,
    `  votesWithoutPrint ${c.votesWithoutPrint} — the cap, against its full population of ${c.valid}`,
    `  agendaItemsMultiPrint ${c.agendaItemsMultiPrint} · roll calls landing on one ${c.votesOnMultiPrintItem} (each edge carries itemPrintCount; none is resolved away)`,
    `  edges ${c.edges} over ${c.printsLinked} prints · ${c.printsOutsideGraph} prints named by an agenda item are not graph bills (budgets, reports, interpellations) — skipped`,
    `  readingStage: null on all ${c.edges} — no dump column labels the reading, and this writer does not infer one`,
  ].join("\n");
}

async function main() {
  const commit = flag("commit");
  const term = argOf("term", "PSP10");
  const store = await getStore();
  if (!store) {
    console.error("no store configured");
    process.exit(1);
  }
  const organs = await store.listOrgans();
  const termPspId = organs.find((o) => o.abbrev === term)?.pspId ?? null;
  if (termPspId == null) {
    console.error(`term organ for ${term} not found`);
    process.exit(1);
  }

  const schuzeZip = await getDump("schuze.zip", flag("refetch"));
  if (!schuzeZip) {
    console.error("could not fetch schuze.zip");
    process.exit(1);
  }
  const agenda = normalizeAgendaPrints(schuzeZip, termPspId);

  const votes = (await store.listVoteEvents({ termCode: term })).filter((v) => v.termPspId === termPspId);
  const nodes: KgNodeRow[] = await store.listKgNodes();
  const billNodeIdByTiskId = new Map<number, string>();
  for (const n of nodes) {
    if (n.kind !== "bill") continue;
    const tiskId = Number(n.id.replace("bill:tisk:", ""));
    if (Number.isFinite(tiskId)) billNodeIdByTiskId.set(tiskId, n.id);
  }
  const pass = Number(argOf("pass")) || nextPass(nodes);
  // [G5] The structured stamp beside the legacy method/computedAt keys. The
  // `decides` edge is derived from the roll-call agenda join, so its source is
  // the roll-call dump the votes come from — not the tisky dump the bill NODES
  // came from. The edge is the claim "this vote decided that print", and it is
  // the vote half that is being asserted; the bill half is only referenced.
  const provenance = {
    method: "deterministic",
    computedAt: new Date().toISOString(),
    ...makeProvenance({ source: "psp-hlasovani", pass, ref: "psp-vote-bill-agenda", writer: "kg-vote-bill-ingest" }),
  };

  const { edges, coverage } = joinVotesToPrints(votes, agenda, billNodeIdByTiskId, provenance);

  console.log(`Vote→bill spine · term ${term} (organ ${termPspId}) · ${commit ? "COMMIT" : "DRY-RUN"} · pass ${pass}`);
  console.log(`  agenda as taken: ${agenda.coverage.agendaRowsAsTaken} rows / ${agenda.coverage.agendaItems} items (${agenda.coverage.agendaItemsWithPrint} carry a print)`);
  console.log(`  pozvánka rows ignored: ${agenda.coverage.proposedAgendaRowsIgnored} — a DIFFERENT numbering; see the note in psp-activity.ts`);
  console.log(formatCoverage(coverage));

  if (!commit) {
    console.log(`\nDRY-RUN — would write ${edges.length} decides edges (pass ${pass}). Re-run with --commit.`);
    await store.close();
    return;
  }
  guardStampedRows(edges, { allowUnstamped: flag("allow-unstamped"), label: "kg-vote-bill-ingest edges" });
  const written = await store.upsertKgEdges(edges);
  console.log(`\nCOMMITTED: ${written} decides edges written (pass ${pass}). No node was touched.`);
  await store.close();
}

if (process.argv[1]?.includes("kg-vote-bill-ingest")) {
  main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
}
