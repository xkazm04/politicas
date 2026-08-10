// Pure join/projection over the batch-017 §-level sector-attribution ledger
// (docs/data-analysis/case-law/payloads/batch-017-sector-attribution-para.json)
// — 29 rows, each a DERIVED, UNGATED lead: a sponsor's company sector next to
// an amended statute's domain, joined to the amended-§ census so the flag can
// (where the census isolated the statute) name its operative §§. No human
// gate has reviewed any of it; the underlying money ties carry their own
// pending states on /penize. Every flag also carries a `verdictDisposition` —
// a verbatim-faithful summary of a PUBLISHED forensic verdict that already
// adjudicated the same bill, inculpatory and exculpatory alike.
//
// This module is fs-free on purpose: `getLawData.ts` reads the payload file
// (mirrors its own `loadParagraphDiffs`/`loadBillSummaries`) and hands each
// raw row here to be validated + projected, so the join rule itself is
// testable without a store or a filesystem.

import { czechCopyOrNull } from "@/lib/analysis/language-gate";
import { lawJargonIssues } from "@/lib/analysis/law-verdict";
import { icoFromCompanyNodeId } from "@/features/money/companyId";

/** Sector vocabulary the payload actually carries (scripts/case-loops/law/company-sectors.ts
 * defines more; only the ones present in the batch-017 payload get a `lawwatch.sector.*`
 * label — see lawwatchLabels.ts's SECTOR_KEYS). An unmapped token renders VERBATIM and
 * labelled untranslated at the render site (the tieFlags.ts precedent), never hidden. */
export type SectorAttributionRaw = {
  cislo?: unknown;
  company?: unknown;
  sector?: unknown;
  sponsor?: unknown;
  viaLawRef?: unknown;
  viaLawTitle?: unknown;
  operativeParagraphs?: unknown;
  citedOnlyParagraphs?: unknown;
  partitionFallback?: unknown;
  diagnosticsClean?: unknown;
  verdictDisposition?: unknown;
};

/** The reader-facing projection of one attributed sector flag. `verdictDisposition` has
 * already passed the Czech gate + the law-pipeline-jargon gate (the same two-part rule
 * `getLawData.ts`'s `readForensic()` runs on forensic prose). A row whose disposition FAILS
 * either gate is no longer dropped whole — 2026-08-06: dropping erased the money↔statute
 * adjacency itself, which is stricter than the `readForensic()` precedent this module claims
 * parity with (that one withholds the FIELD and keeps the record). The company/sector/sponsor
 * are real regardless of whether the disposition prose is renderable, so the row now survives
 * with `verdictDisposition: null` and `dispositionWithheld: true`; the render site discloses
 * the withhold with a Czech sentence instead of silently vanishing. Only a STRUCTURALLY
 * malformed row (missing company/sector/sponsor/viaLawRef/cislo) is still dropped — that is
 * not a gate failure, it is missing data with nothing to disclose. */
export interface SectorAttributionFlag {
  company: string;
  sector: string;
  sponsor: string;
  viaLawRef: string;
  viaLawTitle: string | null;
  /** null ⇒ the census carries no §-level bucket for this statute (annex-only text or an
   * extractor limit) — never an empty finding, an absent one. Always non-empty when present. */
  operativeParagraphs: string[] | null;
  citedOnlyParagraphs: string[] | null;
  /** true ⇒ the census's own partitioner fell back to a whole-block allocation for this
   * statute, which is a STRONGER reason to withhold §-precision than a plain missing bucket. */
  partitionFallback: boolean;
  diagnosticsClean: boolean;
  /** null only when `dispositionWithheld` is true — never the failing raw string. */
  verdictDisposition: string | null;
  /** true ⇒ the payload carried a disposition, but it failed the Czech-language gate and/or
   * the pipeline-jargon gate, so it was withheld rather than rendered. The render site must
   * disclose this, not drop the row. */
  dispositionWithheld: boolean;
  /** Canonical 8-digit IČO of `company`, so a named firm can open its own money case file
   * (`/penize/firma/<ičo>`) — or null when it could not be resolved WITHOUT GUESSING.
   *
   * The payload carries no IČO. Its `company` string is the graph company node's own `label`,
   * copied verbatim by the producer (scripts/case-loops/law/triage-002.ts reads `c.label`), so
   * the loader resolves it by EXACT label equality against the company nodes it reads — and
   * only when exactly ONE node carries that label. An ambiguous label, an unknown label or a
   * node id outside the canonical `company:ico:<8 digits>` form all yield null and no link: a
   * near-miss address about a NAMED company on a conflict surface is precisely the failure the
   * shape-refusal precedent (features/dashboard/entityLinks.ts) exists to prevent. */
  companyIco: string | null;
}

/** Resolves a company LABEL to its canonical IČO, or null when the label is unknown or
 * ambiguous. Injected rather than imported so this module stays fs-free and store-free:
 * `getLawData.ts` owns the company read, this module owns the join rule (and its test can
 * pin the refusals without a store). Default: resolve nothing. */
export type CompanyIcoResolver = (companyLabel: string) => string | null;

const RESOLVES_NOTHING: CompanyIcoResolver = () => null;

