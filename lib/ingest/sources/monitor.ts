// MONITOR (Státní pokladna, MF ČR) — municipal-finance JSON client + parsers.
//
// WHY THIS EXISTS: BudgetMirror (features/budget) escapes its 10-town mock only if a
// real source feeds it. MONITOR is that source: every účetní jednotka of the state —
// including all 6,254 obcí — reports FIN 2-12 M statements quarterly, and the MONITOR
// web app exposes them through an open, token-free JSON API.
//
// VERIFIED LIVE 2026-07-30 (do not re-derive from the old domain):
//   - The site moved to `monitor.statnipokladna.gov.cz` (the old `.cz` 301s there).
//   - The Angular SPA's own API base is `/api` (bundle: `serverUrl:"/api"`, an HTTP
//     interceptor prefixes every service path). No auth, no cookie, plain GETs.
//   - `GET /api/obdobi` → all reporting periods; `loadID` (e.g. 2512 = 12/2025) is
//     the period key every other endpoint takes; `finM: true` marks periods with
//     municipal FIN 2-12 M data loaded.
//   - `GET /api/kraj/obce?obdobi=<loadID>&nuts=<krajNuts>` → every municipality of
//     one kraj (IČO, name, population, region, county). The 14 kraje sum to exactly
//     6,254 obcí (verified against the ČSÚ count; Praha is 1 row under CZ010).
//   - `GET /api/ukazatele?ic=<IČO>&obdobi=<loadID>` → ~50 named indicators for one
//     entity/period: `dluh` (debt), `vydaje_kons`/`kapitalove_vydaje_kons` (total /
//     capital expenditures, consolidated), `saldo_kons` (budget balance,
//     consolidated), `obyvatele` (population for that period), etc. Amounts in Kč.
//   - Konsolidované (`_kons`) figures are the ones a town's real budget size means:
//     unconsolidated `vydaje` for Beroun 2025 is 1.85 mld (internal transfer
//     double-counts); `vydaje_kons` is 794 mil — the town's actual budget. The
//     mirror therefore reads `_kons` for expenditures/saldo; `dluh` and `obyvatele`
//     have no consolidation variant.
//
// SCALE DISCIPLINE: the registry is 14 requests (quick); indicators are one request
// per town × period. A full 6,254 × 6-year sweep is ~37k requests — a standing batch
// job, NOT an in-session fetch. `harvestBudgetSnapshots` therefore takes an explicit
// town list the caller bounds (the 2026-07-30 batch: 132 towns ≥ 10k population ×
// 5 years = 660 calls, ~30 s at concurrency 8, zero failures). Coverage of a partial
// batch is DISCLOSED on-page, never passed off as completeness.

const DEFAULT_BASE_URL = "https://monitor.statnipokladna.gov.cz/api";
const USER_AGENT = "politicas-budget-mirror/1 (+https://github.com/xkazm04/politicas)";

export const SOURCE_MONITOR = "monitor-statni-pokladna";

/** The 14 kraje of the ČR in ČSÚ NUTS3 order — the registry sweep's fan-out. */
export const KRAJ_NUTS: readonly string[] = [
  "CZ010", "CZ020", "CZ031", "CZ032", "CZ041", "CZ042", "CZ051",
  "CZ052", "CZ053", "CZ063", "CZ064", "CZ071", "CZ072", "CZ080",
];

/** One reporting period from `/api/obdobi`. */
export interface MonitorPeriod {
  /** MONITOR's period key, e.g. 2512 = December 2025. */
  loadID: number;
  year: number;
  /** Czech month name as MONITOR labels it ("prosinec", …). */
  month: string;
  /** true = municipal FIN 2-12 M data is loaded for this period. */
  finM: boolean;
}

/** One municipality row from `/api/kraj/obce`. */
export interface MonitorMunicipality {
  /** 8-digit IČO (already zero-padded by MONITOR). */
  ic: string;
  /** Full legal name ("Město Beroun"). */
  name: string;
  /** Display name without the legal prefix ("Beroun"). */
  shortName: string;
  population: number;
  krajNuts: string;
  krajName: string;
  county: string;
}

/** The indicator subset the budget mirror reads, one entity × one period.
 *  null = MONITOR did not report the value for that period — NEVER coerced to 0. */
export interface MonitorBudgetYear {
  /** Total municipal debt, Kč (`dluh`). */
  debtCzk: number | null;
  /** Total expenditures, consolidated, Kč (`vydaje_kons`). */
  expenditureCzk: number | null;
  /** Capital (investment) expenditures, consolidated, Kč (`kapitalove_vydaje_kons`). */
  capexCzk: number | null;
  /** Budget balance, consolidated, Kč (`saldo_kons`). */
  saldoCzk: number | null;
  /** Population MONITOR attaches to the period (`obyvatele`). */
  population: number | null;
}

