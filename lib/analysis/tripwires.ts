// Hlídky grafu (tripwires) — deklarativní vzory, kterými graf hlídá sám sebe.
//
// ČISTÝ modul podle konvence lib/analysis/kg.ts a kg-money.ts: žádné DB ani
// server importy, vstupy jsou typované řádky, každý vzor je unit-testovaný
// (tripwires.test.ts) a loader (features/admin/getTripwireData.ts) zůstává
// tenkou IO slupkou. NIC SE NEZAPISUJE — kandidáti se odvozují znovu při
// každém čtení (precedens 4C, /penize/strety), žádná tabulka, žádný stav.
//
// DISCIPLÍNA OBVIŇUJÍCÍCH TVRZENÍ (batch-4 bod 17, batch-5 bod 22): výstup
// každé hlídky je KANDIDÁT PRO LIDSKOU REVIZI, nikdy zjištění. Souběh v čase
// nebo v rejstříku je fakt; věcná souvislost vyžaduje lidské ověření a bez něj
// se nesmí nikde tvrdit. Kandidáti se vykreslují JEN na interní ploše /admin
// (gated — AdminGate) s rámováním „vyžaduje lidské ověření" a odkazem do
// ověřovací konzole /penize/kontrola; kde se hlídka kryje s vypočteným střetem,
// odkazuje se i na /penize/strety#s-<id>.
//
// Každý vzor nese své pravidlo ČESKY A DOSLOVA (ruleCs) a plocha ho vykresluje
// vedle výsledků — tentýž závazek jako COLLISION_RULE_VERSION u strety.
//
// Pořadí kandidátů: ÚPLNOST DŮKAZŮ (evidence completeness), ne „závažnost".
// Hlídka neříká, co je horší — říká, u čeho má revizor nejvíc podkladů v ruce.
// Skóre je deterministický součet vyhlášených složek (EVIDENCE_PARTS) a jeho
// rozklad se vykresluje u každého kandidáta.

/* ── vstupní tvary (plní je loader, čistě z existujících čtecích cest) ────── */

export type TripwireReviewState = "verified" | "pending_review" | "rejected";

/** Zákon z vyhlášené tabulky relevance (statuteRelevance.ts) — jen se veze,
 *  tento modul tabulku nevlastní ani nerozšiřuje. */
export interface TripwireStatute {
  ref: string; // "134/2016"
  label: string;
  why: string; // "contracts" | "subsidies" | "donation" — cituje se doslova
}

/** Jedna vazba MP ↔ firma (linked_to hrana), projekce moneyLoaderu. */
export interface TripwireTieIn {
  edgeSrc: string;
  edgeDst: string;
  personPspId: number;
  personName: string;
  club: string | null;
  companyId: string;
  company: string;
  ico: string;
  role: string;
  tieClass: string;
  reviewState: TripwireReviewState;
  corroboration: string | null; // "registry-confirmed" | … | null
  roleValidFrom: string | null; // rejstříkové období role (ARES VR)
  roleValidTo: string | null;
  contractCount: number;
  contractCzk: number;
  subsidiesCzk: number;
  /** Pod hranicí materiality (isDeMinimis, reviewTypes.ts) — počítá loader,
   *  aby tenhle modul nedubloval konstantu 50 000 Kč. */
  deMinimis: boolean;
  /** Zákony kanálů veřejných peněz TÉTO firmy (relevantStatutesFor). */
  channelStatutes: readonly TripwireStatute[];
}

/** Hlasování už napojené na tisk, který novelizuje aspoň jeden zákon
 *  z tabulky relevance (napojení přes pořad schůze / titulek dělá loader,
 *  týmiž pravidly jako Vote-Collision Engine). */
export interface TripwireVoteIn {
  votePspId: number;
  votedOn: string; // YYYY-MM-DD
  voteTitle: string;
  sourceUrl: string;
  billCislo: number | null;
  billTitle: string;
  amendedRefs: readonly { ref: string; label: string }[];
}

/** Zpravodajské přiřazení (rapporteur hrana person → bill) s novelizovanými
 *  zákony toho tisku. */
export interface TripwireRapporteurIn {
  personPspId: number;
  billNodeId: string;
  billCislo: number | null;
  billTitle: string;
  amendedRefs: readonly { ref: string; label: string }[];
}

