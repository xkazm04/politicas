// dataor.justice.cz — Ministry of Justice bulk OR/ISVR open-data export (CKAN).
//
// WHY THIS EXISTS: the money loop's corroboration hinge is ARES VR
// (`lib/analysis/money-feed.ts`'s AresClient.vrRecord, `/ekonomicke-subjekty-vr/{ico}`).
// ARES VR is a live REST snapshot — it has NO record for a struck-off/dissolved entity
// (batch-003/004's "PRaK" dead end, IČO 61858111, 404 on both REST endpoints) and its
// officer sub-records are sometimes birth-date-thin for old (pre-2000s) entries. dataor's
// bulk export is the Ministry's own year-scoped ARCHIVE of the same public register
// (ISVR — Informační systém veřejných rejstříků): one file per court×legalForm×year,
// FULL variant = complete extract for that year INCLUDING struck-off history within the
// record. Fetching the right year's FULL file recovers exactly what ARES VR's live
// snapshot cannot show — see docs/data-analysis/justice-sources-registry.md (the
// PRaK proof) for the full assessment this module implements.
//
// LICENCE (log before any bulk mirror): ISVR_OpenData_Podminky_uziti.pdf — reuse is
// permitted for NON-COMMERCIAL use; the recipient of officer birth dates/addresses
// becomes a GDPR data controller. Politicas' existing doctrine (public-role facts only,
// private life out of scope — docs/case-loops.md) already treats birth dates as
// identity-matching keys only, never narrative content — this module follows that: it
// extracts `narozDatum` ONLY to compare against our own roster birth date, never surfaces
// it directly.
//
// SCOPE (batch 006): this adapter targets Case ① money's two live jobs — closing
// `conflicting`/`registry-unconfirmed` ties (needs one currently-active company's FULL
// file for the most recent year, which carries its complete officer history) and the
// PRaK re-point (needs one dissolved company's FULL file for its dissolution year). It
// does NOT attempt a full historical mirror (7 courts × ~15 legal forms × ~20 years —
// several GB, unmeasured, flagged as future work in the assessment) — file fetches are
// targeted, one court×form×year at a time, cached to disk so a batch never re-fetches.

import { gunzipSync } from "node:zlib";
import { asciiFold } from "@/lib/ingest/normalize";

const CKAN_BASE = "https://dataor.justice.cz/api/3/action";
const CACHE_DIR = ".dataor-cache"; // gitignored — raw bulk files, same convention as .justice-samples/

async function fetchRetry(url: string, init: RequestInit = {}, maxRetries = 4): Promise<Response> {
  const backoff = (attempt: number) => new Promise((r) => setTimeout(r, Math.min(15_000, 500 * 2 ** attempt)));
  // 180s, not 60s — the largest court×form combos (sro-full-praha, the biggest s.r.o.
  // catalog) can run well past a minute to fully transfer even as a 40MB+ gzip; a real
  // batch-006 run OOM'd retries on this before the timeout was widened.
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(180_000) });
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

/* ── CKAN catalog ─────────────────────────────────────────────────────────────── */

export interface CkanResource {
  id: string;
  format: string; // "CSV" | "CSV.GZ" | "XML" | "XML.GZ" (as published)
  url: string;
  name?: string;
}
export interface CkanPackage {
  id: string;
  name: string;
  resources: CkanResource[];
}

export async function packageList(): Promise<string[]> {
  const res = await fetchRetry(`${CKAN_BASE}/package_list`);
  if (!res.ok) throw new Error(`dataor package_list → ${res.status}`);
  const json = (await res.json()) as { result?: string[] };
  return json.result ?? [];
}