/* ── Pure parsers (fixture-tested; no IO) ─────────────────────────────────────── */

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function finiteNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Parse `/api/obdobi`. Malformed entries are dropped, not guessed at. */
export function parsePeriods(json: unknown): MonitorPeriod[] {
  if (!Array.isArray(json)) return [];
  const out: MonitorPeriod[] = [];
  for (const raw of json) {
    if (!isRecord(raw)) continue;
    const loadID = finiteNumber(raw.loadID);
    const year = finiteNumber(raw.year);
    if (loadID === null || year === null) continue;
    out.push({
      loadID,
      year,
      month: typeof raw.month === "string" ? raw.month : "",
      finM: raw.finM === true,
    });
  }
  return out;
}

/** Latest period (highest loadID) with municipal FIN 2-12 M data, or null. */
export function latestFinMPeriod(periods: MonitorPeriod[]): MonitorPeriod | null {
  let best: MonitorPeriod | null = null;
  for (const p of periods) {
    if (!p.finM) continue;
    if (best === null || p.loadID > best.loadID) best = p;
  }
  return best;
}

/** Parse one `/api/kraj/obce` row. Returns null (drop-don't-guess, README §① rule)
 *  when the IČO is not 8 digits or any field the mirror depends on is missing. */
export function parseMunicipality(raw: unknown): MonitorMunicipality | null {
  if (!isRecord(raw)) return null;
  const ic = typeof raw.ic === "string" ? raw.ic : null;
  if (ic === null || !/^\d{8}$/.test(ic)) return null;
  const name = typeof raw.name === "string" ? raw.name : null;
  const population = finiteNumber(raw.population);
  const region = isRecord(raw.region) ? raw.region : null;
  const krajNuts = region && typeof region.nuts === "string" ? region.nuts : null;
  if (name === null || population === null || krajNuts === null) return null;
  const shortName = typeof raw.shortName === "string" && raw.shortName.length > 0 ? raw.shortName : name;
  const krajName =
    region && typeof region.fullname === "string" ? region.fullname
    : region && typeof region.name === "string" ? region.name
    : "";
  return {
    ic,
    name,
    shortName,
    population,
    krajNuts,
    krajName,
    county: typeof raw.county === "string" ? raw.county : "",
  };
}

/** Parse a full `/api/kraj/obce` response body; malformed rows are dropped and
 *  counted so a batch caller can decide whether the drop rate is alarming. */
export function parseMunicipalities(json: unknown): { rows: MonitorMunicipality[]; dropped: number } {
  if (!Array.isArray(json)) return { rows: [], dropped: 0 };
  const rows: MonitorMunicipality[] = [];
  let dropped = 0;
  for (const raw of json) {
    const row = parseMunicipality(raw);
    if (row) rows.push(row);
    else dropped++;
  }
  return { rows, dropped };
}

/** Extract the mirror's indicator subset from one `/api/ukazatele` response.
 *  Each indicator arrives as `{ name, value, … }` keyed by its name; an absent key
 *  or non-numeric value maps to null — the mirror renders the gap, never a 0. */
export function extractBudgetYear(json: unknown): MonitorBudgetYear {
  const pick = (key: string): number | null => {
    if (!isRecord(json)) return null;
    const entry = json[key];
    if (!isRecord(entry)) return null;
    return finiteNumber(entry.value);
  };
  return {
    debtCzk: pick("dluh"),
    expenditureCzk: pick("vydaje_kons"),
    capexCzk: pick("kapitalove_vydaje_kons"),
    saldoCzk: pick("saldo_kons"),
    population: pick("obyvatele"),
  };
}

/* ── Per-capita / ratio derivations (pure; shared by ingest and surface) ─────── */

/** Kč per resident, rounded to whole Kč. Null in → null out; population 0 → null
 *  (division by zero is a data gap, not an infinite debt). */
export function perCapita(valueCzk: number | null, population: number | null): number | null {
  if (valueCzk === null || population === null || population <= 0) return null;
  return Math.round(valueCzk / population);
}

/** Capital / total expenditures as %, one decimal. Null in → null out. */
export function capexRatioPct(capexCzk: number | null, expenditureCzk: number | null): number | null {
  if (capexCzk === null || expenditureCzk === null || expenditureCzk <= 0) return null;
  return Math.round((capexCzk / expenditureCzk) * 1000) / 10;
}