/** Majetkový podíl (owns_stake hrana company → company). */
export interface TripwireStakeIn {
  srcCompanyId: string;
  dstCompanyId: string;
  dstCompany: string;
  dstIco: string | null;
  stakePct: number | null;
  /** Smlouvy DRŽENÉ firmy (supplies agregát) — plní loader. */
  dstContractCount: number;
  dstContractCzk: number;
}

/** Živý kandidát střetu z /penize/strety — jen kvůli křížovému odkazu
 *  #s-<id> tam, kde se hlídka a střet kryjí na téže vazbě. */
export interface TripwireLiveCollision {
  id: string;
  edgeSrc: string;
  edgeDst: string;
}

export interface DeriveTripwiresInput {
  ties: readonly TripwireTieIn[];
  votes: readonly TripwireVoteIn[];
  rapporteurs: readonly TripwireRapporteurIn[];
  stakes: readonly TripwireStakeIn[];
  liveCollisions: readonly TripwireLiveCollision[];
  /** Hlasovací ledger prošel readiness floorem — pod ním loader hlasování
   *  vůbec nepodává a hlídka T1 je SLEPÁ, ne „bez nálezu". Výstup to přizná. */
  votesAvailable: boolean;
  /** Pořad schůze (schuze.zip) byl při napojování hlasování k dispozici —
   *  bez něj je hlídka T1 slabší a výstup to přizná. */
  agendaAvailable: boolean;
  /** /penize/strety se podařilo odvodit — bez toho chybí křížové odkazy. */
  collisionsAvailable: boolean;
}

/* ── registr vzorů: id + název + pravidlo DOSLOVA ─────────────────────────── */

/** Verze sady pravidel — mění se s KAŽDOU změnou vzoru nebo skóre, aby dvě
 *  různě odvozené fronty nešly zaměnit. */
export const TRIPWIRE_RULE_VERSION = "hlidky-v1";

export const TRIPWIRE_PATTERN_IDS = [
  "tie-vote-window",
  "unverified-contracts",
  "rapporteur-channel",
  "ownership-chain",
] as const;
export type TripwirePatternId = (typeof TRIPWIRE_PATTERN_IDS)[number];

export interface TripwirePatternDef {
  id: TripwirePatternId;
  titleCs: string;
  /** Pravidlo vzoru, česky a doslova — plocha ho vykresluje vedle výsledků. */
  ruleCs: string;
}

export const TRIPWIRE_PATTERNS: readonly TripwirePatternDef[] = [
  {
    id: "tie-vote-window",
    titleCs: "Nová vazba v okně peněžního hlasování",
    ruleCs:
      "Vazba čeká na lidské ověření (pending_review), roli potvrdil obchodní rejstřík " +
      "(registry-confirmed) se známým začátkem období, firma má aspoň jeden kanál veřejných " +
      "peněz (zakázky/dotace/dary) a v rejstříkovém období role proběhlo aspoň jedno hlasování " +
      "o tisku novelizujícím zákon toho kanálu (oba krajní dny včetně). Jak poslanec hlasoval " +
      "se tu neposuzuje — pozice se počítá až po ověření vazby na /penize/strety.",
  },
  {
    id: "unverified-contracts",
    titleCs: "Veřejné smlouvy u neověřené vazby",
    ruleCs:
      "Vazba čeká na lidské ověření (pending_review) a firma už má v registru smluv aspoň " +
      "jednu smlouvu s dosažitelnými penězi nad hranicí materiality (50 000 Kč, isDeMinimis). " +
      "Veřejné peníze už tečou, zatímco tvrzení o vazbě ještě nikdo nepotvrdil ani nevyvrátil.",
  },
  {
    id: "rapporteur-channel",
    titleCs: "Zpravodaj tisku dotýkajícího se kanálu vlastní firmy",
    ruleCs:
      "Poslanec s nezamítnutou vazbou na firmu je zpravodajem tisku, který novelizuje zákon " +
      "kanálu veřejných peněz té firmy (tabulka relevance jako u střetů). Přiřazení zpravodaje " +
      "nenese v datech psp.cz datum, takže se časový překryv s obdobím role netvrdí — jen " +
      "souběh rolí, který má posoudit člověk.",
  },
  {
    id: "ownership-chain",
    titleCs: "Smlouvy v majetkovém řetězci vazby",
    ruleCs:
      "Firma s nezamítnutou vazbou na poslance drží podle grafu podíl (owns_stake) v jiné " +
      "firmě, která má v registru smluv aspoň jednu smlouvu. Řetězec je jeden krok (A drží B); " +
      "delší řetězce se netvrdí. Zda podíl znamená vliv na zakázky, musí posoudit člověk.",
  },
] as const;

