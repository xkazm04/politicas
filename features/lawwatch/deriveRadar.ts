// Kolizní radar — PURE derivation of the early-warning ledger (moonshot 4B).
//
// The collision view stops being a retrospective artifact and becomes a radar:
// a chronological ledger of drafting-process findings as they ENTERED the
// record — statute-collision candidates from the Case-③ close-read payloads
// (dated by each payload's own `generatedAt`, the moment the finding was
// written into the archive) and Case-① conflict flags on bills (derived
// money-tie flags, which carry NO detection date in the graph and are
// therefore honestly rendered undated, ordered by print number — the rule is
// disclosed on-page and in the feed, never invented).
//
// Framing discipline (batch-4 §17, absolute): every entry is a FINDING OF THE
// DRAFTING PROCESS or a DERIVED FLAG — severity-free, factual, never an
// accusation. Case-① flags additionally carry the "vyžaduje lidské ověření"
// sentence in their own copy, because a computed flag is a candidate, not a
// verified fact (moneyLoader parity rule).
//
// Plain module, no server imports: the server loader (getRadarData.ts), the
// feed route handlers, the client ledger AND the tests all run these same
// functions over the same shapes. Determinism contract mirrors
// features/dukazy/deriveFeed.ts: same input rows in ANY order → byte-identical
// output; ids/anchors are a public API (`#r-<id>`, guid `politicas:radar:<id>`).
//
// MONEY FORMATTING, AND WHY THE LOCALE IS PINNED HERE (2026-08-12): every
// string this module emits is named `*Cs` and is the SINGLE-LOCALE voice of the
// /zakony/kolize RSS + JSON feeds (`<language>cs</language>`), so the sentence
// around the figure is Czech by construction and a locale parameter would only
// let a caller mix a Czech clause with an English amount. The formatter itself
// is NOT forked: it is lib/format.ts's `formatCompactCzk`, the canonical
// `czkCompact` kind, called with "cs". Until this date the module used a
// private copy in lawwatchLabels.ts that rendered "NaN Kč" for a degenerate
// `sponsor_contract_czk` and refused to group a negative one — into a public
// feed. The canonical formatter answers "—" for a non-finite value and
// compacts by magnitude, so a broken stored number reads as missing rather
// than as an amount.

import { formatCompactCzk } from "@/lib/format";

/** One close-read collision pair as the radar consumes it (a slice of
 *  CollisionClusterView/CollisionPairView from getCollisionData). */
export interface RadarCollisionInput {
  pairId: string;
  billA: number;
  billB: number;
  lawRef: string; // "586/1992"
  lawTitle: string | null;
  /** Cluster key from getCollisionData ("586/1992§35ba") — the statute+§ locus. */
  clusterKey: string;
  sharedParagraph: string; // full per-pair label ("35ba odst. 1")
  classification: "confirmed-collision" | "coordination-risk";
  /** ISO timestamp the finding entered the archive (payload `generatedAt`);
   *  null when the payload predates the dated-artifact convention. */
  detectedAt: string | null;
  sourceBatch: number;
}

/** One Case-① flagged bill (bill.props.flagged_conflict === true). */
export interface RadarFlagInput {
  cislo: number;
  title: string;
  sponsorMoneyCompanies: number;
  sponsorContractCzk: number;
}

export type RadarKind = "kolize" | "priznak";

export interface RadarEntry {
  /** Stable public id, e.g. "kolize-586-1992-35ba-120-244" / "priznak-77". */
  id: string;
  /** In-page anchor: `r-<id>` (batch-4 §4B anchor convention). */
  anchor: string;
  kind: RadarKind;
  /** ISO timestamp of record entry; null = honestly undated (Case-① flags). */
  detectedAt: string | null;
  /** Factual headline, severity-free. */
  titleCs: string;
  /** Gated one-sentence body — the only voice the public feed speaks in. */
  detailCs: string;
  /** Provenance line for the SourceNote / feed summary. */
  sourceCs: string;
  /** Feed `authors` name — which case pipeline produced the finding. */
  authorCs: string;
  /** Statute locus (collisions only). */
  lawRef: string | null;
  lawTitle: string | null;
  paragraph: string | null;
  /** Print numbers involved, ascending. */
  bills: number[];
  /** In-page anchor of the cluster card this entry expands into (collisions). */
  clusterAnchor: string | null;
  /** True for derived candidates that still require human verification. */
  requiresVerification: boolean;
}

