// Adapter for kiosek.justice.cz/opendata — the national "úřední desky"
// (official-notice-board) OFN JSON-LD feed, 208 courts + prosecutor's
// offices, hourly. See docs/data-analysis/justice-sources-kiosek.md for the
// discovery session this adapter implements (API shape, sample records,
// join-key evidence, effort estimate). Batch-006 of the case-loops fleet
// (docs/case-loops.md in the politicas repo) — kiosek feeds BOTH Case ③ law
// (statute citations, broader agenda coverage than rozhodnuti.justice.cz)
// and Case ① money (real, UNANONYMIZED IČOs on company dissolution/
// liquidation orders — a linkage rozhodnuti.justice.cz's anonymization
// removed).
//
// SOURCE   https://kiosek.justice.cz/opendata/  (Angular SPA; API discovered
//          from the bundle, not documented on the page)
// FORMAT   JSON-LD (OFN "Úřední deska" schema) for postings metadata;
//          attached case documents are PDF, hosted on a THIRD host
//          (infodeska.gov.cz).
// LICENCE  essentially unrestricted reuse (no copyrighted-works /
//          database-right claim per the DCAT `podmínky_užití` block), but
//          `osobní_údaje: obsahuje-osobní-údaje` is asserted true — postings
//          name natural persons (delivery-notice addressees). The same
//          public-role-facts-only / GDPR-conscious doctrine the registry
//          already applies to dataor's officer data applies here.
// CADENCE  declared HOURLY (`periodicita_aktualizace`) per dataset, but NOT
//          append-only: postings vanish once `relevantní_do` passes. Poll
//          forward and dedup by the posting's own `url` (its stablest key —
//          `iri`'s `data.justice.cz` host is confirmed dead, do not fetch
//          it), the same doctrine the ISIR SOAP adapter (Source B in the
//          registry) uses for a non-append-only feed, not dataor's
//          overwrite-in-place snapshot pattern.
//
// TWO JOIN KEYS, both living inside the attached PDFs, NOT the JSON-LD
// metadata:
//   - statute citations (`č. 304/2013 Sb.` etc) — reuses `extractAmendedLaws`
//     from psp-legislation.ts VERBATIM (same LAW_CITATION regex, same
//     `Sb. m. s.` exclusion) so the law case's citation parser and this one
//     can never drift into disagreement (the kernel's fleet rule).
//   - Czech IČO (8-digit, modulo-11 checksum validated, and only accepted
//     when textually labelled "IČ"/"IČO" in the source — see
//     `extractIcos()` for why a blind `\b\d{8}\b` scan is rejected).
//
// A deterministic document classifier (`classifyPosting`) routes postings
// into boilerplate / substantive / administrative BEFORE PDF extraction so
// extraction budget is spent on the ~40-50% of postings that carry real
// join-key content, not the boilerplate half.

import { LAW_CITATION } from "./psp-legislation";

export const SOURCE_KIOSEK = "kiosek-uredni-deska";

export const KIOSEK_BASE = "https://kiosek.justice.cz/opendata";
export const KIOSEK_PREHLED_URL = `${KIOSEK_BASE}/api/v1/prehled`;
export const INFODESKA_BASE = "https://infodeska.gov.cz";

// The Czech path segment ("úřední_deska") MUST be percent-encoded exactly
// like this — a bare/un-encoded segment 403s (verified live in the spec
// doc's discovery session, re-derived here rather than hand-typed so a
// future encoding-table change can't silently diverge).
export const KIOSEK_DESKA_SEGMENT = encodeURIComponent("úřední_deska");

/** `GET .../úřední_deska/{code}.jsonld` — one institution's notice-board postings. */
export function kioskDeskaUrl(code: string): string {
  return `${KIOSEK_BASE}/${KIOSEK_DESKA_SEGMENT}/${code}.jsonld`;
}

/* ── provenance ───────────────────────────────────────────────────────────── */

