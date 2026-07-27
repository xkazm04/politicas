// smlouvy.gov.cz (Registr smluv / ISRS) — party-search HTML client.
//
// WHY THIS EXISTS: Case ① money's indirect-ownership layer adds company nodes as
// ownership PARENTS (dataor.ts's AngazmaPravnicke shareholder chain, e.g. "Corporate
// service a.s." owning "PF METAL CZ s.r.o.") but those parent companies were never
// themselves contract-queried — so the layer is provably zero-power: it can name an
// owner but not show the owner touching public money. Registr smluv is the fix: every
// contract a public authority signs above the publication threshold is here, keyed by
// IČO on either party.
//
// TOKEN-FREE, BUT NOT STATELESS (verified live 2026-07-27, do not re-derive): the
// public search at `/vyhledavani?party_idnum=<ICO>&all_versions=0` needs no API key,
// but its pagination is NOT expressible as a single stateless GET. The site is a
// Nette app; page-size/offset changes are "signals" (`do=searchResultList-setLimit`,
// `do=searchResultList-setOffset`) that mutate PAGINATOR STATE HELD IN THE SESSION —
// they do nothing on a request that doesn't already carry that session's cookie, and
// they do nothing if combined into the very first request of a session (confirmed:
// `party_idnum=...&do=searchResultList-setLimit&searchResultList-limit=100` in one
// shot returns ZERO rows; the same two params sent as a SECOND request, reusing the
// first request's `Set-Cookie`, correctly returns all matching rows). There is no
// structured export: `&export=1|xml|csv` all return the same HTML (verified) — do
// NOT claim an API exists. The verified two-step protocol this client implements:
//   1. GET `/vyhledavani?party_idnum=<8-digit ICO>&all_versions=0`
//      → establishes the session (capture Set-Cookie) and returns page 1 at the
//        site's default page size (10).
//   2. GET `/vyhledavani?searchResultList-limit=<N>&do=searchResultList-setLimit&
//           party_idnum=<ICO>&all_versions=0` (same Cookie header)
//      → re-renders the SAME search at page size N (up to 500). A further
//        `searchResultList-offset=<off>&do=searchResultList-setOffset` signal
//        (same cookie) advances to the next window without resetting the limit.
// `party_idnum` matches the ICO on EITHER contracting party (not just the publishing
// authority — `subject_idnum` is that, and is NOT what this client uses).
//
// FRAGILITY: this is HTML scraping of a public-sector Nette app, not a stable API.
// The header-row column labels are checked on every fetch (checkHeaderRow) — a
// mismatch throws rather than silently mis-parsing shifted columns, because a wrong
// column offset would silently invent a bogus contract value, which is the one thing
// the brand rule forbids outright.

const DEFAULT_BASE_URL = "https://smlouvy.gov.cz";
const USER_AGENT = "politicas-money-loop/1 (+https://github.com/xkazm04/politicas)";

/** Header labels in column order, as rendered 2026-07-27 (7 columns incl. the action
 *  column). Compared against every fetched page's `<thead>` — see checkHeaderRow. */
/**
 * The six LABELLED header columns, in order. The results table carries a seventh,
 * ACTION column (the per-row "Detail" link) whose `<th>` is empty on the live site —
 * so it is deliberately absent here and asserted separately by cell COUNT, not by
 * label (batch 009: an earlier revision expected a literal "Detail" label, which
 * matched the unit fixture but rejected every live page — a fixture that agrees with
 * itself is not a verification).
 */
export const EXPECTED_HEADER_LABELS = [
  "Publikující smluvní strana",
  "Předmět smlouvy",
  "Poslední verze",
  "Publikováno",
  "Hodnota smlouvy",
  "Smluvní strana(y)",
] as const;

/** Labelled columns + the trailing unlabelled action column. */
export const EXPECTED_COLUMN_COUNT = EXPECTED_HEADER_LABELS.length + 1;

export interface SmlouvyRow {
  contractId: string;
  detailUrl: string;
  publisher: string;
  subject: string;
  /** ISO yyyy-mm-dd, parsed from the site's DD.MM.YYYY. */
  publishedOn: string | null;
  /** null means the publisher's own "Neuvedeno" (not stated) — NEVER 0. */
  valueCzk: number | null;
  /** e.g. "bez DPH" | "s DPH" | null (present only when a value was stated). */
  valueNote: string | null;
  counterparties: string[];
  latestVersion: boolean;
}

