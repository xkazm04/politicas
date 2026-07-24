// FollowTheMoney feed adapter — the PURE layer that turns Hlídač státu + ARES
// responses into the three typed feeds buildMoneyGraph (lib/analysis/kg-money.ts)
// consumes: Company[], Contract[], PersonCompanyLink[]. This is the adapter kg-money
// declares as its one remaining data dependency ("F6 stays blocked on it").
//
// TRUST IS THE PRODUCT — this module links real MPs to real companies and public
// money, so the hard rule bites hardest here. Two disciplines are baked in:
//
//  1. NO SELF-FABRICATED IČO. Hlídač attributes a politician to a company by a DIRTY
//     free-text name ("AGROFERT a.s." / "AGROFERT, a.s." / "AGROFERT HOLDING, a.s."),
//     never an IČO. This module does NOT guess the IČO from the name. It hands the
//     name to an injected `resolveIco` (ARES-backed, the caller's IO) and, when that
//     returns nothing, DROPS the link rather than invent one. The IČO is the reliable
//     hinge; a name is only a lead.
//  2. THE HUMAN GATE. Every person↔company link this module builds is
//     `pending_review`. Even an ARES-VR officer-record corroboration only annotates
//     the provenance and raises reviewer confidence — it never auto-promotes to
//     `verified`. Only a human does that (kg-money's contract).
//
// PURE + DB-free: the parsers, the identity bridge, and the gated link builder take
// typed inputs and injected resolvers and return descriptors. The thin HlidacClient/
// AresClient at the bottom are the ONLY IO, kept separate so the graph-bearing logic
// is fully fixture-tested. It must NEVER be run on invented data.

import type { Company, Contract, PersonCompanyLink } from "@/lib/analysis/kg-money";

/* ── raw response shapes (only the fields we read) ──────────────────────────── */

/** `/osoby/hledatFtx?ftxDotaz=` hit. */
export interface HlidacPersonHit {
  jmeno?: string;
  prijmeni?: string;
  narozeni?: string; // "1954-09-02T00:00:00"
  nameId?: string; // slug PK
}
/** One `udalosti[]` entry on `/osoby/{slug}`. */
export interface HlidacEvent {
  typ?: string; // "Soukromá pracovní" = the private-sector role (the company tie)
  organizace?: string; // DIRTY company name — never an IČO
  role?: string; // "akcionář" / "jednatel" / "statutární orgán" / …
  castka?: number | null;
  datumOd?: string | null;
  datumDo?: string | null; // empty/absent = ongoing
}
export interface HlidacPersonDetail {
  jmeno?: string;
  prijmeni?: string;
  narozeni?: string;
  nameId?: string;
  udalosti?: HlidacEvent[];
}
/** One `results[]` entry on `/smlouvy/hledat`. */
export interface HlidacContractResult {
  identifikator?: { idSmlouvy?: string; idVerze?: string };
  predmet?: string | null;
  hodnotaBezDph?: number | null;
  hodnotaVcetneDph?: number | null;
  calculatedPriceWithVATinCZK?: number | null;
  datumUzavreni?: string | null;
  platce?: { ico?: string; nazev?: string } | null; // authority (payer)
  prijemce?: { ico?: string; nazev?: string }[] | null; // supplier(s)
  odkaz?: string | null;
}
export interface HlidacContractSearch {
  total?: number;
  page?: number;
  results?: HlidacContractResult[];
}
/** `/firmy/ico/{ico}`. */
export interface HlidacFirma {
  ico?: string;
  jmeno?: string;
}
/** ARES `/ekonomicke-subjekty/{ico}`. */
export interface AresSubject {
  ico?: string;
  obchodniJmeno?: string;
}

/** Our own psp.cz person, supplied by the caller (keeps this module DB-free). */
export interface RosterPerson {
  personPspId: number;
  firstName: string;
  lastName: string;
  birthDate: string | null; // ISO "yyyy-mm-dd" or null (publisher's unknown sentinel)
}

/* ── pure helpers ───────────────────────────────────────────────────────────── */

/** "1954-09-02T00:00:00" → "1954-09-02"; null/empty → null. */
export function isoDay(s: string | null | undefined): string | null {
  if (!s) return null;
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(s.trim());
  return m ? m[1] : null;
}

