// Server-only: the LawWatch (/zakony) real-graph loader. Mirrors
// features/votetrack/getVoteThemes.ts. Reads the materialized Case-③ legislation
// layer straight from the knowledge graph:
//   bill:tisk:<id>   nodes  (title, origin, submitter, amended_laws, sponsors,
//                            sponsor money/conflict flags, and — for the few bills
//                            that carry a gated forensic verdict — forensic_* props)
//   law:sb:<n>-<rok> nodes  (ref, esbirka_title)
//   amends edges            bill → law  (which print changes which statute)
// Sponsor osoba ids are resolved to names via listPersons.
//
// Degrades to null (→ the real sections are hidden, the page still renders) if no
// store is configured, no bill nodes have been materialized, or PGlite is
// unavailable. The `server-only` import makes any client-component import a
// build-time error (only `import type` is safe there).

import "server-only";
import { cache } from "react";
import { asUnion } from "@/lib/db/narrow";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { czechCopyOrNull } from "@/lib/analysis/language-gate";
import { lawJargonIssues } from "@/lib/analysis/law-verdict";
import { reportLoaderFailure } from "@/lib/db/loaderGuard";
import { KG_READ_CAP } from "@/lib/db/readCap";
// ONE staleness bound over the graph, not a second one: /dashboard already declares how
// long a memoized graph read may live (and prints it), and this memo caches the same graph
// for the same reason.
import { MONEY_MEMO_TTL_MS } from "@/features/dashboard/freshness";
import { storeReady } from "@/lib/db/readiness";
import { getStore } from "@/lib/db/store";
import { deriveForensicIndex, type ForensicIndexView } from "./forensicIndex";
import {
  buildCompanyIcoResolver,
  buildSectorAttributionIndex,
  type SectorAttributionFlag,
  type SectorAttributionRaw,
} from "./sectorAttribution";
export type { SectorAttributionFlag } from "./sectorAttribution";

/** A real §-level fragment change between two ENACTED e-Sbírka versions of a statute.
 * `before`/`after` are the verbatim `text-fragmentu` values actually fetched from the
 * e-Sbírka SPARQL endpoint for that exact version+fragment — NEVER synthesized. See
 * `scripts/case-loops/law/esbirka-sparql-diff.ts` (the producer) and
 * `docs/data-analysis/case-law/payloads/diffs/*.json` (the artifacts). */
export interface ParagraphDiffHunk {
  fragment: string; // e.g. "§ 35ba odst. 1 písm. b)"
  op: "modified" | "added" | "removed";
  before: string | null; // null only when op === "added"
  after: string | null; // null only when op === "removed"
}
export interface ParagraphDiff {
  law: string; // "586/1992"
  source: string;
  fetchedAt: string;
  from: { date: string; effectiveFrom: string | null; effectiveTo: string | null; eli: string };
  to: { date: string; effectiveFrom: string | null; effectiveTo: string | null; eli: string };
  parScope: string;
  hunks: ParagraphDiffHunk[];
}

/** The artifact stores the verbatim e-Sbírka `text-fragmentu` value (incl. internal <a>/<var>
 * cross-ref markup) as the anti-fabrication source-of-truth. Strip markup only for display —
 * the substance is unchanged, this is presentation, not synthesis. */