export interface SmlouvyPage {
  rows: SmlouvyRow[];
  /** Best-effort parse of "Počet nalezných záznámů N" — null if the page didn't carry
   *  a recognizable total (never invented). */
  totalMatches: number | null;
}

export interface SmlouvyFetchOptions {
  /** Page-size signal value (searchResultList-limit). Default 100 — the site accepts
   *  10/50/100/500; 100 balances round-trips against payload size for a batch job. */
  limit?: number;
  /** Result-window signal value (searchResultList-offset). Default 0 (first page). */
  offset?: number;
}

export interface SmlouvyAllOptions extends Pick<SmlouvyFetchOptions, "limit"> {
  /** Hard cap on pages fetched per IČO (guards a pagination bug/site change from
   *  looping forever). Default 20 at limit=100 → 2 000 rows, comfortably above any
   *  single company's real contract count seen in this corpus so far. */
  maxPages?: number;
}

export interface SmlouvyAllResult {
  rows: SmlouvyRow[];
  totalMatches: number | null;
  /** true iff maxPages was hit before the site reported no further rows — a batch
   *  caller MUST surface this (the kernel forbids silent truncation), not just log it. */
  truncated: boolean;
}

/* ── HTML micro-parsing (no DOM dependency in this repo — same discipline as
 *    dataor.ts's bespoke UdajeParser: a small, deliberately narrow parser beats a
 *    heavyweight dependency for one fixed table shape). ───────────────────────── */

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ", // an actual nbsp char (raw decode; whitespace folding happens later in stripTagsText)
};

/** Decode the small set of HTML entities this page actually uses (numeric decimal
 *  `&#160;`, numeric hex `&#xa0;`, and the named handful above) — not a general HTML
 *  entity table, deliberately, since a wrong guess here would corrupt Czech text. */
export function decodeHtmlEntities(s: string): string {
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (m, body: string) => {
    if (body[0] === "#") {
      const code = body[1] === "x" || body[1] === "X" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return NAMED_ENTITIES[body] ?? m;
  });
}

/** Strip tags, decode entities, fold all whitespace (incl. nbsp) to single spaces,
 *  trim. Used for cell text that should never carry nested markup semantics. */
function stripTagsText(html: string): string {
  const noTags = html.replace(/<[^>]*>/g, " ");
  const decoded = decodeHtmlEntities(noTags);
  return decoded.replace(/[\s ]+/g, " ").trim();
}

/** Header-cell text ONLY, ignoring a nested sort-icon `<a>` (whose arrow glyph would
 *  otherwise survive naive tag-stripping and corrupt the label comparison — verified
 *  live: `<th>Publikováno <a class="sort-icon">▲</a><a class="sort-icon">▼</a></th>`).
 *  Takes the text up to the first nested tag only. */
function headerCellLabel(cellHtml: string): string {
  const cut = cellHtml.search(/<a[\s>]/i);
  const head = cut === -1 ? cellHtml : cellHtml.slice(0, cut);
  return stripTagsText(head);
}

function matchAll(re: RegExp, s: string): RegExpExecArray[] {
  const out: RegExpExecArray[] = [];
  let m: RegExpExecArray | null;
  const r = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
  while ((m = r.exec(s))) out.push(m);
  return out;
}

/** Extract the `<thead>...</thead>` block's `<th>` labels (nested sort-icon anchors
 *  excluded — see headerCellLabel). Returns null if no `<thead>` is present at all
 *  (an empty-results page may render no table). */
export function parseHeaderRow(html: string): string[] | null {
  const thead = /<thead[^>]*>([\s\S]*?)<\/thead>/i.exec(html);
  if (!thead) return null;
  const cells = matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi, thead[1]);
  if (cells.length === 0) return null;
  return cells.map((c) => headerCellLabel(c[1]));
}

