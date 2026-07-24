/* Case ③ Law loop — batch-002 company sector-adjacency heuristic.
 *
 * batch-001 found the raw sponsor_contract_czk conflict signal is saturated by
 * municipal/state-owned-enterprise board roles (ARENA BRNO, Pražské služby, Operátor
 * ICT, ČEPRO — all publicly owned; 8/8 top-flagged bills, 0 real conflicts). The graph
 * has NO NACE/sector code on company nodes (money-feed.ts joins Hlídač+ARES+Registr
 * smluv but does not carry a business-activity classification), so this module supplies
 * a bounded, reviewable, NAME-BASED heuristic over the 157 companies actually tied to
 * sponsors of the 65 flagged bills (batch-002 scope) — not a claim of completeness, a
 * documented pre-filter. Two parts:
 *
 *   1. MUNICIPAL_SOE — keyword regex (broad net: "města"/"kraje"/"s.p."/"nemocnice"/
 *      "vodovody"/"teplárny"/"o.p.s."/"z.s."/"nadace"/public broadcasters/health
 *      insurer/…) + an explicit list for known cases the regex would miss (ČEPRO,
 *      MERO ČR, Pražská energetika — all state/municipal-majority utilities). A company
 *      flagged here is EXCLUDED from the sector-adjacency conflict signal: a board seat
 *      on a public utility/hospital/foundation is not a self-dealing channel.
 *   2. SECTOR_OVERRIDES — a small explicit map for companies whose real-world sector is
 *      NOT recoverable from the legal name alone (AGROFERT's chemical subsidiaries
 *      Synthesia/Fatra/Precheza/Lovochemie, CS Cabot, Robert Bosch, …), sourced from
 *      well-known public facts (these are large, publicly documented Czech companies —
 *      not invented). Falls back to a keyword regex on the label for everything else;
 *      unrecognized names → sector `null` (excluded from adjacency, not misclassified).
 *
 * Sectors reuse the SAME domain buckets triage.ts already uses for the law/committee
 * side (THEME_KEYWORDS), so a company's sector can be compared directly against an
 * amended law's domain bucket.
 */

export type Sector =
  | "environment"
  | "economy"
  | "health"
  | "justice"
  | "education"
  | "social"
  | "security"
  | "agriculture"
  | "transport"
  | "digital";

const MUNICIPAL_SOE_PATTERNS: RegExp[] = [
  /měst[aoyu]|městsk/i,
  /\bobc[eíí]\b|obecně prospěšná/i,
  /\bkraj|krajsk/i,
  /státní podnik|\bs\.\s?p\.\b/i,
  /příspěvková organizace|\bp\.\s?o\.\b/i,
  /dopravní podnik/i,
  /nemocnice|poliklinika|léčebné lázně|zdravotnická záchranná služba|vojenská nemocnice/i,
  /vodovody a kanalizace|vodáren|vodárn/i,
  /teplárn/i,
  /^povodí/i,
  /technické služby|lesy (a parky|měst)/i,
  /univerzit|gymnázium|vzdělávací centrum|vysoká škola/i,
  /muzeum|galerie|filharmonie|hvězdárna|planetárium|techmania|výstaviště|smetanova litomýšl/i,
  /^všeobecná zdravotní pojišťovna|^pojišťovna vzp/i,
  /svaz měst|sdružení měst|regionální rozvojová agentura|krajská hospodářská komora|^rera\b/i,
  /společenství vlastníků/i,
  /^český rozhlas$|^česká televize$/i,
  /chráněná dílna|domovinka|skp-centrum|sociální služby/i,
  /^nadace|nadační fond|z\.\s?ú\.\b|z\.\s?s\.\b|občanské sdružení/i,
  /^sdružení\b/i,
  /^muzeum|paměti xx\. století/i,
  /svaz\b|asociace|komora\b/i,
  /^škola|gymnázium/i,
];
const MUNICIPAL_SOE_EXPLICIT = new Set([
  "ČEPRO, a.s.",
  "MERO ČR, a.s.",
  "Pražská energetika, a.s.",
  "Kongresové centrum Praha, a.s.",
  "Krajská zdravotní, a.s.",
  "Krajská nemocnice T. Bati, a. s.",
  // batch-002 army (tisk 11 dossier) independently confirmed 100% city-of-Chomutov ownership —
  // the generic "měst…" keyword regex misses it because "Chomutovská" doesn't contain that
  // substring (it's derived from the city name Chomutov, not the word "město"). A real gap:
  // city-name-derived adjectives aren't catchable by a generic keyword net; explicit-list only.
  "CHOMUTOVSKÁ BYTOVÁ a.s.",
]);