export const CLASSIFICATION_FACT_CZ: Record<RadarCollisionInput["classification"], string> = {
  "confirmed-collision": "potvrzená kolize textu",
  "coordination-risk": "koordinační riziko",
};

/** "586/1992§35ba" → "k-586-1992-35ba" — a DOM-safe cluster anchor shared by
 *  the ledger rows and the cluster cards below them. */
export function clusterAnchorOf(clusterKey: string): string {
  return `k-${clusterKey.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "")}`;
}

function radarCollisionId(c: RadarCollisionInput): string {
  const [a, b] = [c.billA, c.billB].sort((x, y) => x - y);
  const locus = c.clusterKey.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `kolize-${locus}-${a}-${b}`;
}

function collisionEntry(c: RadarCollisionInput): RadarEntry {
  const id = radarCollisionId(c);
  const bills = [c.billA, c.billB].sort((a, b) => a - b);
  return {
    id,
    anchor: `r-${id}`,
    kind: "kolize",
    detectedAt: c.detectedAt,
    titleCs: `tisk ${bills[0]} × tisk ${bills[1]} — § ${c.sharedParagraph}, zákon č. ${c.lawRef} Sb.`,
    detailCs:
      `Dva souběžně projednávané tisky novelizují § ${c.sharedParagraph} zákona č. ${c.lawRef} Sb. ` +
      `(${CLASSIFICATION_FACT_CZ[c.classification]}). Nález legislativního procesu, ne etický nález.`,
    sourceCs: `zdroj: deterministická §-předkontrola + ruční porovnání textů, dávka ${c.sourceBatch}`,
    authorCs: "case ③ — legislativní forenzika",
    lawRef: c.lawRef,
    lawTitle: c.lawTitle,
    paragraph: c.sharedParagraph,
    bills,
    clusterAnchor: clusterAnchorOf(c.clusterKey),
    requiresVerification: false,
  };
}

function flagEntry(f: RadarFlagInput): RadarEntry {
  const id = `priznak-${f.cislo}`;
  const money =
    f.sponsorMoneyCompanies > 0
      ? `evidované vazby na ${f.sponsorMoneyCompanies} ${f.sponsorMoneyCompanies === 1 ? "firmu" : f.sponsorMoneyCompanies < 5 ? "firmy" : "firem"} s veřejnými zakázkami za ${formatCompactCzk(f.sponsorContractCzk, "cs")}`
      : "evidované majetkové vazby nad prahem";
  return {
    id,
    anchor: `r-${id}`,
    kind: "priznak",
    detectedAt: null,
    titleCs: `tisk ${f.cislo} — příznak střetu u předkladatele`,
    detailCs:
      `U předkladatelů tisku ${f.cislo} („${f.title}“) jsou v grafu ${money}. ` +
      `Odvozený příznak — vyžaduje lidské ověření, nejde o zjištěné pochybení.`,
    sourceCs: "zdroj: kg_node bill.flagged_conflict · registr smluv ⋈ ARES (case ①)",
    authorCs: "case ① — majetkové vazby",
    lawRef: null,
    lawTitle: null,
    paragraph: null,
    bills: [f.cislo],
    clusterAnchor: null,
    requiresVerification: true,
  };
}

export interface RadarInput {
  collisions: readonly RadarCollisionInput[];
  flags: readonly RadarFlagInput[];
}