/** Throws if the header row's labels don't match EXPECTED_HEADER_LABELS exactly — a
 *  deliberate fail-loud: silently mis-parsing a shifted column would fabricate a
 *  contract value out of the wrong cell, which the brand rule forbids outright. Does
 *  nothing if there's no header at all (treated as "no results table", not drift —
 *  see parsePage). */
export function checkHeaderRow(html: string): void {
  const labels = parseHeaderRow(html);
  if (labels === null) return;
  const expected = EXPECTED_HEADER_LABELS as readonly string[];
  // The trailing action column is unlabelled on the live site, so check the labelled
  // prefix by label and the table width by count — never require a label the site
  // does not actually render.
  // The action column's own label is NOT asserted (it is empty today, but labelling it
  // would be a cosmetic change, not a shape change) — the width check already catches a
  // real inserted/removed column, and parseDataRow independently rejects any row whose
  // cell count disagrees.
  const widthOk = labels.length === EXPECTED_COLUMN_COUNT;
  const prefixOk = expected.every((l, i) => labels[i] === l);
  if (!widthOk || !prefixOk) {
    throw new Error(
      `[smlouvy] header-row drift detected — refusing to parse rows against a changed table shape. ` +
        `expected [${expected.join(" | ")}] + 1 unlabelled action column, got [${labels.join(" | ")}]`,
    );
  }
}

/** "84 000 CZK bez DPH" → {valueCzk: 84000, valueNote: "bez DPH"}. "Neuvedeno" →
 *  {null, null} — the publisher's own not-stated sentinel, NEVER coerced to 0.
 *  Handles both a literal nbsp and a plain space as the thousands separator. */
export function parseValueCell(raw: string): { valueCzk: number | null; valueNote: string | null } {
  const text = stripTagsText(raw);
  if (text === "" || text === "Neuvedeno") return { valueCzk: null, valueNote: null };
  const m = /^([\d\s .,]+)\s*CZK\s*(.*)$/.exec(text);
  if (!m) return { valueCzk: null, valueNote: null };
  const digits = m[1].replace(/[\s .,]/g, "");
  const value = digits.length > 0 ? Number(digits) : NaN;
  const note = m[2].trim();
  return {
    valueCzk: Number.isFinite(value) ? value : null,
    valueNote: note.length > 0 ? note : null,
  };
}

/** "13.07.2026" → "2026-07-13". Returns null (never a guess) if unparseable. */
export function parseCzechDate(raw: string): string | null {
  const text = stripTagsText(raw);
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(text);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  return `${yyyy}-${mm}-${dd}`;
}

/** Splits the "Smluvní strana(y)" cell into individual counterparty names — the cell
 *  can list more than one contracting party; observed separators are a comma or a
 *  `<br>` between names (never both meaningfully inside one name in this corpus). */
export function parseCounterparties(raw: string): string[] {
  const parts = raw.split(/<br\s*\/?>/i).flatMap((p) => p.split(","));
  return parts
    .map((p) => stripTagsText(p))
    .filter((p) => p.length > 0);
}

function extractDetail(cellHtml: string): { contractId: string; detailUrl: string } | null {
  const href = /href="([^"]+)"/i.exec(cellHtml)?.[1];
  if (!href) return null;
  const decoded = decodeHtmlEntities(href);
  const id = /\/smlouva\/(\d+)/.exec(decoded)?.[1];
  if (!id) return null;
  return { contractId: id, detailUrl: decoded };
}

/** Parse one `<tr>` (EXPECTED_COLUMN_COUNT `<td>` cells — the six labelled columns
 *  plus the trailing Detail action cell) into a typed row. Returns null for a
 *  structurally malformed row (wrong cell count) rather than guessing — callers count
 *  skipped rows and can decide whether that's alarming. */
export function parseDataRow(trHtml: string): SmlouvyRow | null {
  const cells = matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi, trHtml);
  if (cells.length !== EXPECTED_COLUMN_COUNT) return null;
  const [publisherCell, subjectCell, versionCell, dateCell, valueCell, partiesCell, detailCell] = cells.map(
    (c) => c[1],
  );
  const detail = extractDetail(detailCell);
  if (!detail) return null;
  const { valueCzk, valueNote } = parseValueCell(valueCell);
  return {
    contractId: detail.contractId,
    detailUrl: detail.detailUrl,
    publisher: stripTagsText(publisherCell),
    subject: stripTagsText(subjectCell),
    publishedOn: parseCzechDate(dateCell),
    valueCzk,
    valueNote,
    counterparties: parseCounterparties(partiesCell),
    latestVersion: stripTagsText(versionCell).toLowerCase() === "ano",
  };
}