/* ── IO client (fetch injectable — tests never hit the network) ──────────────── */

export interface MonitorClientOptions {
  fetchImpl?: typeof fetch;
  baseUrl?: string;
}

async function fetchJsonWithRetry(
  fetchImpl: typeof fetch,
  url: string,
  maxRetries = 2,
): Promise<unknown> {
  const backoff = (attempt: number) => new Promise((r) => setTimeout(r, Math.min(4_000, 500 * 2 ** attempt)));
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetchImpl(url, {
        headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
        signal: AbortSignal.timeout(30_000),
      });
      if ((res.status === 429 || res.status === 503) && attempt < maxRetries) {
        await backoff(attempt);
        continue;
      }
      if (!res.ok) throw new Error(`MONITOR → ${res.status} (${url})`);
      return (await res.json()) as unknown;
    } catch (e) {
      if (attempt >= maxRetries) throw e;
      await backoff(attempt);
    }
  }
}

/** Snapshot of one town's indicator years, as harvested. */
export interface MonitorTownSnapshot {
  ic: string;
  /** Keyed by year (2021…), in ascending order of the `years` array passed in. */
  byYear: Map<number, MonitorBudgetYear>;
}

export class MonitorClient {
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl: string;

  constructor(opts: MonitorClientOptions = {}) {
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
  }

  async fetchPeriods(): Promise<MonitorPeriod[]> {
    return parsePeriods(await fetchJsonWithRetry(this.fetchImpl, `${this.baseUrl}/obdobi`));
  }

  /** All municipalities of one kraj at one period. Throws on drift/HTTP failure. */
  async fetchMunicipalities(krajNuts: string, obdobi: number): Promise<MonitorMunicipality[]> {
    const url = `${this.baseUrl}/kraj/obce?obdobi=${obdobi}&nuts=${encodeURIComponent(krajNuts)}`;
    const { rows, dropped } = parseMunicipalities(await fetchJsonWithRetry(this.fetchImpl, url));
    if (dropped > 0) {
      // A handful of malformed rows is survivable; a mostly-dropped kraj is drift.
      if (rows.length === 0 || dropped > rows.length) {
        throw new Error(`[monitor] ${krajNuts}: dropped ${dropped} of ${rows.length + dropped} rows — shape drift?`);
      }
      console.warn(`[monitor] ${krajNuts}: dropped ${dropped} malformed municipality rows`);
    }
    return rows;
  }

  /** The full national register — 14 kraj requests, ~6,254 rows. */
  async harvestMunicipalityRegistry(obdobi: number): Promise<MonitorMunicipality[]> {
    const all: MonitorMunicipality[] = [];
    for (const nuts of KRAJ_NUTS) {
      all.push(...(await this.fetchMunicipalities(nuts, obdobi)));
    }
    return all;
  }

  /** One town × one period indicator subset. */
  async fetchBudgetYear(ic: string, obdobi: number): Promise<MonitorBudgetYear> {
    const url = `${this.baseUrl}/ukazatele?ic=${encodeURIComponent(ic)}&obdobi=${obdobi}`;
    return extractBudgetYear(await fetchJsonWithRetry(this.fetchImpl, url));
  }

  /**
   * Bounded indicator harvest: `icos × years`, year → loadID = (year % 100) * 100 + 12
   * (annual FIN 2-12 M = the December period). The CALLER bounds `icos` — this method
   * deliberately has no "all municipalities" convenience, because 6,254 × N years is a
   * standing batch job, not an in-session call (see the header's scale discipline).
   */
  async harvestBudgetSnapshots(
    icos: readonly string[],
    years: readonly number[],
    opts: { concurrency?: number } = {},
  ): Promise<MonitorTownSnapshot[]> {
    const concurrency = Math.max(1, opts.concurrency ?? 6);
    const jobs: { ic: string; year: number }[] = [];
    for (const ic of icos) for (const year of years) jobs.push({ ic, year });
    const byIc = new Map<string, MonitorTownSnapshot>();
    for (const ic of icos) byIc.set(ic, { ic, byYear: new Map() });
    let next = 0;
    const worker = async () => {
      while (next < jobs.length) {
        const job = jobs[next++];
        const loadID = (job.year % 100) * 100 + 12;
        const snap = await this.fetchBudgetYear(job.ic, loadID);
        byIc.get(job.ic)?.byYear.set(job.year, snap);
      }
    };
    await Promise.all(Array.from({ length: concurrency }, worker));
    return [...byIc.values()];
  }
}