/**
 * The whole ledger. Deterministic and input-order independent:
 *   1. Dedup — the same (statute+§ locus, bill pair) close-read in several
 *      payloads is ONE finding; the entry keeps the EARLIEST detectedAt (the
 *      moment it first entered the record; an undated occurrence never beats a
 *      dated one) and the strongest classification is irrelevant here because
 *      the dedup winner is picked by date, then batch ascending.
 *   2. Order — dated entries newest-first (id ASC tiebreak), then undated
 *      entries: undated collisions by id ASC, then flags by print number ASC.
 *      The undated rule is DISCLOSED on-page and in the feed, not implied.
 */
export function deriveRadar(input: RadarInput): RadarEntry[] {
  // dedup collisions by public id (locus + bill pair)
  const byId = new Map<string, RadarCollisionInput>();
  for (const c of input.collisions) {
    const id = radarCollisionId(c);
    const prev = byId.get(id);
    if (!prev) {
      byId.set(id, c);
      continue;
    }
    const keep =
      prev.detectedAt === null
        ? c.detectedAt !== null || c.sourceBatch < prev.sourceBatch
        : c.detectedAt !== null && (c.detectedAt < prev.detectedAt || (c.detectedAt === prev.detectedAt && c.sourceBatch < prev.sourceBatch));
    if (keep) byId.set(id, c);
  }
  const collisionInputs = [...byId.values()];

  const flagsDedup = new Map<number, RadarFlagInput>();
  for (const f of input.flags) if (!flagsDedup.has(f.cislo)) flagsDedup.set(f.cislo, f);

  const entries: RadarEntry[] = [
    ...collisionInputs.map(collisionEntry),
    ...[...flagsDedup.values()].map(flagEntry),
  ];

  entries.sort((a, b) => {
    const aDated = a.detectedAt !== null;
    const bDated = b.detectedAt !== null;
    if (aDated !== bDated) return aDated ? -1 : 1;
    if (aDated && bDated && a.detectedAt !== b.detectedAt) return a.detectedAt! < b.detectedAt! ? 1 : -1;
    // undated tier: collisions before flags, flags by print number
    if (a.kind !== b.kind) return a.kind === "kolize" ? -1 : 1;
    if (a.kind === "priznak" && b.kind === "priznak") return a.bills[0] - b.bills[0];
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  return entries;
}

/** One cell of the radar strip: a day on which findings entered the record. */
export interface RadarDay {
  day: string; // "2026-07-24"
  collisions: number;
  flags: number;
  total: number;
}

/** Dated entries grouped by day, newest day first. Undated entries are NOT in
 *  the strip — the strip is a chronology and an undated tick would be a lie;
 *  the ledger below carries them with the disclosed ordering rule instead. */
export function groupRadarDays(entries: readonly RadarEntry[]): RadarDay[] {
  const byDay = new Map<string, RadarDay>();
  for (const e of entries) {
    if (e.detectedAt === null) continue;
    const day = e.detectedAt.slice(0, 10);
    const d = byDay.get(day) ?? { day, collisions: 0, flags: 0, total: 0 };
    if (e.kind === "kolize") d.collisions++;
    else d.flags++;
    d.total++;
    byDay.set(day, d);
  }
  return [...byDay.values()].sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0));
}

/** Ready-to-paste citation block for one finding — the embeddable per-conflict
 *  citation (batch-4 §4B). `url` is composed by the caller (client origin or
 *  feed baseUrl); `dateLabel` is the already-formatted Czech date or null for
 *  undated entries (the block then cites the ordering rule honestly). */
export function radarCitationCs(e: RadarEntry, url: string, dateLabel: string | null): string {
  const when = dateLabel ? `zaznamenáno ${dateLabel}` : "bez data detekce (příznak odvozený z grafu)";
  return [`${e.titleCs}`, `${e.detailCs}`, `Politicas — Kolizní radar, ${when}. ${e.sourceCs}.`, url].join("\n");
}