/** Best-effort "Počet nalezných záznámů N" total — cosmetic, never load-bearing:
 *  null if the page's exact wording drifts (deliberately NOT part of checkHeaderRow's
 *  fail-loud contract, since a caller can always fall back to counting rows). */
export function parseTotalMatches(html: string): number | null {
  // Loose on the exact wording/diacritics of "nalezných záznámů" (observed spelling
  // varies) — anchored on "Počet" then the first run of digits within a short
  // window, which is robust to the label text drifting without over-fitting a
  // brittle diacritic-exact match.
  const m = /Počet[^\d]{0,40}?(\d+)/u.exec(html);
  return m ? Number(m[1]) : null;
}

/** Parse one full search-results page: validates the header shape (throws on drift),
 *  then extracts every data row from `<tbody>` (or the whole document if no `<tbody>`
 *  tag is present — defensive, not observed live). An empty result set (no `<thead>`
 *  at all) parses to `{rows: [], totalMatches: null}` without throwing — that is a
 *  legitimate "party_idnum matched nothing" outcome, not drift. */
export function parsePage(html: string): SmlouvyPage {
  checkHeaderRow(html);
  const tbodyMatch = /<tbody[^>]*>([\s\S]*?)<\/tbody>/i.exec(html);
  const body = tbodyMatch ? tbodyMatch[1] : html;
  const trs = matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi, body);
  const rows: SmlouvyRow[] = [];
  for (const tr of trs) {
    const row = parseDataRow(tr[0]);
    if (row) rows.push(row);
  }
  return { rows, totalMatches: parseTotalMatches(html) };
}

/* ── IO — the client ─────────────────────────────────────────────────────────── */

/** Zero-pad to the 8-digit form `party_idnum` expects; tolerates an already-padded
 *  or unpadded input. Does NOT validate the IČO checksum — that's the caller's job
 *  (this module is a dumb transport, not an IČO validator). */
export function padIco(ico: string): string {
  const digits = ico.trim().replace(/\D/g, "");
  return digits.padStart(8, "0");
}

async function fetchWithTimeoutRetry(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit = {},
  maxRetries = 3,
): Promise<Response> {
  const backoff = (attempt: number) => new Promise((r) => setTimeout(r, Math.min(8_000, 400 * 2 ** attempt)));
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(30_000) });
      if ((res.status === 429 || res.status === 503) && attempt < maxRetries) {
        await backoff(attempt);
        continue;
      }
      return res;
    } catch (e) {
      if (attempt >= maxRetries) throw e;
      await backoff(attempt);
    }
  }
}

/** Extracts a `Cookie:`-ready string from a response's `Set-Cookie` header(s) —
 *  session continuity is the entire pagination mechanism here (see module doc), so
 *  this is load-bearing, not cosmetic. Prefers `getSetCookie()` (Node 18.14+/undici)
 *  and falls back to the single combined header older runtimes expose. */
function collectCookies(res: Response): string[] {
  const headersWithGetSetCookie = res.headers as Headers & { getSetCookie?: () => string[] };
  if (typeof headersWithGetSetCookie.getSetCookie === "function") {
    return headersWithGetSetCookie.getSetCookie();
  }
  const combined = res.headers.get("set-cookie");
  return combined ? [combined] : [];
}

function cookieHeaderFrom(setCookies: string[]): string {
  return setCookies
    .map((c) => c.split(";")[0].trim())
    .filter((c) => c.length > 0)
    .join("; ");
}

export interface SmlouvyClientOptions {
  fetchImpl?: typeof fetch;
  baseUrl?: string;
}

/**
 * Registr smluv (smlouvy.gov.cz) party-search client. Token-free but session-bound —
 * see the module doc for the verified two-request protocol. `fetchImpl` is injectable
 * so tests never hit the network.
 */