export interface Prov {
  source: string;
  sourceUrl: string;
  fetchedAt: string;
}

/* ── row types ────────────────────────────────────────────────────────────── */

/** One row of `prehled.json` — the 208-institution catalogue. */
export interface InstitutionRow extends Prov {
  nazev: string;
  ico: string | null;
  ovm: string | null;
  /** Dataset code, e.g. "201000" (MS Praha) — the `{code}.jsonld` path segment. */
  code: string;
}

export interface AttachmentRow {
  url: string;
  nazev: string | null;
}

export type PostingLabel = "boilerplate" | "substantive" | "administrative" | "unclassified";

export interface PostingClassification {
  label: PostingLabel;
  /** The exact pattern/agenda value that decided the label, for auditability. */
  matchedPattern: string;
}

/** One `informace[]` item from an institution's `{code}.jsonld`. */
export interface PostingRow extends Prov {
  /**
   * Dedup key for a poll-forward harvester. The posting's own `url` (NOT the
   * `iri`, whose `data.justice.cz` host is confirmed dead) — falls back to
   * institutionCode+spisovaZnacka+postedAt when `url` is somehow absent
   * (not observed in the 5 cached institutions, but no silent truncation).
   */
  id: string;
  institutionCode: string;
  spisovaZnacka: string | null;
  title: string;
  agendas: string[];
  postedAt: string | null; // vyvěšení.datum_a_čas
  removalAt: string | null; // relevantní_do.datum_a_čas ("" if unspecified)
  removalUnspecified: boolean;
  url: string | null;
  iri: string | null;
  attachments: AttachmentRow[];
  classification: PostingClassification;
}

/** One statute citation extracted from a posting's PDF text. */
export interface StatuteCitation {
  postingId: string;
  /** `law:sb:<n>-<rok>` — same id format as scripts/case-loops/law/ingest-missing-laws.ts. */
  lawUrn: string;
  /** `<n>/<rok>` as extracted (before urn normalization), for display. */
  citation: string;
}

/** One IČO/entity-name pair extracted from a posting's PDF text. */
export interface IcoMention {
  postingId: string;
  ico: string;
  /** `company:ico:<ico>` — same id format as lib/analysis/kg-money.ts's companyUrn(). */
  companyUrn: string;
  /**
   * The text immediately preceding the "IČO nnnnnnnn" label, trimmed to
   * whitespace only (no invented normalization) — the entity-name candidate
   * as it appears in the source. NOT guaranteed to be a clean company name;
   * a human/Opus pass verifies textual adjacency before this is trusted.
   */
  nameContext: string;
  /** Raw surrounding text snippet, for independent verification. */
  snippet: string;
  /**
   * Deterministic heuristic (batch-006, Opus-pass finding): true when the
   * text just after the IČO carries a "narozen(a) DD. M. YYYY" birth-date
   * clause, or the name context starts with a person title prefix
   * (JUDr./Mgr./Ing./Bc./Ph.D. …) — the pattern real samples showed for
   * court-appointed liquidators/attorneys, who hold a personal IČO as an
   * OSVČ, NOT a company. `company:ico:*` is the wrong node kind for these;
   * downstream consumers (the money case) should route personLikely=true
   * mentions to a person node/edge instead, never silently fold them into
   * the company graph. This is a heuristic, not a registry lookup — it can
   * both under- and over-flag; treat it as a routing signal, not a verdict.
   */
  personLikely: boolean;
}

/* ── throttle / retry helper ─────────────────────────────────────────────── */

/**
 * The spec doc's discovery session found that a tight back-to-back loop over
 * kiosek endpoints (15 requests, 0.5s gap) produced repeated connection
 * failures after the first call, while single sequential calls succeeded
 * reliably 5-for-5. No safe interval was measured — 1.5s is a CONSERVATIVE,
 * UNVERIFIED choice (not a measured rate limit), plus a bounded retry with
 * backoff for the transient failures the discovery session saw.
 */
