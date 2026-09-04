// Shared shapes for LawWatch (/zakony) — what getLawData.ts derives from the
// knowledge graph and the case-③ payload artifacts. Plain module (no server
// imports) so both the server loader and the "use client" surfaces can import
// these; mirrors features/votetrack/themeTypes.ts.

import type { ForensicIndexView } from "./forensicIndex";
import type { SectorAttributionFlag } from "./sectorAttribution";
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
  /**
   * Jak sněmovna a jednotlivé kluby o tomhle tisku hlasovaly — hrany `decides`
   * (hlasování → tisk) spojené s ODVOZENÝM záznamem, ne s druhým přepočtem.
   *
   * Prázdné pole je poctivý stav, ne chyba: hran `decides` je v grafu tolik,
   * kolik jich zapsal `kg-vote-bill-ingest.ts`, a hlasování, jehož bod pořadu
   * nenese tisk, se sem NIKDY nedostane odhadem z názvu (1 602 z 2 075 platných
   * hlasování PSP10 takových je, z toho 828 procedurálních). Plocha to jmenuje.
   */
  rollCalls: BillRollCall[];
}

/** Jedno jmenovité hlasování o tisku. Čísla jsou z `getFullVoteRecord().voteIndex`,
 *  tedy z JEDNÉ derivace, kterou kreslí i /hlasovani — nikdy z druhého foldu hlasů. */
export interface BillRollCall {
  votePspId: number;
  title: string;
  votedOn: string | null;
  sessionNo: number | null;
  voteNo: number | null;
  outcome: string;
  sourceUrl: string;
  /**
   * Které čtení to bylo. `null` U VŠECH: žádný sloupec dumpu čtení neoznačuje a
   * writer ho neodhaduje z názvu. Pole existuje, aby ho mohl vyplnit pozdější
   * průchod — do té doby se nevykresluje.
   */
  readingStage: string | null;
  /** Kolik tisků nesl TENTÝŽ bod pořadu. > 1 znamená, že hlasování patří bloku
   *  (v PSP10 vždy „písemné interpelace"), a plocha to musí říct místo aby
   *  předstírala, že se hlasovalo o tomhle jednom tisku. */
  itemPrintCount: number;
  /** Celosněmovní součet, nebo `null`, když k hlasování nedržíme hlasy. */
  chamber: { yes: number; no: number; k: number; away: number } | null;
  /** Linie klubu v TOMHLE hlasování (klub bez linie tu není). */
  clubLines: Record<string, "yes" | "no">;
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

export interface BillDossier {
  bill: LawBillView;
  prevCislo: number | null; // cyclic file-nav, ordered by print number (cislo)
  nextCislo: number | null;
}