export class SmlouvyClient {
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl: string;

  constructor(opts: SmlouvyClientOptions = {}) {
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
  }

  /** One page of results for one IČO (matches EITHER contracting party). Internally
   *  performs the two-request session handshake described in the module doc — the
   *  caller never sees the intermediate request. */
  async fetchPage(icoRaw: string, opts: SmlouvyFetchOptions = {}): Promise<SmlouvyPage> {
    const ico = padIco(icoRaw);
    const limit = opts.limit ?? 100;
    const offset = opts.offset ?? 0;

    const searchUrl = `${this.baseUrl}/vyhledavani?party_idnum=${ico}&all_versions=0`;
    const first = await fetchWithTimeoutRetry(this.fetchImpl, searchUrl, {
      headers: { "User-Agent": USER_AGENT },
    });
    if (!first.ok) throw new Error(`smlouvy.gov.cz search → ${first.status} (${searchUrl})`);
    const cookie = cookieHeaderFrom(collectCookies(first));

    // Default page size (10) with no window change requested — the first response
    // already IS the answer, skip the second round trip.
    if (limit === 10 && offset === 0) {
      return parsePage(await first.text());
    }

    const html = await first.text();
    let cookieHeader = cookie;

    let pageHtml = html;
    if (limit !== 10) {
      const limitUrl =
        `${this.baseUrl}/vyhledavani?searchResultList-limit=${limit}&do=searchResultList-setLimit` +
        `&party_idnum=${ico}&all_versions=0`;
      const limitRes = await fetchWithTimeoutRetry(this.fetchImpl, limitUrl, {
        headers: { "User-Agent": USER_AGENT, Cookie: cookieHeader },
      });
      if (!limitRes.ok) throw new Error(`smlouvy.gov.cz setLimit → ${limitRes.status} (${limitUrl})`);
      cookieHeader = cookieHeaderFrom(collectCookies(limitRes)) || cookieHeader;
      pageHtml = await limitRes.text();
    }

    if (offset > 0) {
      const offsetUrl =
        `${this.baseUrl}/vyhledavani?searchResultList-offset=${offset}&do=searchResultList-setOffset` +
        `&party_idnum=${ico}&all_versions=0`;
      const offsetRes = await fetchWithTimeoutRetry(this.fetchImpl, offsetUrl, {
        headers: { "User-Agent": USER_AGENT, Cookie: cookieHeader },
      });
      if (!offsetRes.ok) throw new Error(`smlouvy.gov.cz setOffset → ${offsetRes.status} (${offsetUrl})`);
      pageHtml = await offsetRes.text();
    }

    return parsePage(pageHtml);
  }

  /**
   * Fetch every contract row for one IČO, paging at `limit` (default 100) until the
   * site returns a page shorter than `limit` (the natural end-of-results signal) or
   * `maxPages` is hit. A cap hit is LOGGED (console.warn) and reflected in the
   * returned `truncated` flag — the kernel forbids a batch job silently dropping
   * data past an internal limit.
   */
  async fetchAllForIco(icoRaw: string, opts: SmlouvyAllOptions = {}): Promise<SmlouvyAllResult> {
    const limit = opts.limit ?? 100;
    const maxPages = opts.maxPages ?? 20;
    const ico = padIco(icoRaw);

    const rows: SmlouvyRow[] = [];
    let totalMatches: number | null = null;
    let truncated = false;

    for (let page = 0; page < maxPages; page++) {
      const offset = page * limit;
      const result = await this.fetchPage(ico, { limit, offset });
      if (totalMatches === null) totalMatches = result.totalMatches;
      rows.push(...result.rows);
      if (result.rows.length < limit) {
        // short page = the site has no more rows to give us
        return { rows, totalMatches, truncated: false };
      }
      if (page === maxPages - 1) {
        truncated = true;
        console.warn(
          `[smlouvy] fetchAllForIco(${ico}): hit maxPages=${maxPages} (limit=${limit}) with a full last page — ` +
            `more rows likely exist upstream and were NOT fetched. Raise maxPages or paginate further.`,
        );
      }
    }
    return { rows, totalMatches, truncated };
  }
}