export const KIOSEK_THROTTLE_MS = 1500;

export interface ThrottleOptions {
  delayMs?: number;
  retries?: number;
}

/** Sequential fetch of `urls`, sleeping `delayMs` between calls and retrying transient failures. */
export async function fetchWithThrottle(
  urls: string[],
  fetchOne: (url: string) => Promise<Response>,
  opts: ThrottleOptions = {},
): Promise<Response[]> {
  const delayMs = opts.delayMs ?? KIOSEK_THROTTLE_MS;
  const retries = opts.retries ?? 3;
  const out: Response[] = [];
  for (let i = 0; i < urls.length; i++) {
    if (i > 0) await sleep(delayMs);
    out.push(await fetchWithRetry(urls[i], fetchOne, retries, delayMs));
  }
  return out;
}

async function fetchWithRetry(
  url: string,
  fetchOne: (url: string) => Promise<Response>,
  retries: number,
  delayMs: number,
): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetchOne(url);
      if (res.ok) return res;
      lastErr = new Error(`${url} → HTTP ${res.status}`);
    } catch (e) {
      lastErr = e;
    }
    if (attempt < retries) await sleep(delayMs * (attempt + 1)); // linear backoff
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* ── pure parsers (operate on already-fetched JSON) ──────────────────────── */

interface RawInstitution {
  nazev?: string;
  ico?: string;
  ovm?: string;
  nazevSady?: string;
  nazevData?: string;
}

/** `{code}.jsonld` from `nazevSady`/`nazevData`, e.g. "201000.jsonld" → "201000". */
function codeFromDatasetName(name: string | undefined): string | null {
  if (!name) return null;
  const m = /^(.+?)\.jsonld$/.exec(name.trim());
  return m ? m[1] : null;
}

/** Pure parse of `prehled.json`'s institution catalogue. */
export function parseInstitutions(raw: unknown, prov: Prov): InstitutionRow[] {
  const arr = Array.isArray(raw) ? (raw as RawInstitution[]) : [];
  const out: InstitutionRow[] = [];
  for (const r of arr) {
    const code = codeFromDatasetName(r.nazevSady) ?? codeFromDatasetName(r.nazevData);
    if (!r.nazev || !code) continue; // no silent-truncation exception: these two are load-bearing
    out.push({
      nazev: r.nazev,
      ico: r.ico ?? null,
      ovm: r.ovm ?? null,
      code,
      ...prov,
    });
  }
  return out;
}

interface RawLangString {
  cs?: string;
}
interface RawTimestamp {
  datum_a_čas?: string;
  nespecifikovaný?: boolean;
}
interface RawDocument {
  url?: string;
  název?: RawLangString;
}
interface RawAgenda {
  název?: RawLangString;
}
interface RawInformace {
  "vyvěšení"?: RawTimestamp;
  "spisová_značka"?: string;
  dokument?: RawDocument[];
  agenda?: RawAgenda[];
  url?: string;
  iri?: string;
  "název"?: RawLangString;
  "relevantní_do"?: RawTimestamp;
}
interface RawDeska {
  informace?: RawInformace[];
}

/* ── document classifier (deterministic, title/agenda pattern based) ────── */

// Agenda values that route straight to "administrative" regardless of title —
// closed-vocabulary EXACT match against the small set of known agenda
// category strings (not a substring/word search over free text, so the
// case-loops kernel's word-boundary-regex rule for Czech keyword classifiers
// doesn't apply the same way — this is matching a fixed API enum value).
const ADMINISTRATIVE_AGENDAS = new Set(["Informace podle zák. 106/1999 Sb.", "Předseda soudu"]);

// Boilerplate delivery-by-posting notices: title starts with "Sdělení" (e.g.
// "Sdělení pro vyvěšení na úřední desce soudu podle § 49 odst. 4 o.s.ř.").
// (no trailing \b: JS's ASCII-only \w means \b doesn't fire after a Czech
// diacritic like "í" — anchor on whitespace-or-end instead.)
const BOILERPLATE_TITLE = /^Sdělení(\s|$)/i;