function stripHtml(s: string | null): string | null {
  if (s == null) return null;
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const DIFFS_DIR = "docs/data-analysis/case-law/payloads/diffs";
function loadParagraphDiffs(): ParagraphDiff[] {
  try {
    if (!existsSync(DIFFS_DIR)) return [];
    return readdirSync(DIFFS_DIR)
      .filter((f) => f.endsWith(".json"))
      .flatMap((f) => {
        try {
          const raw = JSON.parse(readFileSync(join(DIFFS_DIR, f), "utf8")) as Partial<ParagraphDiff>;
          if (!raw.law || !Array.isArray(raw.hunks) || raw.hunks.length === 0) return [];
          const hunks = raw.hunks.map((h) => ({ ...h, before: stripHtml(h.before ?? null), after: stripHtml(h.after ?? null) }));
          return [{ ...raw, hunks } as ParagraphDiff];
        } catch (err) {
          reportLoaderFailure("getLawData.paragraphDiffs", err);
          return []; // a malformed artifact file must not break the page — skip, don't fabricate
        }
      });
  } catch (err) {
    reportLoaderFailure("getLawData.diffArtifacts", err);
    return [];
  }
}

/** The deterministic "co to mění" one-liner derived from the print's own cached text.
 * Produced by `scripts/case-loops/law/build-bill-summaries.ts` — never written by a model,
 * never inferred: a print whose cached text yields no ČÁST captions, no „kterým se mění …"
 * preamble, no repeal clause and no new-act head simply has NO summary and says so. */
const SUMMARIES_FILE = "docs/data-analysis/case-law/payloads/bill-summaries-cz.json";
interface BillSummaryArtifact {
  rows?: { cislo: number; summary: string | null; source: string | null; method: string | null }[];
}
function loadBillSummaries(): Map<number, { summary: string; source: string | null }> {
  const out = new Map<number, { summary: string; source: string | null }>();
  try {
    if (!existsSync(SUMMARIES_FILE)) return out;
    const raw = JSON.parse(readFileSync(SUMMARIES_FILE, "utf8")) as BillSummaryArtifact;
    for (const r of raw.rows ?? []) {
      // The same Czech gate the verdicts run — a derived summary is reader-facing copy too.
      const safe = czechCopyOrNull(r.summary);
      if (typeof r.cislo === "number" && safe) out.set(r.cislo, { summary: safe, source: r.source });
    }
  } catch (err) {
    reportLoaderFailure("getLawData.billSummaries", err);
  }
  return out;
}

/** batch-017 §-level sector-attribution ledger (bill × company × statute), 29 DERIVED,
 * UNGATED flags, joined to the amended-§ census — see features/lawwatch/sectorAttribution.ts
 * for the projection rule. Same read-or-empty pattern as `loadBillSummaries` above: a missing
 * or malformed file degrades to an empty index, never a page-level failure. */
const SECTOR_ATTRIBUTION_FILE = "docs/data-analysis/case-law/payloads/batch-017-sector-attribution-para.json";
interface SectorAttributionArtifact {
  rows?: SectorAttributionRaw[];
}
function loadSectorAttributionRows(): SectorAttributionRaw[] {
  try {
    if (!existsSync(SECTOR_ATTRIBUTION_FILE)) {
      reportLoaderFailure("getLawData.sectorAttribution", new Error(`missing payload: ${SECTOR_ATTRIBUTION_FILE}`));
      return [];
    }
    const raw = JSON.parse(readFileSync(SECTOR_ATTRIBUTION_FILE, "utf8")) as SectorAttributionArtifact;
    if (!Array.isArray(raw.rows)) {
      reportLoaderFailure("getLawData.sectorAttribution", new Error(`payload carries no rows array: ${SECTOR_ATTRIBUTION_FILE}`));
      return [];
    }
    return raw.rows;
  } catch (err) {
    reportLoaderFailure("getLawData.sectorAttribution", err);
    return [];
  }
}

export const BILL_ORIGINS = ["government", "mp", "mp_group", "senate", "other"] as const;
export type BillOrigin = (typeof BILL_ORIGINS)[number];

/** A gated law-forensics verdict (method:"verdict", written pending_review). Rendered as DERIVED, never as raw fact.
 *
 * Every prose field is `string | null`: null means the graph's text did not pass the
 * Czech-language gate (`lib/analysis/language-gate.ts`) and is WITHHELD rather than shown
 * to a Czech reader in English. Withholding is non-destructive — the text stays in the
 * graph for the rewrite pass, it simply does not ship. `withheldFields` counts them so the
 * surface can say so honestly instead of silently rendering a shorter block. */
export interface LawForensicView {
  severity: "low" | "medium" | "high" | string;
  confidence: number | null;
  reviewState: string; // "pending_review"
  statedReasoning: string | null;
  researchedContext: string | null;
  conflictAssessment: string | null;
  unstatedEffects: { effect: string | null; whoBenefits: string | null; evidence: string }[];
  citations: { claim: string | null; kind: string; source: string }[];
  pass: number | null;
  /** `forensic_provenance.ref` — WHICH computation wrote this verdict ("law-forensics").
   * Read for the same reason `CONTRIBUTION_FORMULA_REF` is read on the score side: a
   * citation of the corpus has to be able to name its own author, and a number that
   * matches under two different computations is a coincidence, not a confirmation.
   * The pass alone cannot say it — any unrelated enrichment advances a pass. */
  provenanceRef: string | null;
  /** `forensic_provenance.computedAt` — the ISO instant the verdict was written. The
   * claim carries the DAY of it; the graph carries no other date for this layer. */
  computedAt: string | null;
  /** How many reader-facing strings this verdict had withheld for not being Czech. */
  withheldFields: number;
}

export interface AmendedLawRef {
  urn: string; // law:sb:586-1992
  ref: string; // "586/1992"
  label: string; // node label ("zákon č. 586/1992 Sb. — …")
  title: string | null; // esbirka_title, when the statute is in the e-Sbírka registry
}

/** Formal per-bill committee routing (assigned_to edge, F15 — psp.cz hist_vybory ⋈ hist). */
export interface CommitteeRoutingView {
  organUrn: string; // psp:organ:<id>
  organLabel: string; // výbor name (node label)
  role: "garancni" | "dalsi" | string; // garanční (věcně příslušný) vs a further committee
  status: "prikazano" | "navrzeno" | "iniciativne" | string; // strongest routing state reached
  assignedOn: string | null; // YYYY-MM-DD from the linked hist step
}

export interface LawBillView {
  tiskId: number;
  cislo: number | null; // public print number → psp.cz URL
  title: string; // official návrh title (node label)
  /** One plain Czech line: what this print actually changes. null ⇒ „shrnutí zatím není" —
   * the print's own text yielded no honest structure to derive one from, and nothing is invented. */
  summary: string | null;
  /** The cached artifact the summary was derived from, for the SourceNote. */
  summarySource: string | null;
  origin: BillOrigin;
  submitter: string | null; // ministry / MP names free text
  /** Resolved MP sponsors (/poslanec/<pspId>), ordered by signature rank (pass 34):
   * rank 1 = předkladatel (the responsible first signatory), else spolupodepsal.
   * role/rank are null for edges predating the roles backfill — rendered without a tag. */
  sponsors: { pspId: number; name: string; role: "predkladatel" | "spolupodepsal" | null; rank: number | null; joinedLater: boolean }[];
  /** Zpravodajové (rapporteur edges, pass 34) — the assigned analytical role on this
   * print, from psp.cz hist (plenary) + hist_vybory/tisky_za (committee side). */
  rapporteurs: { pspId: number; name: string; scopes: string[] }[];
  /** Who actually spoke to this print on the floor (spoke_on edges, pass 35) —
   * substantive turns only (chair excluded), desc by turn count. */
  speakers: { pspId: number; name: string; turns: number }[];
  /** Written-amendment authors (proposes_amendment edges, pass 35 — sd_dokument
   * typ 13, attributed via id_x), desc by amendment count. */
  amendmentAuthors: { pspId: number; name: string; count: number }[];
  /** Current procedural state (Czech typ_stavu name from psp.cz stavy/typ_stavu). */
  stav: string | null;
  /** "583/2025" + date when the print was published in the Sbírka (hist zaver step). */
  fateSb: string | null;
  fatePublishedOn: string | null;
  /** Lowest contribution score among MP sponsors (Case ② index) — effort context. */
  sponsorMinContribution: number | null;
  amendedLaws: AmendedLawRef[]; // statutes this print changes
  committees: CommitteeRoutingView[]; // formal committee routing (garanční first) — F15, may be empty
  flaggedConflict: boolean; // a sponsor has real money ties over the threshold
  sponsorContractCzk: number; // worst-case sponsor's flagged public-contract flow
  sponsorMoneyCompanies: number;
  forensic: LawForensicView | null;
  paragraphDiffs: ParagraphDiff[]; // real e-Sbírka §-diffs on any statute this bill amends (may be empty)
  /** Census cross-check (pass 20, batch-003, 53 bills): the FULL list of statute refs this
   * print actually novelizes, hand-derived from the print's body text — NOT the title-only
   * citation the `amends` edges are built from. Empty when this bill has no census record
   * (the other 88 bills only carry the title-derived `amendedLaws` above). Never silently
   * merged into `amendedLaws` — the two are honestly different provenance (C6/C8). */
  amendedLawsFull: string[];
  /** amendedLawsFull.length − (refs also present in amendedLaws), i.e. how many body-amended
   * statutes the title-only `amends` edges missed for this bill. 0 when no census record. */
  amendsUndercount: number;
  /** batch-017 §-level sector-attribution flags for this print (company ↔ sponsor ↔ statute),
   * each a DERIVED, UNGATED lead already carrying a published verdict's disposition. Empty for
   * the 133 prints the payload does not cover — see features/lawwatch/sectorAttribution.ts. */
  sectorAttributionFlags: SectorAttributionFlag[];
}

export interface TopLawView {
  urn: string;
  ref: string;
  label: string;
  title: string | null;
  billCount: number; // how many prints amend it
}

export interface LawData {
  bills: LawBillView[]; // amends-carrying prints first, then by print number
  topLaws: TopLawView[]; // most-amended statutes, desc
  originCounts: Record<string, number>;
  totalBills: number;
  totalLaws: number;
  totalAmends: number;
  flaggedCount: number;
  forensicCount: number;
  /** The forensic corpus as an INDEX — census completion, the severity distribution and the
   * per-bill entries, aggregated from the same `bills` array above (features/lawwatch/
   * forensicIndex.ts). Pure derivation, zero extra reads: it exists so /zakony can publish
   * the corpus as a browsable whole instead of one verdict per page view. */
  forensicIndex: ForensicIndexView;
  /** Bills carrying a derived "co to mění" summary (the rest honestly say „shrnutí zatím není"). */
  summaryCount: number;
  /** Verdicts with ≥1 reader-facing string withheld by the Czech-language gate. */
  forensicWithheldCount: number;
  paragraphDiffCount: number; // bills carrying ≥1 real e-Sbírka §-diff artifact
  committeeRoutedBills: number; // bills carrying ≥1 formal committee assignment (F15)
  censusBillCount: number; // bills carrying a pass-20 census record (amended_laws_full)
  censusUndercountTotal: number; // sum of amendsUndercount over census-carrying bills
  sectorAttributionBillCount: number; // bills carrying ≥1 batch-017 sector-attribution flag
  sectorAttributionFlagCount: number; // total flags rendered across all bills (post-gate)
  pass: number | null;
}

function asStr(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}
function asNum(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function readForensic(p: Record<string, unknown>): LawForensicView | null {
  const state = asStr(p.forensic_review_state);
  const severity = asStr(p.forensic_severity);
  if (!state && !severity) return null;
  const prov = (p.forensic_provenance ?? {}) as Record<string, unknown>;

  // Every reader-facing string passes the Czech gate AND the pipeline-jargon gate before it
  // can ship (batch-014 M8 — the persist-time rule alone left render unguarded for content
  // written before the rule existed). `cz()` counts the withholds so the block can disclose
  // them instead of quietly shrinking.
  let withheldFields = 0;
  const cz = (v: unknown): string | null => {
    const s = asStr(v);
    if (s === null) return null;
    const safe = czechCopyOrNull(s);
    if (safe === null || lawJargonIssues(safe).length > 0) {
      withheldFields++;
      return null;
    }
    return safe;
  };

  const effects = Array.isArray(p.forensic_unstated_effects)
    ? (p.forensic_unstated_effects as unknown[]).flatMap((u) => {
        if (typeof u !== "object" || u === null) return [];
        const o = u as Record<string, unknown>;
        return [{
          effect: cz(o.effect),
          whoBenefits: cz(o.whoBenefits),
          // evidence goes through the same gate (batch-014 N2 — it bypassed cz(), so the
          // cache-path jargon rule written FOR this field never ran at render time).
          evidence: cz(o.evidence) ?? "",
        }];
      })
    : [];
  const citations = Array.isArray(p.forensic_citations)
    ? (p.forensic_citations as unknown[]).flatMap((c) => {
        if (typeof c !== "object" || c === null) return [];
        const o = c as Record<string, unknown>;
        return [{
          claim: cz(o.claim),
          kind: asStr(o.kind) ?? "",
          source: asStr(o.source) ?? "",
        }];
      })
    : [];
  return {
    severity: severity ?? "low",
    confidence: typeof p.forensic_confidence === "number" ? p.forensic_confidence : null,
    reviewState: state ?? "pending_review",
    statedReasoning: cz(p.forensic_stated_reasoning),
    researchedContext: cz(p.forensic_researched_context),
    conflictAssessment: cz(p.forensic_conflict_assessment),
    unstatedEffects: effects,
    citations,
    pass: typeof prov.pass === "number" ? prov.pass : null,
    provenanceRef: asStr(prov.ref),
    computedAt: asStr(prov.computedAt),
    withheldFields,
  };
}

/**
 * Cross-request memo for the whole legislation read.
 *
 * `react.cache()` (below) is scoped to ONE request, and this is not per-request work: it
 * is eight whole-relation reads plus ~19 payload-file parses over an artifact that changes
 * only when `npm run da:kg-compute` writes. /zakony, /zakony/[cislo] (twice — the page and
 * `generateMetadata`), /zakony/predpis, /zakony/kolize (through `getRadarData`), /dashboard
 * and /denik all await it.
 *
 * The bound is the money layer's — `MONEY_MEMO_TTL_MS`, imported, never re-declared: two
 * memos over one graph on two clocks is how two surfaces print two vintages of one number.
 *
 * WHAT IS DELIBERATELY OUTSIDE THE MEMO: `getStore()` and the readiness gate. They run on
 * EVERY call, so the decision "is this graph publishable" is never a day old — a store that
 * falls below the cardinality floor must start degrading on the next request, not after the
 * window. Only the successful, non-empty BUILD is memoized (an empty corpus is never frozen
 * into „0 tisků", and a failure is never memoized at all).
 */
let lawMemo: { at: number; data: LawData } | null = null;

/** Test/measurement seam: drop the cross-request memo (`resetLeaderboardMemo` precedent).
 *  Never called by the app. */
export function resetLawDataMemo(): void {
  lawMemo = null;
}

/** Wrapped in React's cache() below — generateMetadata and the page component
 * both call getLawData() for the same request, and without deduping, PGlite's
 * documented single-connection contention makes the SECOND call more likely
 * to lose the race and return null, rendering "data unavailable" for a print
 * that genuinely exists. cache() makes both call sites share one promise. */
async function loadLawData(): Promise<LawData | null> {
  try {
    const store = await getStore();
    if (!store) return null;
    if (!(await storeReady(store, ["bill", "law"]))) return null;

    const now = Date.now();
    if (lawMemo && now - lawMemo.at < MONEY_MEMO_TTL_MS) return lawMemo.data;

    // Every read uses the ONE shared cap (lib/db/readCap.ts). The ad-hoc `100_000` this
    // replaced was not merely inconsistent: a limit below the corpus truncates SILENTLY on
    // an ORDERED read, which is how money batch 012 lost every late-sorting company's
    // contracts. One constant means the next ingest that outgrows it trips one guard
    // (`warnIfTruncated`) in one place.
    const billNodes = await store.listKgNodes({ kind: "bill", limit: KG_READ_CAP });
    if (billNodes.length === 0) return null;
    // Eight independent reads that used to run strictly one after another, each awaiting a
    // predecessor it does not use. PGlite is single-connection, so this is not parallelism
    // in the engine — it is one queue instead of eight round-trips of caller latency.
    const [lawNodes, organNodes, amends, assignedTo, rapporteurEdges, spokeOnEdges, amendmentEdges, persons] =
      await Promise.all([
        store.listKgNodes({ kind: "law", limit: KG_READ_CAP }),
        store.listKgNodes({ kind: "organ", limit: KG_READ_CAP }),
        store.listKgEdges({ rel: "amends", limit: KG_READ_CAP }),
        store.listKgEdges({ rel: "assigned_to", limit: KG_READ_CAP }),
        store.listKgEdges({ rel: "rapporteur", limit: KG_READ_CAP }),
        store.listKgEdges({ rel: "spoke_on", limit: KG_READ_CAP }),
        store.listKgEdges({ rel: "proposes_amendment", limit: KG_READ_CAP }),
        store.listPersons(),
      ]);
    const nameById = new Map(persons.map((p) => [p.pspId, p.nameFull]));

    // bill → zpravodajové (pass 34): person urn on the src side, scopes in props.
    const rapporteursByBill = new Map<string, { pspId: number; name: string; scopes: string[] }[]>();
    for (const e of rapporteurEdges) {
      const pspId = Number(/^psp:person:(\d+)$/.exec(e.src)?.[1] ?? NaN);
      if (!Number.isFinite(pspId)) continue;
      const p = (e.props ?? {}) as Record<string, unknown>;
      const scopes = Array.isArray(p.scopes) ? p.scopes.filter((s): s is string => typeof s === "string") : [];
      const arr = rapporteursByBill.get(e.dst) ?? [];
      arr.push({ pspId, name: nameById.get(pspId) ?? `#${pspId}`, scopes });
      rapporteursByBill.set(e.dst, arr);
    }
    for (const arr of rapporteursByBill.values()) arr.sort((a, b) => a.name.localeCompare(b.name, "cs"));

    // bill → floor speakers (weight = substantive turns) and amendment authors (pass 35).
    const speakersByBill = new Map<string, { pspId: number; name: string; turns: number }[]>();
    for (const e of spokeOnEdges) {
      const pspId = Number(/^psp:person:(\d+)$/.exec(e.src)?.[1] ?? NaN);
      if (!Number.isFinite(pspId) || typeof e.weight !== "number") continue;
      const arr = speakersByBill.get(e.dst) ?? [];
      arr.push({ pspId, name: nameById.get(pspId) ?? `#${pspId}`, turns: e.weight });
      speakersByBill.set(e.dst, arr);
    }
    for (const arr of speakersByBill.values()) arr.sort((a, b) => b.turns - a.turns || a.name.localeCompare(b.name, "cs"));
    const amendmentAuthorsByBill = new Map<string, { pspId: number; name: string; count: number }[]>();
    for (const e of amendmentEdges) {
      const pspId = Number(/^psp:person:(\d+)$/.exec(e.src)?.[1] ?? NaN);
      if (!Number.isFinite(pspId) || typeof e.weight !== "number") continue;
      const arr = amendmentAuthorsByBill.get(e.dst) ?? [];
      arr.push({ pspId, name: nameById.get(pspId) ?? `#${pspId}`, count: e.weight });
      amendmentAuthorsByBill.set(e.dst, arr);
    }
    for (const arr of amendmentAuthorsByBill.values()) arr.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "cs"));

    const paragraphDiffs = loadParagraphDiffs();
    const summaries = loadBillSummaries();
    // The company read exists ONLY to give a sector-attribution flag its firm's money case
    // file, so it is skipped entirely when the payload carries no rows — an indexed
    // kind-scoped node read (~196 rows on the live corpus), never a relation scan.
    const sectorAttributionRows = loadSectorAttributionRows();
    const companyNodes =
      sectorAttributionRows.length > 0 ? await store.listKgNodes({ kind: "company", limit: KG_READ_CAP }) : [];
    const sectorAttributionIndex = buildSectorAttributionIndex(
      sectorAttributionRows,
      buildCompanyIcoResolver(companyNodes),
    );
    const diffsByLawRef = new Map<string, ParagraphDiff[]>();
    for (const d of paragraphDiffs) diffsByLawRef.set(d.law, [...(diffsByLawRef.get(d.law) ?? []), d]);

    const lawByUrn = new Map(lawNodes.map((n) => [n.id, n]));
    const organLabelByUrn = new Map(organNodes.map((n) => [n.id, n.label]));

    // bill → formal committee routing (garanční first, then další), from the assigned_to edges.
    const ROLE_RANK: Record<string, number> = { garancni: 0, dalsi: 1 };
    const committeesByBill = new Map<string, CommitteeRoutingView[]>();
    for (const e of assignedTo) {
      const p = (e.props ?? {}) as Record<string, unknown>;
      const arr = committeesByBill.get(e.src) ?? [];
      arr.push({
        organUrn: e.dst,
        organLabel: organLabelByUrn.get(e.dst) ?? e.dst,
        role: asStr(p.role) ?? "dalsi",
        // NE `?? "navrzeno"`: chybějící prop by se vykreslil jako faktické tvrzení
        // o legislativním kroku, který zdroj neuvádí. Táž vada, jakou 6a30205
        // odstranil na straně PARSERU (`STATUS_BY_TYP[…] ?? "navrzeno"`) — tady
        // seděla i na straně ČTENÍ, takže hranu zapsanou starším průchodem bez
        // `status` by /zakony pořád tvrdilo jako „navrženo".
        status: asStr(p.status) ?? "unknown",
        assignedOn: asStr(p.assignedOn),
      });
      committeesByBill.set(e.src, arr);
    }
    for (const arr of committeesByBill.values())
      arr.sort((a, b) => (ROLE_RANK[a.role] ?? 9) - (ROLE_RANK[b.role] ?? 9) || a.organLabel.localeCompare(b.organLabel));

    // bill → the law urns it amends (from the edge table, the authoritative link)
    const lawsByBill = new Map<string, string[]>();
    const billCountByLaw = new Map<string, number>();
    for (const e of amends) {
      const arr = lawsByBill.get(e.src) ?? [];
      arr.push(e.dst);
      lawsByBill.set(e.src, arr);
      billCountByLaw.set(e.dst, (billCountByLaw.get(e.dst) ?? 0) + 1);
    }

    const lawRefOf = (urn: string): AmendedLawRef => {
      const n = lawByUrn.get(urn);
      const props = (n?.props ?? {}) as Record<string, unknown>;
      return {
        urn,
        ref: asStr(props.ref) ?? urn.replace(/^law:sb:/, "").replace("-", "/"),
        label: n?.label ?? urn,
        title: asStr(props.esbirka_title),
      };
    };

    const originCounts: Record<string, number> = {};
    let flaggedCount = 0;
    let forensicCount = 0;

    const bills: LawBillView[] = billNodes.map((n) => {
      const p = (n.props ?? {}) as Record<string, unknown>;
      const origin = asUnion(p.origin, BILL_ORIGINS, "other");
      originCounts[origin] = (originCounts[origin] ?? 0) + 1;
      const flagged = p.flagged_conflict === true;
      if (flagged) flaggedCount++;
      const forensic = readForensic(p);
      if (forensic) forensicCount++;

      // sponsors_ranked (pass 34) carries the signature order; fall back to the
      // plain unordered list (role null, no rank invented) where it is absent.
      const ranked = Array.isArray(p.sponsors_ranked) ? (p.sponsors_ranked as unknown[]) : [];
      const rankByOsoba = new Map<number, { rank: number; joinedLater: boolean }>();
      for (const r of ranked) {
        if (typeof r !== "object" || r === null) continue;
        const o = r as Record<string, unknown>;
        if (typeof o.osoba === "number" && typeof o.rank === "number") {
          rankByOsoba.set(o.osoba, { rank: o.rank, joinedLater: o.joined_later === true });
        }
      }
      const sponsorIds = Array.isArray(p.sponsors) ? (p.sponsors as unknown[]) : [];
      const sponsors = sponsorIds
        .filter((id): id is number => typeof id === "number")
        .map((pspId) => {
          const rk = rankByOsoba.get(pspId);
          const role: "predkladatel" | "spolupodepsal" | null = rk
            ? rk.rank === 1
              ? "predkladatel"
              : "spolupodepsal"
            : null;
          return { pspId, name: nameById.get(pspId) ?? `#${pspId}`, role, rank: rk?.rank ?? null, joinedLater: rk?.joinedLater ?? false };
        })
        .sort((a, b) => (a.rank ?? 1e9) - (b.rank ?? 1e9));

      const amendedUrns = lawsByBill.get(n.id) ?? [];
      const amendedLaws = amendedUrns.map(lawRefOf);
      const committees = committeesByBill.get(n.id) ?? [];
      const paragraphDiffsForBill = amendedLaws.flatMap((l) => diffsByLawRef.get(l.ref) ?? []);

      const amendedLawsFull = Array.isArray(p.amended_laws_full)
        ? (p.amended_laws_full as unknown[]).filter((r): r is string => typeof r === "string")
        : [];
      const amendsUndercount = typeof p.amends_undercount === "number" ? p.amends_undercount : 0;

      const cislo = typeof p.cislo === "number" ? p.cislo : null;
      const summaryRow = cislo != null ? summaries.get(cislo) : undefined;

      return {
        tiskId: Number(n.id.replace(/^bill:tisk:/, "")) || 0,
        cislo,
        title: n.label,
        summary: summaryRow?.summary ?? null,
        summarySource: summaryRow?.source ?? null,
        origin,
        submitter: asStr(p.submitter),
        sponsors,
        rapporteurs: rapporteursByBill.get(n.id) ?? [],
        speakers: speakersByBill.get(n.id) ?? [],
        amendmentAuthors: amendmentAuthorsByBill.get(n.id) ?? [],
        stav: asStr(p.stav),
        fateSb: asStr(p.fate_sb),
        fatePublishedOn: asStr(p.fate_published_on),
        sponsorMinContribution:
          typeof p.sponsor_min_contribution === "number" && Number.isFinite(p.sponsor_min_contribution)
            ? p.sponsor_min_contribution
            : null,
        amendedLaws,
        committees,
        flaggedConflict: flagged,
        sponsorContractCzk: asNum(p.sponsor_contract_czk),
        sponsorMoneyCompanies: asNum(p.sponsor_money_companies),
        forensic,
        paragraphDiffs: paragraphDiffsForBill,
        amendedLawsFull,
        amendsUndercount,
        sectorAttributionFlags: cislo != null ? (sectorAttributionIndex.get(cislo) ?? []) : [],
      };
    });

    // Sort: prints carrying a real §-diff first (the flagship — actual before/after text),
    // then a forensic verdict, then flagged-conflict prints, then most statutes amended, then
    // print number — so the default-selected bill is the most informative one.
    bills.sort((a, b) => {
      const aDiff = a.paragraphDiffs.length > 0;
      const bDiff = b.paragraphDiffs.length > 0;
      if (bDiff !== aDiff) return bDiff ? 1 : -1;
      if (!!b.forensic !== !!a.forensic) return b.forensic ? 1 : -1;
      if (b.flaggedConflict !== a.flaggedConflict) return b.flaggedConflict ? 1 : -1;
      if (b.amendedLaws.length !== a.amendedLaws.length) return b.amendedLaws.length - a.amendedLaws.length;
      return (a.cislo ?? 1e9) - (b.cislo ?? 1e9);
    });

    const topLaws: TopLawView[] = [...billCountByLaw.entries()]
      .map(([urn, billCount]) => {
        const ref = lawRefOf(urn);
        return { urn, ref: ref.ref, label: ref.label, title: ref.title, billCount };
      })
      .sort((a, b) => b.billCount - a.billCount || a.ref.localeCompare(b.ref));

    const pass = billNodes.reduce<number | null>(
      (mx, n) => (typeof n.firstSeenPass === "number" ? Math.max(mx ?? 0, n.firstSeenPass) : mx),
      null,
    );

    const data: LawData = {
      bills,
      topLaws,
      originCounts,
      totalBills: billNodes.length,
      totalLaws: lawNodes.length,
      totalAmends: amends.length,
      flaggedCount,
      forensicCount,
      forensicIndex: deriveForensicIndex(bills),
      summaryCount: bills.filter((b) => b.summary !== null).length,
      forensicWithheldCount: bills.filter((b) => (b.forensic?.withheldFields ?? 0) > 0).length,
      paragraphDiffCount: bills.filter((b) => b.paragraphDiffs.length > 0).length,
      committeeRoutedBills: new Set(assignedTo.map((e) => e.src)).size,
      censusBillCount: bills.filter((b) => b.amendedLawsFull.length > 0).length,
      censusUndercountTotal: bills.reduce((sum, b) => sum + b.amendsUndercount, 0),
      sectorAttributionBillCount: bills.filter((b) => b.sectorAttributionFlags.length > 0).length,
      sectorAttributionFlagCount: bills.reduce((sum, b) => sum + b.sectorAttributionFlags.length, 0),
      pass,
    };
    // Never memoize an EMPTY corpus: a half-ingested read must not freeze into „0 tisků"
    // for a day. (A failure never gets here at all — it throws into the catch below.)
    if (data.bills.length > 0) lawMemo = { at: now, data };
    return data;
  } catch (err) {
    reportLoaderFailure("getLawData", err);
    return null;
  }
}

export const getLawData = cache(loadLawData);

export interface BillDossier {
  bill: LawBillView;
  prevCislo: number | null; // cyclic file-nav, ordered by print number (cislo)
  nextCislo: number | null;
}

/** Pure lookup over an already-loaded LawData for the /zakony/[cislo] dossier route — no
 * extra store round-trip. Navigation order is print number (`cislo`), not the `LawData.bills`
 * relevance sort (posudek → §-diff → střet), so prev/next reads as "browse the register" rather
 * than jumping around by salience. Bills without a `cislo` (rare) aren't independently routable
 * and are excluded from the nav ring. */
export function findBillByCislo(data: LawData, cislo: number): BillDossier | null {
  const ordered = data.bills.filter((b) => b.cislo != null).sort((a, b) => a.cislo! - b.cislo!);
  const idx = ordered.findIndex((b) => b.cislo === cislo);
  if (idx === -1) return null;
  const n = ordered.length;
  return {
    bill: ordered[idx],
    prevCislo: n > 1 ? ordered[(idx - 1 + n) % n].cislo : null,
    nextCislo: n > 1 ? ordered[(idx + 1) % n].cislo : null,
  };
}