/* ── výstupní tvary ───────────────────────────────────────────────────────── */

/** Jedna vyhlášená složka skóre úplnosti důkazů. */
export interface EvidencePart {
  labelCs: string;
  pts: number;
}

export interface TripwireCandidate {
  /** Stabilní otisk klíče kandidáta (fnv-1a/32 nad kanonickým JSON — týž
   *  algoritmus jako exhibit.ts / collisionCandidateId). */
  id: string;
  pattern: TripwirePatternId;
  edgeSrc: string;
  edgeDst: string;
  personPspId: number;
  personName: string;
  club: string | null;
  companyId: string;
  company: string;
  ico: string;
  role: string;
  tieClass: string;
  reviewState: TripwireReviewState;
  corroboration: string | null;
  roleValidFrom: string | null;
  roleValidTo: string | null;
  /** Zákony z tabulky relevance, kterých se kandidát týká (může být prázdné
   *  u vzorů, které tabulku nepoužívají). */
  statutes: TripwireStatute[];
  /** Smlouvy firmy vazby + dosažitelné peníze (Kč) — čísla se formátují až na
   *  ploše (lib/format), tady zůstávají surová. */
  contractCount: number;
  reachableCzk: number;
  /** Úplnost důkazů: součet + rozklad po složkách, vykresluje se celý. */
  evidence: { score: number; parts: EvidencePart[] };
  /** T1: kolik hlasování padlo do okna a den posledního z nich. */
  votesMatched: number;
  latestVoteOn: string | null;
  /** T3: tisk, jehož je poslanec zpravodajem. */
  bill: { cislo: number | null; title: string } | null;
  /** T4: držená firma se smlouvami. */
  chain: {
    company: string;
    ico: string | null;
    stakePct: number | null;
    contractCount: number;
    contractCzk: number;
  } | null;
  /** Id kandidátů střetu (/penize/strety#s-<id>) na TÉŽE vazbě — křížový
   *  odkaz tam, kde se hlídka a střet kryjí. */
  stretyIds: string[];
}

export interface TripwirePatternResult {
  pattern: TripwirePatternId;
  titleCs: string;
  ruleCs: string;
  /** Kolik vazeb vzor skutečně prošel (brána vzoru) — poctivé číslo i při
   *  nule kandidátů: hlídka je nastražená, ne rozbitá. */
  examined: number;
  candidates: TripwireCandidate[];
}

export interface TripwireData {
  ruleVersion: string;
  votesAvailable: boolean;
  agendaAvailable: boolean;
  collisionsAvailable: boolean;
  patterns: TripwirePatternResult[];
  coverage: {
    tiesTotal: number;
    tiesPending: number;
    tiesRejected: number;
    votesLinkable: number;
    rapporteurAssignments: number;
    stakeEdges: number;
    liveCollisions: number;
    candidatesTotal: number;
  };
}

/* ── pomocné čisté funkce ─────────────────────────────────────────────────── */

/** Kanonický JSON (řazené klíče) — zrcadlí exhibit.canonicalJson, drženo
 *  lokálně, aby lib/analysis nezáviselo na features/*. */
function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map((v) => canonicalJson(v)).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
}