// Operative court decisions: title starts with one of these — vocabulary
// confirmed by scanning the real `název` values across all 5 cached
// institution files (2,302 postings), not guessed. "Rozhodnutí"/"Veřejná
// vyhláška" were found alongside "Usnesení"/"Rozsudek" in the same
// operative-decision role (e.g. "Rozhodnutí VS o částečné změně", "Veřejná
// vyhláška popisu věci").
const SUBSTANTIVE_TITLE = /^(usnesení|rozsudek|rozhodnutí|veřejná vyhláška)/i;

/**
 * Deterministic, title/agenda-pattern classifier — no LLM (the spec doc's
 * explicit instruction: deterministic first, LLM only if genuinely
 * undecidable, and this vocabulary was NOT genuinely undecidable once read).
 * Agenda beats title (an administrative-agenda posting titled "Rozhodnutí -
 * 6To 64/2018" is a §106/1999 disclosure of an old case, not fresh
 * join-key content — the agenda is the stronger signal there).
 */
export function classifyPosting(title: string, agendas: string[]): PostingClassification {
  for (const a of agendas) {
    if (ADMINISTRATIVE_AGENDAS.has(a)) return { label: "administrative", matchedPattern: `agenda:${a}` };
  }
  if (BOILERPLATE_TITLE.test(title)) return { label: "boilerplate", matchedPattern: "title:^Sdělení" };
  if (SUBSTANTIVE_TITLE.test(title)) {
    const m = SUBSTANTIVE_TITLE.exec(title);
    return { label: "substantive", matchedPattern: `title:^${m?.[1] ?? ""}` };
  }
  return { label: "unclassified", matchedPattern: "none" };
}

/** Pure parse of one institution's `{code}.jsonld` `informace[]` array. */
export function parsePostings(raw: unknown, institutionCode: string, prov: Prov): PostingRow[] {
  const informace = (raw as RawDeska | undefined)?.informace ?? [];
  const out: PostingRow[] = [];
  for (const it of informace) {
    const title = it["název"]?.cs ?? "";
    const agendas = (it.agenda ?? []).map((a) => a["název"]?.cs).filter((s): s is string => !!s);
    const url = it.url ?? null;
    const spisovaZnacka = it["spisová_značka"] ?? null;
    const postedAt = it["vyvěšení"]?.["datum_a_čas"] ?? null;
    const relDo = it["relevantní_do"];
    const removalUnspecified = relDo?.nespecifikovaný === true;
    const removalAt = removalUnspecified ? null : (relDo?.["datum_a_čas"] ?? null);
    const attachments: AttachmentRow[] = (it.dokument ?? []).map((d) => ({
      url: d.url ?? "",
      nazev: d["název"]?.cs ?? null,
    }));
    out.push({
      // Dedup key doctrine: prefer the posting's own url (stable, poll-forward
      // key per the spec doc); fall back to a composite key only if url is
      // missing (not observed in the cached corpus — logged, not hidden).
      id: url ?? `${institutionCode}:${spisovaZnacka ?? "?"}:${postedAt ?? "?"}`,
      institutionCode,
      spisovaZnacka,
      title,
      agendas,
      postedAt,
      removalAt,
      removalUnspecified,
      url,
      iri: it.iri ?? null,
      attachments,
      classification: classifyPosting(title, agendas),
      ...prov,
    });
  }
  return out;
}

/* ── statute-citation extraction (mirrors psp-legislation.ts VERBATIM) ──── */