export function isMunicipalOrSoe(label: string): boolean {
  if (MUNICIPAL_SOE_EXPLICIT.has(label)) return true;
  return MUNICIPAL_SOE_PATTERNS.some((re) => re.test(label));
}

/** Explicit, source-documented overrides for companies a name-keyword regex cannot classify. */
const SECTOR_OVERRIDES: Record<string, Sector> = {
  "AGROFERT, a.s.": "agriculture", // conglomerate; agri/food is its plurality segment
  "Synthesia, a.s.": "environment", // chemicals/explosives (Agrofert) — bucketed w/ environment (emis/chemical)
  "Fatra, a.s.": "environment", // plastics/chemicals (Agrofert)
  "PRECHEZA a.s.": "environment", // titanium-dioxide chemicals (Agrofert)
  "Lovochemie, a.s.": "agriculture", // agrochemical fertilizer (Agrofert)
  "Kostelecké uzeniny a.s.": "agriculture", // meat processing (Agrofert)
  "SPOLANA s.r.o.": "environment", // chemicals
  "CS CABOT, spol. s r.o.": "environment", // carbon-black chemicals
  "Robert Bosch, spol. s r.o.": "economy", // automotive/industrial manufacturing
  "ZPS holding s.r.o.": "economy", // machine-tool manufacturing
  "NEXNET, a.s.": "digital", // telecom/fibre infrastructure
  "IMOBA, a.s.": "economy", // real estate
  "SOMPO, a.s.": "economy", // insurance/finance
  "ČSOB Pojišťovna, a. s., člen holdingu ČSOB": "economy", // private insurer (name contains "pojišťovna" but NOT the public VZP one)
  "COMBIN BOHEMIA spol. s r.o.": "economy", // construction
  "Energie - stavební a báňská a.s.": "environment", // construction/mining/energy
  "EAST BOHEMIAN AIRPORT a.s.": "transport",
  "Teleky Medicus s.r.o.": "health",
  "SynBiol, a.s.": "health", // biotech
  "Národní Centrum Tkání a Buněk a.s.": "health",
  // NOTE: CHOMUTOVSKÁ BYTOVÁ a.s. was here as "economy" (housing/real estate) until batch-002's
  // army independently confirmed it's 100% city-of-Chomutov owned — moved to
  // MUNICIPAL_SOE_EXPLICIT above; isMunicipalOrSoe() short-circuits before sectorOf() is reached.
};

const SECTOR_KEYWORDS: Record<Sector, RegExp[]> = {
  agriculture: [/agro/i, /zeměděl/i, /potravin/i, /uzenin/i, /chov\b/i, /les(y|ní)/i],
  environment: [/chemi/i, /ekolog/i, /odpad/i, /životní/i, /energ/i, /báňsk/i],
  economy: [/holding/i, /invest/i, /facility/i, /consult/i, /reality|nemovitost/i, /stavební|stavby/i, /finan/i],
  health: [/zdravotn/i, /medic/i, /farmaceut/i, /biotech|biolog/i],
  digital: [/digit|IT\b|informač|telekomunik|software|net\b/i],
  transport: [/doprav|logistik|airport|letišt/i],
  justice: [],
  education: [],
  social: [],
  security: [],
};

/** Coarse, best-effort sector for a company label. `null` = unrecognized (excluded from adjacency scoring). */
export function sectorOf(label: string): Sector | null {
  if (SECTOR_OVERRIDES[label]) return SECTOR_OVERRIDES[label];
  for (const [sector, patterns] of Object.entries(SECTOR_KEYWORDS) as [Sector, RegExp[]][]) {
    if (patterns.some((re) => re.test(label))) return sector;
  }
  return null;
}