/**
 * Builds the label→IČO resolver over the company nodes the loader read.
 *
 * It lives HERE, not in `getLawData.ts`, because it IS the join rule this module claims to
 * own — and the rule is made of REFUSALS, which a `server-only` module cannot have a test
 * for. Three of them, all yielding null and therefore no link:
 *
 *  1. **ambiguous label** — two nodes carrying the same label make it unknowable which firm
 *     the payload meant; „the first one" would be an address about a possibly different
 *     company on a conflict surface.
 *  2. **unknown label** — the payload names a firm the graph does not carry.
 *  3. **non-canonical node id** — the IČO comes from `icoFromCompanyNodeId` (imported from
 *     features/money/companyId.ts, never a second parser of what our ids look like), which
 *     refuses anything outside `company:ico:<≤8 digits>`; `psp:person:6751` also ends in
 *     digits, and reading it as an IČO is the exact silent mis-join that module exists to
 *     stop (memory/ico-node-id-canonical-form.md).
 *
 * A node whose id is refused is skipped BEFORE the ambiguity bookkeeping — it never carried
 * an address, so it cannot make a resolvable label ambiguous.
 */
export function buildCompanyIcoResolver(nodes: readonly { id: string; label: string }[]): CompanyIcoResolver {
  const byLabel = new Map<string, string | null>();
  for (const n of nodes) {
    const ico = icoFromCompanyNodeId(n.id);
    if (ico === null) continue;
    byLabel.set(n.label, byLabel.has(n.label) ? null : ico);
  }
  return (label: string) => byLabel.get(label) ?? null;
}

function asStr(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}
function asStrArray(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  const out = v.filter((x): x is string => typeof x === "string" && x.length > 0);
  return out.length > 0 ? out : null;
}

/** Projects one raw payload row into a reader-safe flag, or `null` when the row is
 * STRUCTURALLY malformed (missing company/sector/sponsor/viaLawRef/cislo — nothing to
 * disclose about a row that isn't there). A row whose `verdictDisposition` fails the Czech
 * gate and/or the pipeline-jargon gate is NOT dropped: it is returned with
 * `verdictDisposition: null` and `dispositionWithheld: true` so the render site can say so,
 * rather than the money↔statute adjacency vanishing whole (2026-08-06 fix — see the
 * interface doc above). */
export function projectSectorAttributionFlag(
  raw: SectorAttributionRaw,
  resolveCompanyIco: CompanyIcoResolver = RESOLVES_NOTHING,
): SectorAttributionFlag | null {
  const cislo = typeof raw.cislo === "number" ? raw.cislo : null;
  const company = asStr(raw.company);
  const sector = asStr(raw.sector);
  const sponsor = asStr(raw.sponsor);
  const viaLawRef = asStr(raw.viaLawRef);
  if (cislo === null || !company || !sector || !sponsor || !viaLawRef) return null;

  const dispositionRaw = asStr(raw.verdictDisposition);
  const safeDisposition = czechCopyOrNull(dispositionRaw);
  const gated = safeDisposition !== null && lawJargonIssues(safeDisposition).length === 0;

  return {
    company,
    sector,
    sponsor,
    viaLawRef,
    viaLawTitle: asStr(raw.viaLawTitle),
    operativeParagraphs: asStrArray(raw.operativeParagraphs),
    citedOnlyParagraphs: asStrArray(raw.citedOnlyParagraphs),
    partitionFallback: raw.partitionFallback === true,
    diagnosticsClean: raw.diagnosticsClean === true,
    verdictDisposition: gated ? safeDisposition : null,
    dispositionWithheld: !gated,
    companyIco: resolveCompanyIco(company),
  };
}

/** Groups already-validated rows by print number (`cislo`), each bucket ordered by company
 * name (cs collation) so the render order is stable and independent of payload row order. */
export function groupSectorAttributionFlags(
  rows: { cislo: number; flag: SectorAttributionFlag }[],
): Map<number, SectorAttributionFlag[]> {
  const out = new Map<number, SectorAttributionFlag[]>();
  for (const { cislo, flag } of rows) {
    const arr = out.get(cislo) ?? [];
    arr.push(flag);
    out.set(cislo, arr);
  }
  for (const arr of out.values()) arr.sort((a, b) => a.company.localeCompare(b.company, "cs"));
  return out;
}

/** The full raw→grouped pipeline over one payload's `rows` array — the one entry point
 * `getLawData.ts` calls after reading the JSON file. Malformed or gate-failing rows are
 * dropped silently at the row level (never surfaced as a fabricated partial flag); a
 * caller that wants the drop count can compare `rows.length` to the sum of bucket sizes. */
export function buildSectorAttributionIndex(
  rows: SectorAttributionRaw[],
  resolveCompanyIco: CompanyIcoResolver = RESOLVES_NOTHING,
): Map<number, SectorAttributionFlag[]> {
  const projected = rows.flatMap((raw) => {
    const cislo = typeof raw.cislo === "number" ? raw.cislo : null;
    const flag = projectSectorAttributionFlag(raw, resolveCompanyIco);
    return cislo !== null && flag ? [{ cislo, flag }] : [];
  });
  return groupSectorAttributionFlags(projected);
}