// Judgment PDF text (kiosek's corpus) carries a false-positive class
// psp-legislation.ts's bill-title parser never needed to guard against:
// citations into a COURT'S OWN case-law reporter — "č. 4682/2025 Sb. NSS"
// (Sbírka rozhodnutí Nejvyššího správního soudu) — which matches
// `LAW_CITATION` (the "Sb." token) but is not a Sbírka-zákonů statute at
// all. Found empirically in the cached asylum-judgment sample (batch-006):
// "rozsudku ze dne 3. 4. 2025, č. j. 1 Azs 174/2024 – 42, č. 4682/2025 Sb.
// NSS" — a real misparse the raw regex alone would have shipped as a
// fabricated `law:sb:4682-2025` node/edge. Excluded here by checking the
// text immediately following the match for a `NSS`/`SDEU` reporter marker,
// a corpus-specific hardening LAYERED ON TOP of, not forked from,
// LAW_CITATION — the regex itself is imported verbatim from
// psp-legislation.ts, unchanged.
const NON_STATUTE_SB_SUFFIX = /^\s*(NSS|SDEU)\b/;

/**
 * Statute citations in a posting's extracted PDF text, normalized to
 * `law:sb:<n>-<rok>` (the exact id format scripts/case-loops/law/
 * ingest-missing-laws.ts uses, line ~124: `law:sb:${m.statute.replace("/", "-")}`).
 * Uses `LAW_CITATION` — the SAME regex + `Sb. m. s.` exclusion the law
 * case's bill-title parser uses, imported verbatim, not forked — plus the
 * `Sb. NSS`/case-reporter guard above (judgment-text-specific, see comment).
 */
export function extractStatuteCitations(postingId: string, text: string): StatuteCitation[] {
  const out = new Map<string, StatuteCitation>();
  for (const m of text.matchAll(LAW_CITATION)) {
    const tail = text.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 12);
    if (NON_STATUTE_SB_SUFFIX.test(tail)) continue;
    const citation = `${Number(m[1])}/${m[2]}`;
    if (!out.has(citation)) out.set(citation, { postingId, lawUrn: `law:sb:${citation.replace("/", "-")}`, citation });
  }
  return [...out.values()];
}

/* ── IČO extraction, modulo-11 checksum validated ────────────────────────── */

/**
 * Czech IČO modulo-11 checksum: weights 8,7,6,5,4,3,2 on the first 7 digits,
 * sum mod 11 = r; check digit = 11-r, EXCEPT r=0 → check digit 1 (11 wraps
 * to 1) and r=1 → check digit 0 (10 wraps to 0). Verified against both real
 * IČOs in the cached liquidation sample: 07043694 (r=7 → check=4 ✓) and
 * 03007740 (r=1 → check=0, the r=1 edge case ✓).
 *
 * Batch-006 correction (Opus verification pass): the FIRST version of this
 * function collapsed BOTH r=0 and r=1 to check digit 0. That is wrong for
 * r=0 (the correct wrap is 11→1, not 11→0) — a real bug that would have
 * rejected genuinely valid IČOs whose checksum lands on r=0 (~1/11 of the
 * space) as false negatives, silently dropping real join-key hits. No IČO
 * in the batch-006 sample happened to hit r=0, so the bug shipped
 * undetected until the Opus pass re-derived the algorithm independently —
 * recorded here as a caught, fixed defect, not a hidden one.
 */
export function isValidIco(ico: string): boolean {
  if (!/^\d{8}$/.test(ico)) return false;
  const digits = ico.split("").map(Number);
  const weights = [8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 7; i++) sum += digits[i] * weights[i];
  const r = sum % 11;
  const check = r === 0 ? 1 : r === 1 ? 0 : 11 - r;
  return check === digits[7];
}

// Only accept an 8-digit run when it is textually labelled "IČ"/"IČO"/"IČ:"
// immediately before it (Czech legal-text convention, confirmed in every
// cached sample: "IČO 07043694", "IČO: 03007740"). A blind `\b\d{8}\b` scan
// over legal prose hits plenty of non-IČO 8-digit numbers (case-number
// suffixes, dates-as-numbers, file references) — REJECTED per the spec's
// explicit instruction. Requiring the label is a stronger bar than the spec's
// minimum (checksum only) but is the only way to avoid false positives on
// unlabelled 8-digit runs while still capturing every real, checksum-valid
// IČO in the sampled documents (all of which carry the label).
const ICO_LABELLED = /I[ČC][OÍ]?\.?\s*:?\s*(\d{8})\b/g;