/** Diacritic-fold + lowercase + collapse whitespace — for name comparison only. */
export function foldLower(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const LEGAL_FORMS = [
  "akciová společnost",
  "společnost s ručením omezeným",
  "spol. s r.o.",
  "spol. s r. o.",
  "a.s.",
  "a. s.",
  "s.r.o.",
  "s. r. o.",
  "z.ú.",
  "z.s.",
  "o.p.s.",
  "k.s.",
  "v.o.s.",
  "se",
  "družstvo",
];

/**
 * Normalize a company name to a comparison key: fold, lowercase, strip a trailing
 * legal form and stray punctuation. NOTE this is intentionally NOT used to MINT an
 * IČO — it only helps an injected resolver compare candidates. "AGROFERT, a.s." and
 * "AGROFERT a.s." fold to the same key; "AGROFERT HOLDING, a.s." does NOT (a different
 * legal entity), which is correct — the resolver, not a fuzzy guess here, decides.
 */
export function normalizeCompanyName(name: string): string {
  let s = foldLower(name).replace(/[,;]/g, " ").replace(/\s+/g, " ").trim();
  for (const form of LEGAL_FORMS) {
    const f = foldLower(form);
    if (s.endsWith(" " + f)) {
      s = s.slice(0, -(f.length + 1)).trim();
      break;
    }
  }
  return s.replace(/\s+/g, " ").trim();
}

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/* ── parsers (raw JSON → typed) ─────────────────────────────────────────────── */

export function parsePersonSearch(raw: unknown): HlidacPersonHit[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x): x is HlidacPersonHit => !!x && typeof x === "object")
    .map((h) => ({ jmeno: h.jmeno, prijmeni: h.prijmeni, narozeni: h.narozeni, nameId: h.nameId }));
}

/** The private-sector role events (`typ="Soukromá pracovní"`) — the company ties. */
export function privateRoleEvents(detail: HlidacPersonDetail): HlidacEvent[] {
  return (detail.udalosti ?? []).filter(
    (e) => e.typ === "Soukromá pracovní" && !!e.organizace && !!e.organizace.trim(),
  );
}

/**
 * Contracts from a `/smlouvy/hledat` page, as company→contract feed rows. Amount is
 * Hlídač's normalized CZK price, falling back to the with-VAT then without-VAT figure;
 * a contract with no disclosed price keeps `amount: null` (surfaced, never zero-faked).
 *
 * `supplierIco` scopes to money FLOWING TO a company: when given, only results whose
 * `prijemce` (supplier) includes that IČO are emitted, each tagged with it. Without it,
 * one Contract is emitted per (result × prijemce) so the graph can link each supplier.
 * Deduped by `idSmlouvy`, keeping the latest version (`idVerze`).
 */
export function parseContracts(raw: unknown, opts: { supplierIco?: string } = {}): Contract[] {
  const search = (raw ?? {}) as HlidacContractSearch;
  const results = search.results ?? [];
  const byId = new Map<string, { c: Contract; ver: number }>();

  const amountOf = (r: HlidacContractResult): number | null =>
    isNum(r.calculatedPriceWithVATinCZK)
      ? r.calculatedPriceWithVATinCZK
      : isNum(r.hodnotaVcetneDph)
        ? r.hodnotaVcetneDph
        : isNum(r.hodnotaBezDph)
          ? r.hodnotaBezDph
          : null;

  for (const r of results) {
    const id = r.identifikator?.idSmlouvy;
    if (!id) continue;
    const ver = Number(r.identifikator?.idVerze ?? "0") || 0;
    const suppliers = (r.prijemce ?? []).map((p) => p?.ico).filter((x): x is string => !!x);
    const targets = opts.supplierIco
      ? suppliers.filter((ico) => ico === opts.supplierIco)
      : suppliers;
    if (!targets.length) continue;

    for (const supplierIco of targets) {
      const key = `${id}::${supplierIco}`;
      const prev = byId.get(key);
      if (prev && prev.ver >= ver) continue;
      byId.set(key, {
        ver,
        c: {
          id,
          supplierIco,
          amount: amountOf(r),
          signedOn: isoDay(r.datumUzavreni),
          subject: r.predmet?.trim() || null,
        },
      });
    }
  }
  return [...byId.values()].map((v) => v.c);
}

export function parseAresCompany(raw: unknown): Company | null {
  const s = (raw ?? {}) as AresSubject;
  if (!s.ico || !s.obchodniJmeno) return null;
  return { ico: s.ico, name: s.obchodniJmeno };
}