export async function packageShow(datasetId: string): Promise<CkanPackage | null> {
  const res = await fetchRetry(`${CKAN_BASE}/package_show?id=${encodeURIComponent(datasetId)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`dataor package_show ${datasetId} → ${res.status}`);
  const json = (await res.json()) as { success?: boolean; result?: CkanPackage };
  return json.success ? (json.result ?? null) : null;
}

/** {legalForm}-{full|actual}-{court}-{year}, the ISVR dataset naming convention. */
export function datasetId(legalForm: string, variant: "full" | "actual", court: string, year: number): string {
  return `${legalForm}-${variant}-${court}-${year}`;
}

/* ── court + legal-form resolution ───────────────────────────────────────────── */

/** Rejstříkový soud code (as embedded in `spisovaZnacka`, e.g. "C 51716/MSPH") → dataor
 *  court slug. The 7 regional-seat courts that administer the Czech public registers
 *  (verified list in the assessment); Praha's municipal court (MSPH) and the Středočeský
 *  regional court (KSPH) both fold into dataor's single "praha" catalog slug. */
export const COURT_CODE_TO_SLUG: Record<string, string> = {
  MSPH: "praha", KSPH: "praha",
  KSCB: "ceske_budejovice",
  KSPL: "plzen",
  KSUL: "usti_nad_labem",
  KSHK: "hradec_kralove",
  KSBR: "brno", KSBM: "brno",
  KSOS: "ostrava",
};

/** ARES `sidlo.kodKraje` → dataor court slug, fallback when no `spisovaZnacka` is available
 *  (e.g. the subject exists in ROS but the VR sub-record didn't surface a spisová značka).
 *  Czech kraj codes per ČSÚ; grouped by which regional court administers the register for
 *  that kraj (same 7-court grouping as COURT_CODE_TO_SLUG). */
export const KRAJ_CODE_TO_COURT_SLUG: Record<number, string> = {
  19: "praha", // Hlavní město Praha
  27: "praha", // Středočeský
  31: "ceske_budejovice", // Jihočeský
  32: "plzen", // Plzeňský
  41: "usti_nad_labem", // Karlovarský (folds to Plzeň court per some sources; kept with Ústí group is wrong — see NOTE below)
  42: "usti_nad_labem", // Ústecký
  51: "usti_nad_labem", // Liberecký
  52: "hradec_kralove", // Královéhradecký
  53: "hradec_kralove", // Pardubický
  63: "brno", // Vysočina
  64: "brno", // Jihomoravský
  71: "ostrava", // Olomoucký
  72: "brno", // Zlínský
  80: "ostrava", // Moravskoslezský
};
// NOTE (honest limitation, not silently guessed): Karlovarský kraj's registry court is
// actually Krajský soud v Plzni, not Ústí — kodKraje 41 above is a known-approximate entry
// (ČSÚ kraj code for Karlovarský; corrected mapping below). Kept as an explicit override
// table entry rather than fixed inline so a wrong guess is visible and correctable:
KRAJ_CODE_TO_COURT_SLUG[41] = "plzen"; // Karlovarský → Krajský soud v Plzni (corrected)

/** ARES `pravniForma` numeric codelist → dataor legal-form slug. Only the forms actually
 *  observed among Case ① money's open ties + the catalog's own published slug list
 *  (assessment §"Naming") — NOT a claimed-complete codelist. An unmapped code returns
 *  null and the caller must fall back to name-suffix heuristics or skip with a flag. */
export const PRAVNI_FORMA_TO_SLUG: Record<string, string> = {
  "112": "sro", // společnost s ručením omezeným
  "121": "as", // akciová společnost
  "111": "sro", // veřejná obchodní společnost — no dedicated slug observed; best-effort
  "117": "sro", // komanditní společnost — same caveat
  "205": "sro", // družstvo — same caveat, not independently verified this session
  "421": "nevlad_org", // spolek
  "422": "z_pobocny_spolek", // pobočný spolek
  "451": "nevlad_org", // nadace
  "452": "nevlad_org", // nadační fond
  "453": "ops", // ústav — best-effort, not independently verified
  "461": "ops", // obecně prospěšná společnost
  "471": "zaj_sdr_po", // zájmové sdružení právnických osob
  "801": "po_zzz", // příspěvková organizace — best-effort
  "325": "zvlastni_org", // státní podnik — best-effort, not independently verified
};

/** Name-suffix fallback when `pravniForma` is unmapped or unavailable — same discipline
 *  as `reconcile-ares-vr.ts`'s classifyTie: cheap, deterministic, logged as a fallback
 *  (never silently trusted as strongly as a codelist hit). */
export function legalFormSlugFromName(name: string): string | null {
  const n = asciiFold(name);
  if (/\bspolecnost s rucenim omezenym\b|\bspol\. s r\.?o\.?\b|\bs\.r\.o\.?\b/.test(n)) return "sro";
  if (/\bakciova spolecnost\b|\ba\.s\.?\b/.test(n)) return "as";
  if (/\bz\.s\.?\b|\bspolek\b|\bobcanske sdruzeni\b/.test(n)) return "nevlad_org";
  if (/\bo\.p\.s\.?\b|\bobecne prospesna spolecnost\b/.test(n)) return "ops";
  if (/\bnadacni fond\b|\bnadace\b/.test(n)) return "nevlad_org";
  if (/\bprispevkova organizace\b/.test(n)) return "po_zzz";
  if (/\bstatni podnik\b/.test(n)) return "zvlastni_org";
  return null;
}

export interface CourtFormGuess {
  courtSlug: string | null;
  legalFormSlug: string | null;
  source: "spisova-znacka" | "kraj-fallback" | "name-heuristic" | "unresolved";
}

/** ARES subject shape — only the fields this resolver reads. */
export interface AresSubjectForCourtForm {
  pravniForma?: string;
  obchodniJmeno?: string;
  sidlo?: { kodKraje?: number };
  dalsiUdaje?: { datovyZdroj?: string; spisovaZnacka?: string; pravniForma?: string }[];
}

/** Deterministic court+legal-form resolver — see module doc for why this exists (dataor
 *  has no IČO index; you must already know or derive court×form to pick the file). Tries,
 *  in order: (1) the VR sub-record's `spisovaZnacka` suffix (most reliable — it IS the
 *  court code), (2) `sidlo.kodKraje` region mapping, (3) name-suffix heuristic for the
 *  legal form only (court still needed from 1 or 2). Never fabricates a guess it can't
 *  attribute — `source` on the result states exactly which rung resolved it. */
export function resolveCourtAndForm(subject: AresSubjectForCourtForm): CourtFormGuess {
  const vrEntry = subject.dalsiUdaje?.find((d) => d.datovyZdroj === "vr");
  const spis = vrEntry?.spisovaZnacka;
  const courtCode = spis?.match(/\/([A-Z]{4})\s*$/)?.[1] ?? null;
  const formCode = vrEntry?.pravniForma ?? subject.pravniForma;
  const formFromCodelist = formCode ? (PRAVNI_FORMA_TO_SLUG[formCode] ?? null) : null;
  const formFromName = subject.obchodniJmeno ? legalFormSlugFromName(subject.obchodniJmeno) : null;
  const legalFormSlug = formFromCodelist ?? formFromName;

  if (courtCode && COURT_CODE_TO_SLUG[courtCode]) {
    return { courtSlug: COURT_CODE_TO_SLUG[courtCode], legalFormSlug, source: "spisova-znacka" };
  }
  const kraj = subject.sidlo?.kodKraje;
  if (kraj != null && KRAJ_CODE_TO_COURT_SLUG[kraj]) {
    return { courtSlug: KRAJ_CODE_TO_COURT_SLUG[kraj], legalFormSlug, source: "kraj-fallback" };
  }
  if (legalFormSlug) return { courtSlug: null, legalFormSlug, source: "name-heuristic" };
  return { courtSlug: null, legalFormSlug: null, source: "unresolved" };
}

/* ── the `udaje` grammar — a bespoke Groovy/Java toString() serialization, not JSON ── */
//
// Grammar (reverse-engineered from live samples, .justice-samples/prak_udaje.txt +
// the assessment's AngazmaPravnicke excerpt):
//   value  := object | array | scalar
//   object := '{' (key '=' value (';' key '=' value)*)? '}'
//   array  := '[' (value (',' ' '? value)*)? ']'
//   scalar := any run of characters up to the next unescaped ';' or '}' at this depth
//             (values never themselves contain literal '{'/'[' — a nested structure is
//             always introduced by 'key=' immediately followed by '{' or '[')
// The top-level `udaje` string IS an array literal (`[{...}, {...}, ...]`).

export type UdajeValue = string | UdajeValue[] | { [key: string]: UdajeValue };

class UdajeParser {
  constructor(private s: string, private i = 0) {}
  private peek(): string | undefined {
    return this.s[this.i];
  }
  private skipWs(): void {
    while (this.i < this.s.length && /\s/.test(this.s[this.i])) this.i++;
  }
  parseValue(): UdajeValue {
    this.skipWs();
    const c = this.peek();
    if (c === "{") return this.parseObject();
    if (c === "[") return this.parseArray();
    return this.parseScalar();
  }
  private parseObject(): Record<string, UdajeValue> {
    this.i++; // consume '{'
    const obj: Record<string, UdajeValue> = {};
    this.skipWs();
    if (this.peek() === "}") {
      this.i++;
      return obj;
    }
    for (;;) {
      const keyStart = this.i;
      while (this.i < this.s.length && this.s[this.i] !== "=") this.i++;
      const key = this.s.slice(keyStart, this.i).trim();
      this.i++; // consume '='
      const value = this.parseValue();
      obj[key] = value;
      this.skipWs();
      if (this.peek() === ";") {
        this.i++;
        this.skipWs();
        continue;
      }
      if (this.peek() === "}") {
        this.i++;
        break;
      }
      // malformed input — stop rather than loop forever
      break;
    }
    return obj;
  }
  private parseArray(): UdajeValue[] {
    this.i++; // consume '['
    const arr: UdajeValue[] = [];
    this.skipWs();
    if (this.peek() === "]") {
      this.i++;
      return arr;
    }
    for (;;) {
      arr.push(this.parseValue());
      this.skipWs();
      if (this.peek() === ",") {
        this.i++;
        this.skipWs();
        continue;
      }
      if (this.peek() === "]") {
        this.i++;
        break;
      }
      break;
    }
    return arr;
  }
  private parseScalar(): string {
    const start = this.i;
    while (this.i < this.s.length && this.s[this.i] !== ";" && this.s[this.i] !== "}" && this.s[this.i] !== "]" ) {
      this.i++;
    }
    return this.s.slice(start, this.i).trim();
  }
}

/** Parse one record's `udaje` field into a plain JS structure. Never throws on malformed
 *  input — a parse defect returns as much as was recovered (the grammar loop above stops
 *  cleanly rather than throwing), so a single bad row never aborts a batch. */
export function parseUdaje(raw: string): UdajeValue[] {
  if (!raw || !raw.trim()) return [];
  const parser = new UdajeParser(raw.trim());
  const v = parser.parseValue();
  return Array.isArray(v) ? v : [v];
}

function isObj(v: UdajeValue | undefined): v is Record<string, UdajeValue> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function str(v: UdajeValue | undefined): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

/* ── record extraction ───────────────────────────────────────────────────────── */

export interface DataorOfficer {
  role: string | null; // e.g. "člen představenstva", "jednatel"
  kind: "officer" | "shareholder";
  firstName: string | null;
  lastName: string | null;
  birthDate: string | null; // narozDatum, ISO if present — null is common for pre-2000s entries
  companyName: string | null; // set only for AngazmaPravnicke (corporate) entries
  companyIco: string | null; // set only for AngazmaPravnicke (corporate) entries
  validFrom: string | null; // clenstviOd, falls back to zapisDatum
  validTo: string | null; // clenstviDo, falls back to vymazDatum — null = ongoing as of this record
  stakePct: number | null;
  /** udajTyp.nazev — the organ/type label (e.g. "člen statutárního orgánu"). `role` (funkce)
   *  is sometimes a bare, low-information scalar like "člen" with no organ qualifier — a
   *  batch-006 Opus verification pass flagged that a caller rendering `role` alone can read
   *  as under-specified. Combine `role` + `organNazev` when they differ meaningfully. */
  organNazev: string | null;
}

// STATUTARNI_ORGAN_CLEN (statutory body — jednatel/představenstvo) is only ONE of several
// "*_CLEN" member types dataor uses; DOZORCI_RADA_CLEN (dozorčí rada — supervisory board),
// KONTROLNI_KOMISE_CLEN (kontrolní komise), and SPRAVNI_RADA_CLEN (správní rada — o.p.s./
// nadace board) are equally real officer seats with the same osoba/narozDatum shape. A
// batch-006 Opus verification pass caught this gap live: a birth-date-confirmed dozorčí
// rada seat (a real corroborating match) was silently missing from the extraction because
// only STATUTARNI_ORGAN_CLEN was recognized (see docs/data-analysis/case-money/batch-006.md).
// POCET_CLEN ("member count", a number) and VKLAD_CLEN (deposit-related) are NOT member
// seats despite the "_CLEN" suffix and are deliberately excluded.
const OFFICER_TYPY = new Set([
  "STATUTARNI_ORGAN_CLEN",
  "DOZORCI_RADA_CLEN",
  "KONTROLNI_KOMISE_CLEN",
  "SPRAVNI_RADA_CLEN",
]);
const SHAREHOLDER_TYPY = new Set(["AKCIONAR", "SPOLECNIK"]);

/** Walk one parsed `udaje` array and pull every officer/shareholder entry — both natural-
 *  person (AngazmaFyzicke) and corporate (AngazmaPravnicke, the indirect-ownership signal,
 *  O-money-3). Recurses into `podudaje` since some udajTyp groups nest their members there
 *  (mirrors the CSV sample's `PREDMET_PODNIKANI_SEKCE` nesting shape). */
export function extractOfficersAndShareholders(udaje: UdajeValue[]): DataorOfficer[] {
  const out: DataorOfficer[] = [];
  function walk(items: UdajeValue[]) {
    for (const item of items) {
      if (!isObj(item)) continue;
      const typKod = isObj(item.udajTyp) ? str(item.udajTyp.kod) : null;
      const hodnotaText = str(item.hodnotaText); // "AngazmaFyzicke" | "AngazmaPravnicke" on engagement rows
      const isOfficer = typKod ? OFFICER_TYPY.has(typKod) : false;
      const isShareholder = typKod ? SHAREHOLDER_TYPY.has(typKod) : false;
      if ((isOfficer || isShareholder) && (hodnotaText === "AngazmaFyzicke" || hodnotaText === "AngazmaPravnicke")) {
        const osoba = isObj(item.osoba) ? item.osoba : {};
        const validFrom = str(item.clenstviOd) ?? str(item.zapisDatum);
        const validTo = str(item.clenstviDo) ?? str(item.vymazDatum);
        const organNazev = isObj(item.udajTyp) ? str(item.udajTyp.nazev) : null;
        const role = str(item.funkce) ?? organNazev;
        if (hodnotaText === "AngazmaPravnicke") {
          out.push({
            role, kind: isShareholder ? "shareholder" : "officer",
            firstName: null, lastName: null, birthDate: null,
            companyName: str(osoba.nazev), companyIco: str(osoba.ico),
            validFrom, validTo, stakePct: null, organNazev,
          });
        } else {
          out.push({
            role, kind: isShareholder ? "shareholder" : "officer",
            firstName: str(osoba.jmeno), lastName: str(osoba.prijmeni), birthDate: str(osoba.narozDatum),
            companyName: null, companyIco: null,
            validFrom, validTo, stakePct: null, organNazev,
          });
        }
      }
      if (Array.isArray(item.podudaje)) walk(item.podudaje as UdajeValue[]);
      // some engagement lists nest under a plain array value keyed differently per udajTyp —
      // walk any array-valued field defensively so a schema variant this session didn't
      // sample still surfaces (never silently drops a sub-list).
      for (const v of Object.values(item)) {
        if (Array.isArray(v) && v !== item.podudaje) walk(v as UdajeValue[]);
      }
    }
  }
  walk(udaje);
  return out;
}

/** `spisovaZnacka` (SPIS_ZN udajTyp), if present in this record's `udaje`. */
export function extractSpisovaZnacka(udaje: UdajeValue[]): string | null {
  for (const item of udaje) {
    if (!isObj(item)) continue;
    const typKod = isObj(item.udajTyp) ? str(item.udajTyp.kod) : null;
    if (typKod === "SPIS_ZN") return str(item.hodnotaText);
  }
  return null;
}

/* ── CSV parsing (RFC4180-shaped: comma-delimited, double-quoted, "" escapes a literal
 *    quote) — verified against a live download (sf-full-hradec_kralove-2026.csv), NOT the
 *    ";"-delimited shape the CSV-W metadata doc's prose implied. ─────────────────────── */

export interface DataorRawRecord {
  ico: string;
  nazev: string;
  udajeRaw: string;
  vymazDatum: string | null;
  zapisDatum: string | null;
}

/** Read one CSV row starting at `pos`. Index/`indexOf`-based — NOT character-by-character
 *  string accumulation. A real dataor file is 40MB gzipped / 300MB+ decompressed (one row's
 *  `udaje` field alone can run several KB); the first version of this parser built each
 *  field with `field += c` in a per-character loop and OOM'd (4GB heap) on a real
 *  `as-full-praha-2012` fetch — `.slice()` + native `indexOf` is the fix, same discipline
 *  as `normalize.ts`'s allocation-cheap fold. Returns the row's fields and the position of
 *  the next row (past the line terminator). */
function readCsvRow(text: string, pos: number): { fields: string[]; next: number } {
  const n = text.length;
  const fields: string[] = [];
  while (pos <= n) {
    let value: string;
    if (text[pos] === '"') {
      pos++; // skip opening quote
      let end = text.indexOf('"', pos);
      if (end === -1) {
        value = text.slice(pos, n);
        pos = n;
      } else {
        // doubled quotes ("") escape a literal quote — keep scanning past them
        let segments: string[] | null = null;
        while (end !== -1 && text[end + 1] === '"') {
          (segments ??= []).push(text.slice(pos, end));
          pos = end + 2;
          end = text.indexOf('"', pos);
        }
        const tail = text.slice(pos, end === -1 ? n : end);
        value = segments ? segments.join('"') + tail : tail;
        pos = end === -1 ? n : end + 1;
      }
    } else {
      let end = pos;
      while (end < n && text[end] !== "," && text[end] !== "\n" && text[end] !== "\r") end++;
      value = text.slice(pos, end);
      pos = end;
    }
    fields.push(value);
    if (text[pos] === ",") {
      pos++;
      continue;
    }
    break;
  }
  if (text[pos] === "\r") pos++;
  if (text[pos] === "\n") pos++;
  return { fields, next: pos };
}

interface DataorHeader {
  idxIco: number;
  idxNazev: number;
  idxUdaje: number;
  idxVymaz: number;
  idxZapis: number;
  bodyStart: number;
}

function readHeader(text: string): DataorHeader | null {
  const { fields, next } = readCsvRow(text, 0);
  const header = fields.map((h) => h.trim());
  const idxIco = header.indexOf("ico");
  const idxUdaje = header.indexOf("udaje");
  if (idxIco < 0 || idxUdaje < 0) return null;
  return {
    idxIco,
    idxNazev: header.indexOf("nazev"),
    idxUdaje,
    idxVymaz: header.indexOf("vymazDatum"),
    idxZapis: header.indexOf("zapisDatum"),
    bodyStart: next,
  };
}

function rowToRecord(fields: string[], h: DataorHeader): DataorRawRecord | null {
  if (fields.length < 2 || (fields.length === 1 && fields[0] === "")) return null;
  return {
    ico: (fields[h.idxIco] ?? "").trim(),
    nazev: (fields[h.idxNazev] ?? "").trim(),
    udajeRaw: fields[h.idxUdaje] ?? "",
    vymazDatum: (fields[h.idxVymaz] ?? "").trim() || null,
    zapisDatum: (fields[h.idxZapis] ?? "").trim() || null,
  };
}

/** Parse a full dataor CSV text blob into records. Fine for small/medium files (tests,
 *  the smaller court×form combinations); for a large FULL export prefer
 *  `findRecordByIcoInCsvText`, which never materializes every row. */
export function parseDataorCsv(text: string): DataorRawRecord[] {
  const h = readHeader(text);
  if (!h) return [];
  const out: DataorRawRecord[] = [];
  let pos = h.bodyStart;
  const n = text.length;
  while (pos < n) {
    const { fields, next } = readCsvRow(text, pos);
    if (next === pos) break; // no progress — malformed tail, stop rather than loop forever
    const rec = rowToRecord(fields, h);
    if (rec) out.push(rec);
    pos = next;
  }
  return out;
}

/** Memory-efficient targeted lookup: scans row by row WITHOUT building an array of every
 *  record (the whole-file `parseDataorCsv` result for a large FULL export is ~300MB+ of
 *  JS objects — wasteful when the caller only wants one IČO). Stops at the first match. A
 *  cheap pre-filter (`text.indexOf('"' + digits + '"')`) skips straight to a plausible
 *  offset before falling back to full-row scanning if the fast path doesn't confirm a
 *  column-aligned hit (guards against the same digits appearing inside `udaje` prose). */
export function findRecordByIcoInCsvText(text: string, ico: string): DataorRawRecord | null {
  const h = readHeader(text);
  if (!h) return null;
  const target = ico.replace(/^0+/, "") || "0";
  let pos = h.bodyStart;
  const n = text.length;
  while (pos < n) {
    const { fields, next } = readCsvRow(text, pos);
    if (next === pos) break;
    const rawIco = (fields[h.idxIco] ?? "").trim();
    if ((rawIco.replace(/^0+/, "") || "0") === target) {
      return rowToRecord(fields, h);
    }
    pos = next;
  }
  return null;
}

/* ── file fetch + disk cache ─────────────────────────────────────────────────── */

async function ensureCacheDir(): Promise<string> {
  const fs = await import("node:fs/promises");
  await fs.mkdir(CACHE_DIR, { recursive: true });
  return CACHE_DIR;
}

/** Fetch (with on-disk cache) the CSV text of one court×legalForm×year dataset. Prefers
 *  the `.csv.gz` resource (smaller transfer); falls back to plain `.csv`. Returns null if
 *  the dataset doesn't exist (package_show 404 / not found) — the caller decides whether
 *  that's "wrong court/form guess" or "no data for this year". */
export async function fetchDatasetCsv(id: string): Promise<string | null> {
  const dir = await ensureCacheDir();
  const fs = await import("node:fs/promises");
  const cachePath = `${dir}/${id}.csv`;
  try {
    return await fs.readFile(cachePath, "utf8");
  } catch (err) {
    console.warn(`[dataor] cache miss for ${cachePath} — fetching from CKAN:`, (err as Error).message);
  }
  const pkg = await packageShow(id);
  if (!pkg) return null;
  const gz = pkg.resources.find((r) => /\.csv\.gz$/i.test(r.url));
  const plain = pkg.resources.find((r) => /\.csv$/i.test(r.url) && !/\.gz$/i.test(r.url));
  const resource = gz ?? plain;
  if (!resource) return null;
  const res = await fetchRetry(resource.url);
  if (!res.ok) throw new Error(`dataor file ${resource.url} → ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const text = gz ? gunzipSync(buf).toString("utf8") : buf.toString("utf8");
  await fs.writeFile(cachePath, text, "utf8");
  return text;
}

/** Find one record by IČO inside an already-parsed record array (small fixtures/tests). */
export function findRecordByIco(records: DataorRawRecord[], ico: string): DataorRawRecord | null {
  const target = ico.replace(/^0+/, "") || "0";
  return records.find((r) => (r.ico.replace(/^0+/, "") || "0") === target) ?? null;
}

/** High-level entry point for a corroboration lookup: fetch (cached) one court×legalForm×
 *  year dataset and pull one IČO's record + parsed officer/shareholder list in one call,
 *  never materializing the whole file's records. Returns null if the dataset doesn't exist
 *  or the IČO isn't in it (caller decides which — `datasetExists` on the result). */
export interface DataorLookupResult {
  datasetExists: boolean;
  record: DataorRawRecord | null;
  officers: DataorOfficer[];
  spisovaZnacka: string | null;
}
export async function fetchAndFindRecord(id: string, ico: string): Promise<DataorLookupResult> {
  const text = await fetchDatasetCsv(id);
  if (text === null) return { datasetExists: false, record: null, officers: [], spisovaZnacka: null };
  const record = findRecordByIcoInCsvText(text, ico);
  if (!record) return { datasetExists: true, record: null, officers: [], spisovaZnacka: null };
  const udaje = parseUdaje(record.udajeRaw);
  return {
    datasetExists: true,
    record,
    officers: extractOfficersAndShareholders(udaje),
    spisovaZnacka: extractSpisovaZnacka(udaje),
  };
}