const NAME_CONTEXT_MAX = 120;

// batch-006 (Opus pass, finding b/CONCERN 1): court-appointed liquidators/
// attorneys carry a personal IČO (OSVČ), distinguishable in the sampled text
// by a birth-date clause right after the IČO ("IČO 72015594, narozen(a)
// 1. 6. 1982…") or a person-title prefix on the name context.
const PERSON_AFTER = /^\s*,?\s*narozen[aá]?\s+\d/i;
const PERSON_TITLE_PREFIX = /^(JUDr\.|Mgr\.|Ing\.|Bc\.|MUDr\.|PhDr\.|RNDr\.|Mgr\.\s*Bc\.)/;

/**
 * IČO/entity-name mentions in a posting's extracted PDF text. Every returned
 * mention passed the modulo-11 checksum AND was textually adjacent to an
 * "IČ"/"IČO" label — never a guessed pairing.
 */
export function extractIcos(postingId: string, text: string): IcoMention[] {
  const out: IcoMention[] = [];
  for (const m of text.matchAll(ICO_LABELLED)) {
    const ico = m[1];
    if (!isValidIco(ico)) continue;
    const matchStart = m.index ?? 0;
    const before = text.slice(Math.max(0, matchStart - NAME_CONTEXT_MAX), matchStart);
    // Name context: the clause immediately before the label, trimmed to the
    // last comma/newline-delimited segment (no invented normalization beyond
    // whitespace collapse — the spec's explicit instruction).
    const lastBreak = Math.max(before.lastIndexOf("\n"), before.lastIndexOf(". "));
    const nameContext = before
      .slice(lastBreak >= 0 ? lastBreak + 1 : 0)
      .replace(/\s+/g, " ")
      .trim();
    const snippetStart = Math.max(0, matchStart - 40);
    const after = text.slice(matchStart + m[0].length, matchStart + m[0].length + 30);
    const snippet = text
      .slice(snippetStart, matchStart + m[0].length + 40)
      .replace(/\s+/g, " ")
      .trim();
    const personLikely = PERSON_AFTER.test(after) || PERSON_TITLE_PREFIX.test(nameContext);
    out.push({ postingId, ico, companyUrn: `company:ico:${ico}`, nameContext, snippet, personLikely });
  }
  return out;
}

/* ── IO wrappers ──────────────────────────────────────────────────────────── */

export interface KioskFetchers {
  fetchJson: (url: string) => Promise<unknown>;
  fetchBytes: (url: string) => Promise<Uint8Array>;
}

function nowIso(): string {
  return new Date().toISOString();
}

/** IO wrapper: fetch + parse the 208-institution catalogue. */
export async function fetchInstitutions(fetchers: KioskFetchers): Promise<InstitutionRow[]> {
  const raw = await fetchers.fetchJson(KIOSEK_PREHLED_URL);
  return parseInstitutions(raw, { source: SOURCE_KIOSEK, sourceUrl: KIOSEK_PREHLED_URL, fetchedAt: nowIso() });
}

/** IO wrapper: fetch + parse one institution's postings. */
export async function fetchPostings(fetchers: KioskFetchers, code: string): Promise<PostingRow[]> {
  const url = kioskDeskaUrl(code);
  const raw = await fetchers.fetchJson(url);
  return parsePostings(raw, code, { source: SOURCE_KIOSEK, sourceUrl: url, fetchedAt: nowIso() });
}

/** IO wrapper: fetch one attachment's raw PDF bytes (throttled by the caller — see fetchWithThrottle). */
export async function fetchAttachmentBytes(fetchers: KioskFetchers, url: string): Promise<Uint8Array> {
  return fetchers.fetchBytes(url);
}