export function parseHlidacCompany(raw: unknown): Company | null {
  const s = (raw ?? {}) as HlidacFirma;
  if (!s.ico || !s.jmeno) return null;
  return { ico: s.ico, name: s.jmeno };
}

/** One ARES name-search candidate. */
export interface AresCandidate {
  ico?: string;
  obchodniJmeno?: string;
}
/** ARES `/ekonomicke-subjekty/vyhledat` → candidate list. */
export function parseAresSearch(raw: unknown): AresCandidate[] {
  const d = (raw ?? {}) as { ekonomickeSubjekty?: AresCandidate[] };
  return (d.ekonomickeSubjekty ?? [])
    .filter((c): c is AresCandidate => !!c && typeof c === "object")
    .map((c) => ({ ico: c.ico, obchodniJmeno: c.obchodniJmeno }));
}

/**
 * Resolve a dirty company name to an authoritative IČO — the STRICT resolver the
 * FollowTheMoney pipeline hands to `buildPersonCompanyLinks`. It accepts an IČO ONLY
 * when exactly ONE candidate's normalized name equals the query's normalized name;
 * anything ambiguous or merely similar returns null (the link is then dropped, never
 * guessed). This is what keeps "AGROFERT" from wrongly binding to "AGROFERT HOLDING":
 * they normalize to different keys, so no exact match, so no fabricated IČO.
 */
export function pickExactIco(name: string, candidates: readonly AresCandidate[]): string | null {
  const key = normalizeCompanyName(name);
  const hits = candidates.filter(
    (c) => c.ico && c.obchodniJmeno && normalizeCompanyName(c.obchodniJmeno) === key,
  );
  return hits.length === 1 ? hits[0].ico! : null;
}

/* ── identity bridge: Hlídač person slug → our psp.cz personId ──────────────── */

export interface PersonBridge {
  personPspId: number;
  matchedOn: "birthdate"; // only high-confidence matches are returned
}

/**
 * Resolve a Hlídač person to a psp.cz person id. CONSERVATIVE by design: it requires
 * BOTH a folded name match AND an exact birth-date match, and refuses on ambiguity —
 * a wrong person↔company link is a far worse failure than a missed one. Returns null
 * when the birth date is unavailable on either side (cannot confirm) or when more than
 * one roster person fits.
 */
export function bridgePerson(
  hit: { jmeno?: string; prijmeni?: string; narozeni?: string },
  roster: readonly RosterPerson[],
): PersonBridge | null {
  const day = isoDay(hit.narozeni);
  if (!day || !hit.jmeno || !hit.prijmeni) return null;
  const first = foldLower(hit.jmeno);
  const last = foldLower(hit.prijmeni);

  const fits = roster.filter(
    (p) =>
      p.birthDate === day &&
      foldLower(p.firstName) === first &&
      foldLower(p.lastName) === last,
  );
  return fits.length === 1 ? { personPspId: fits[0].personPspId, matchedOn: "birthdate" } : null;
}

/* ── gated person↔company link builder ──────────────────────────────────────── */

/** Resolve a dirty company name to an authoritative IČO (ARES-backed). Injected so
 *  this module never mints one. Return null when the name can't be resolved. */
export type IcoResolver = (companyName: string) => string | null;
/** Optionally confirm a person is an officer/owner of an IČO in ARES VR (the official
 *  register). Injected; a true result annotates provenance but NEVER auto-verifies. */
export type OfficerCorroborator = (personPspId: number, ico: string) => boolean;

export interface BuildLinksOptions {
  resolveIco: IcoResolver;
  corroborate?: OfficerCorroborator;
}

/**
 * Person↔company links from one Hlídač person detail, for an ALREADY-BRIDGED psp id.
 * Each private-role event's company name is resolved to an IČO by the injected
 * resolver; an unresolved name is DROPPED (never fabricated). Every emitted link is
 * `pending_review`; corroboration only enriches the `source` provenance. Deduped by
 * (ico, role).
 */