/** FNV-1a/32 nad UTF-8, 8 hex znaků — týž algoritmus jako exhibit.contentHash. */
function fnv1a(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let h = 0x811c9dc5;
  for (const b of bytes) {
    h ^= b;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/** Stabilní adresa kandidáta: vzor + hrana vazby + případný rozlišovací klíč
 *  (tisk u T3, držená firma u T4). */
export const tripwireCandidateId = (key: {
  pattern: TripwirePatternId;
  edgeSrc: string;
  edgeDst: string;
  extra?: string;
}): string => fnv1a(canonicalJson(key));

/** Den hlasování leží v rejstříkovém období role, OBA krajní dny včetně —
 *  totéž vyhlášené pravidlo jako voteInRolePeriod (statuteRelevance.ts),
 *  drženo lokálně kvůli vrstvení (lib nesmí importovat features). */
export function dayInRolePeriod(day: string, from: string, to: string | null): boolean {
  const d = day.slice(0, 10);
  if (d < from.slice(0, 10)) return false;
  if (to !== null && d > to.slice(0, 10)) return false;
  return true;
}

/** Peněžní složka skóre — vyhlášené prahy, žádná spojitá magie. */
function moneyPts(czk: number): number {
  if (czk >= 100_000_000) return 3;
  if (czk >= 10_000_000) return 2;
  if (czk >= 1_000_000) return 1;
  return 0;
}

/** Skóre ÚPLNOSTI DŮKAZŮ — deterministický součet vyhlášených složek.
 *  Vyšší = revizor má víc podkladů v ruce, ne „je to horší". */
export function evidenceScore(args: {
  corroboration: string | null;
  roleValidFrom: string | null;
  roleValidTo: string | null;
  reviewState: TripwireReviewState;
  matchedStatuteRefs: readonly string[];
  reachableCzk: number;
}): { score: number; parts: EvidencePart[] } {
  const parts: EvidencePart[] = [];
  if (args.corroboration === "registry-confirmed")
    parts.push({ labelCs: "roli potvrdil obchodní rejstřík", pts: 3 });
  if (args.roleValidFrom !== null)
    parts.push({ labelCs: "rejstřík zná začátek období role", pts: 2 });
  if (args.roleValidTo !== null)
    parts.push({ labelCs: "rejstřík zná konec období role", pts: 1 });
  if (args.reviewState === "verified")
    parts.push({ labelCs: "vazbu už ověřil člověk", pts: 2 });
  const distinctRefs = new Set(args.matchedStatuteRefs).size;
  if (distinctRefs > 0)
    parts.push({
      labelCs: `shoda se zákony z tabulky relevance (${Math.min(distinctRefs, 3)}×)`,
      pts: Math.min(distinctRefs, 3),
    });
  const m = moneyPts(args.reachableCzk);
  if (m > 0) parts.push({ labelCs: "dosažitelné veřejné peníze (prahy 1/10/100 mil. Kč)", pts: m });
  return { score: parts.reduce((s, p) => s + p.pts, 0), parts };
}

const tieKey = (edgeSrc: string, edgeDst: string): string => `${edgeSrc}→${edgeDst}`;

/** Úplné deterministické pořadí uvnitř vzoru: skóre sestupně, pak jméno (cs),
 *  pak IČO, pak id — žádný nestabilní zbytek. */
function sortCandidates(list: TripwireCandidate[]): TripwireCandidate[] {
  return list.sort(
    (a, b) =>
      b.evidence.score - a.evidence.score ||
      a.personName.localeCompare(b.personName, "cs") ||
      a.ico.localeCompare(b.ico) ||
      a.id.localeCompare(b.id),
  );
}

/* ── derivace ─────────────────────────────────────────────────────────────── */

export function deriveTripwires(input: DeriveTripwiresInput): TripwireData {
  const { ties, votes, rapporteurs, stakes, liveCollisions } = input;

  const stretyByTie = new Map<string, string[]>();
  for (const c of liveCollisions) {
    const k = tieKey(c.edgeSrc, c.edgeDst);
    const arr = stretyByTie.get(k) ?? [];
    arr.push(c.id);
    stretyByTie.set(k, arr);
  }
  // Deterministické pořadí odkazů bez ohledu na pořadí vstupu.
  for (const arr of stretyByTie.values()) arr.sort();

  const baseOf = (t: TripwireTieIn) => ({
    edgeSrc: t.edgeSrc,
    edgeDst: t.edgeDst,
    personPspId: t.personPspId,
    personName: t.personName,
    club: t.club,
    companyId: t.companyId,
    company: t.company,
    ico: t.ico,
    role: t.role,
    tieClass: t.tieClass,
    reviewState: t.reviewState,
    corroboration: t.corroboration,
    roleValidFrom: t.roleValidFrom,
    roleValidTo: t.roleValidTo,
    contractCount: t.contractCount,
    reachableCzk: t.contractCzk + t.subsidiesCzk,
    stretyIds: stretyByTie.get(tieKey(t.edgeSrc, t.edgeDst)) ?? [],
  });

  /* T1 — nová vazba v okně peněžního hlasování ─────────────────────────────
   * Brána: pending_review. Podmínky: registry-confirmed ∧ známý začátek
   * období ∧ firma má kanál ∧ ∃ hlasování o tisku novelizujícím zákon toho
   * kanálu v období role. */
  const t1: TripwireCandidate[] = [];
  const pending = ties.filter((t) => t.reviewState === "pending_review");
  for (const t of pending) {
    if (t.corroboration !== "registry-confirmed") continue;
    if (t.roleValidFrom === null) continue;
    if (t.channelStatutes.length === 0) continue;
    const channelRefs = new Set(t.channelStatutes.map((s) => s.ref));
    const matched: TripwireVoteIn[] = [];
    const matchedRefs = new Set<string>();
    for (const v of votes) {
      const hit = v.amendedRefs.filter((r) => channelRefs.has(r.ref));
      if (hit.length === 0) continue;
      if (!dayInRolePeriod(v.votedOn, t.roleValidFrom, t.roleValidTo)) continue;
      matched.push(v);
      for (const r of hit) matchedRefs.add(r.ref);
    }
    if (matched.length === 0) continue;
    const latest = matched.reduce((max, v) => (v.votedOn > max ? v.votedOn : max), matched[0].votedOn);
    const statutes = t.channelStatutes.filter((s) => matchedRefs.has(s.ref));
    t1.push({
      id: tripwireCandidateId({ pattern: "tie-vote-window", edgeSrc: t.edgeSrc, edgeDst: t.edgeDst }),
      pattern: "tie-vote-window",
      ...baseOf(t),
      statutes: [...statutes],
      evidence: evidenceScore({
        corroboration: t.corroboration,
        roleValidFrom: t.roleValidFrom,
        roleValidTo: t.roleValidTo,
        reviewState: t.reviewState,
        matchedStatuteRefs: [...matchedRefs],
        reachableCzk: t.contractCzk + t.subsidiesCzk,
      }),
      votesMatched: matched.length,
      latestVoteOn: latest,
      bill: null,
      chain: null,
    });
  }

  /* T2 — veřejné smlouvy u neověřené vazby ─────────────────────────────────
   * Brána: pending_review. Podmínky: aspoň jedna smlouva ∧ nad hranicí
   * materiality. */
  const t2: TripwireCandidate[] = [];
  for (const t of pending) {
    if (t.contractCount === 0) continue;
    if (t.deMinimis) continue;
    t2.push({
      id: tripwireCandidateId({ pattern: "unverified-contracts", edgeSrc: t.edgeSrc, edgeDst: t.edgeDst }),
      pattern: "unverified-contracts",
      ...baseOf(t),
      statutes: [],
      evidence: evidenceScore({
        corroboration: t.corroboration,
        roleValidFrom: t.roleValidFrom,
        roleValidTo: t.roleValidTo,
        reviewState: t.reviewState,
        matchedStatuteRefs: [],
        reachableCzk: t.contractCzk + t.subsidiesCzk,
      }),
      votesMatched: 0,
      latestVoteOn: null,
      bill: null,
      chain: null,
    });
  }

  /* T3 — zpravodaj tisku dotýkajícího se kanálu vlastní firmy ──────────────
   * Brána: nezamítnuté vazby. Podmínky: ∃ zpravodajské přiřazení téhož
   * poslance na tisk s průnikem novelizovaných zákonů a kanálů firmy.
   * Jeden kandidát na (vazba × tisk). */
  const t3: TripwireCandidate[] = [];
  const notRejected = ties.filter((t) => t.reviewState !== "rejected");
  const rapsByPerson = new Map<number, TripwireRapporteurIn[]>();
  for (const r of rapporteurs) {
    const arr = rapsByPerson.get(r.personPspId) ?? [];
    arr.push(r);
    rapsByPerson.set(r.personPspId, arr);
  }
  for (const t of notRejected) {
    if (t.channelStatutes.length === 0) continue;
    const channelRefs = new Set(t.channelStatutes.map((s) => s.ref));
    for (const r of rapsByPerson.get(t.personPspId) ?? []) {
      const hit = r.amendedRefs.filter((x) => channelRefs.has(x.ref));
      if (hit.length === 0) continue;
      const hitRefs = new Set(hit.map((x) => x.ref));
      t3.push({
        id: tripwireCandidateId({
          pattern: "rapporteur-channel",
          edgeSrc: t.edgeSrc,
          edgeDst: t.edgeDst,
          extra: r.billNodeId,
        }),
        pattern: "rapporteur-channel",
        ...baseOf(t),
        statutes: t.channelStatutes.filter((s) => hitRefs.has(s.ref)),
        evidence: evidenceScore({
          corroboration: t.corroboration,
          roleValidFrom: t.roleValidFrom,
          roleValidTo: t.roleValidTo,
          reviewState: t.reviewState,
          matchedStatuteRefs: [...hitRefs],
          reachableCzk: t.contractCzk + t.subsidiesCzk,
        }),
        votesMatched: 0,
        latestVoteOn: null,
        bill: { cislo: r.billCislo, title: r.billTitle },
        chain: null,
      });
    }
  }

  /* T4 — smlouvy v majetkovém řetězci vazby ────────────────────────────────
   * Brána: nezamítnuté vazby. Podmínky: owns_stake z firmy vazby do firmy
   * s aspoň jednou smlouvou. Jeden krok, jeden kandidát na (vazba × držená
   * firma). */
  const t4: TripwireCandidate[] = [];
  const stakesBySrc = new Map<string, TripwireStakeIn[]>();
  for (const s of stakes) {
    const arr = stakesBySrc.get(s.srcCompanyId) ?? [];
    arr.push(s);
    stakesBySrc.set(s.srcCompanyId, arr);
  }
  for (const t of notRejected) {
    for (const s of stakesBySrc.get(t.companyId) ?? []) {
      if (s.dstContractCount === 0) continue;
      t4.push({
        id: tripwireCandidateId({
          pattern: "ownership-chain",
          edgeSrc: t.edgeSrc,
          edgeDst: t.edgeDst,
          extra: s.dstCompanyId,
        }),
        pattern: "ownership-chain",
        ...baseOf(t),
        statutes: [],
        evidence: evidenceScore({
          corroboration: t.corroboration,
          roleValidFrom: t.roleValidFrom,
          roleValidTo: t.roleValidTo,
          reviewState: t.reviewState,
          matchedStatuteRefs: [],
          reachableCzk: s.dstContractCzk,
        }),
        votesMatched: 0,
        latestVoteOn: null,
        bill: null,
        chain: {
          company: s.dstCompany,
          ico: s.dstIco,
          stakePct: s.stakePct,
          contractCount: s.dstContractCount,
          contractCzk: s.dstContractCzk,
        },
      });
    }
  }

  const byId = new Map<TripwirePatternId, TripwireCandidate[]>([
    ["tie-vote-window", sortCandidates(t1)],
    ["unverified-contracts", sortCandidates(t2)],
    ["rapporteur-channel", sortCandidates(t3)],
    ["ownership-chain", sortCandidates(t4)],
  ]);
  const examinedById = new Map<TripwirePatternId, number>([
    ["tie-vote-window", pending.length],
    ["unverified-contracts", pending.length],
    ["rapporteur-channel", notRejected.length],
    ["ownership-chain", notRejected.length],
  ]);

  const patterns: TripwirePatternResult[] = TRIPWIRE_PATTERNS.map((p) => ({
    pattern: p.id,
    titleCs: p.titleCs,
    ruleCs: p.ruleCs,
    examined: examinedById.get(p.id) ?? 0,
    candidates: byId.get(p.id) ?? [],
  }));

  return {
    ruleVersion: TRIPWIRE_RULE_VERSION,
    votesAvailable: input.votesAvailable,
    agendaAvailable: input.agendaAvailable,
    collisionsAvailable: input.collisionsAvailable,
    patterns,
    coverage: {
      tiesTotal: ties.length,
      tiesPending: pending.length,
      tiesRejected: ties.length - notRejected.length,
      votesLinkable: votes.length,
      rapporteurAssignments: rapporteurs.length,
      stakeEdges: stakes.length,
      liveCollisions: liveCollisions.length,
      candidatesTotal: patterns.reduce((s, p) => s + p.candidates.length, 0),
    },
  };
}