export function buildPersonCompanyLinks(
  detail: HlidacPersonDetail,
  personPspId: number,
  opts: BuildLinksOptions,
): PersonCompanyLink[] {
  const slug = detail.nameId ?? "?";
  const out = new Map<string, PersonCompanyLink>();

  for (const e of privateRoleEvents(detail)) {
    const name = e.organizace!.trim();
    const ico = opts.resolveIco(name);
    if (!ico) continue; // no authoritative IČO → not a fact, drop it

    const role = e.role?.trim() || "vazba";
    const key = `${ico}::${role}`;
    if (out.has(key)) continue;

    const from = isoDay(e.datumOd);
    const to = isoDay(e.datumDo);
    const period = `${from ?? "?"}–${to ?? "ongoing"}`;
    const corroborated = opts.corroborate?.(personPspId, ico) === true;

    const source =
      `hlidac:osoby/${slug} · udalosti[Soukromá pracovní] · "${name}"→IČO ${ico} · ${period}` +
      (corroborated ? " · ARES-VR-officer-confirmed" : "");

    out.set(key, {
      personPspId,
      ico,
      role,
      source,
      state: "pending_review", // the human gate — corroboration does not lift it
    });
  }
  return [...out.values()];
}

/* ── dedupe helpers for assembling a feed from many pages/people ────────────── */

export function dedupeCompanies(companies: readonly Company[]): Company[] {
  const byIco = new Map<string, Company>();
  for (const c of companies) if (c.ico && !byIco.has(c.ico)) byIco.set(c.ico, c);
  return [...byIco.values()];
}

export function dedupeContracts(contracts: readonly Contract[]): Contract[] {
  const byId = new Map<string, Contract>();
  for (const c of contracts) byId.set(`${c.id}::${c.supplierIco}`, c);
  return [...byId.values()];
}

/* ── the IO edge: thin clients (the ONLY non-pure code here) ────────────────── */

export interface HlidacClientOptions {
  token: string;
  base?: string;
  fetchImpl?: typeof fetch;
}

/** Thin Hlídač REST client. Rate-limit/throttle is the CALLER's concern (the API
 *  exposes no quota headers) — this only shapes requests and returns raw JSON. */
export class HlidacClient {
  private readonly base: string;
  private readonly token: string;
  private readonly doFetch: typeof fetch;
  constructor(opts: HlidacClientOptions) {
    this.base = (opts.base ?? "https://api.hlidacstatu.cz/Api/v2").replace(/\/+$/, "");
    this.token = opts.token;
    this.doFetch = opts.fetchImpl ?? fetch;
  }
  private async get(path: string): Promise<unknown> {
    const res = await this.doFetch(`${this.base}${path}`, {
      headers: { Authorization: `Token ${this.token}`, Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`Hlidac ${path} → ${res.status} ${res.statusText}`);
    return res.json();
  }
  personSearch(name: string): Promise<unknown> {
    return this.get(`/osoby/hledatFtx?ftxDotaz=${encodeURIComponent(name)}`);
  }
  personDetail(slug: string): Promise<unknown> {
    return this.get(`/osoby/${encodeURIComponent(slug)}`);
  }
  contractsByIco(ico: string, page = 1): Promise<unknown> {
    return this.get(`/smlouvy/hledat?dotaz=${encodeURIComponent(`ico:${ico}`)}&strana=${page}&razeni=2`);
  }
  firmaByIco(ico: string): Promise<unknown> {
    return this.get(`/firmy/ico/${encodeURIComponent(ico)}`);
  }
}

export interface AresClientOptions {
  base?: string;
  fetchImpl?: typeof fetch;
}

/** Thin ARES client — no account needed; respect ~500 req/min (caller-throttled). */
export class AresClient {
  private readonly base: string;
  private readonly doFetch: typeof fetch;
  constructor(opts: AresClientOptions = {}) {
    this.base = (opts.base ?? "https://ares.gov.cz/ekonomicke-subjekty-v-be/rest").replace(/\/+$/, "");
    this.doFetch = opts.fetchImpl ?? fetch;
  }
  async subject(ico: string): Promise<unknown> {
    const res = await this.doFetch(`${this.base}/ekonomicke-subjekty/${encodeURIComponent(ico)}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`ARES ${ico} → ${res.status} ${res.statusText}`);
    return res.json();
  }
  /** Name search — POST /ekonomicke-subjekty/vyhledat {obchodniJmeno}. Feeds pickExactIco. */
  async subjectSearch(obchodniJmeno: string, pocet = 20): Promise<unknown> {
    const res = await this.doFetch(`${this.base}/ekonomicke-subjekty/vyhledat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ obchodniJmeno, pocet }),
    });
    if (!res.ok) throw new Error(`ARES search "${obchodniJmeno}" → ${res.status} ${res.statusText}`);
    return res.json();
  }
}
