// Politicas landing — sdílená ukázková data.
// Všechna čísla jsou ilustrativní mock modelovaný podle tvaru skutečných
// českých otevřených dat (psp.cz jmenovitá hlasování, Hlídač státu /osoby,
// ARES, Registr smluv, Registr dotací, MONITOR, e-Sbírka). Čeština první —
// primární trh i data jsou česká.

export interface Pillar {
  key: "activity" | "attendance" | "independence" | "integrity";
  label: string;
  weight: number; // zveřejněná, fixní, součet 1
  question: string;
  source: string;
}

export const PILLARS: Pillar[] = [
  {
    key: "activity",
    label: "Aktivita",
    weight: 0.25,
    question: "Kolik legislativní práce poslanec skutečně odvede?",
    source: "psp.cz — návrhy zákonů, interpelace, vystoupení",
  },
  {
    key: "attendance",
    label: "Docházka",
    weight: 0.2,
    question: "Je poslanec přítomen, když sněmovna hlasuje?",
    source: "psp.cz — účast na hlasování, 9. období",
  },
  {
    key: "independence",
    label: "Nezávislost",
    weight: 0.25,
    question: "Hlasuje podle svého přesvědčení, nebo podle stranické linie?",
    source: "psp.cz — odchylky od stranické linie",
  },
  {
    key: "integrity",
    label: "Integrita",
    weight: 0.3,
    question: "Tečou veřejné peníze firmám napojeným na poslance?",
    source: "Hlídač /osoby · Registr smluv · MONITOR",
  },
];

export interface MP {
  id: string;
  name: string;
  party: string;
  partyColor: string;
  region: string;
  score: number;
  rank: number;
  delta: number; // posun v pořadí proti minulému čtvrtletí (+ nahoru)
  headline: string;
  pillars: Record<Pillar["key"], number>;
  trend: number[]; // kompozit za posledních 6 čtvrtletí (poslední = score)
}

// `score` musí odpovídat composite(pillars) podle zveřejněných vah v1.4 —
// VariantKonstrukt ho přepočítává živě z pilířů, takže rozjeté literály
// se na obrazovce ukážou jako dvě různá čísla.
export const MPS: MP[] = [
  {
    id: "novakova-p",
    name: "Petra Nováková",
    party: "Piráti",
    partyColor: "#0b6e4f",
    region: "Praha",
    score: 88.3,
    rank: 1,
    delta: 2,
    headline: "Vysoký výkon, téměř stoprocentní docházka, žádné vazby na veřejné zakázky.",
    pillars: { activity: 88, attendance: 94, independence: 76, integrity: 95 },
    trend: [79.4, 81.2, 83.8, 84.9, 86.5, 88.3],
  },
  {
    id: "pokorna-e",
    name: "Eva Pokorná",
    party: "STAN",
    partyColor: "#147d8d",
    region: "Jihomoravský kraj",
    score: 84.1,
    rank: 2,
    delta: 0,
    headline: "Vyrovnaná ve všech čtyřech pilířích; stabilní špička sněmovny.",
    pillars: { activity: 83, attendance: 90, independence: 71, integrity: 92 },
    trend: [82.6, 83.4, 82.9, 84.0, 84.5, 84.1],
  },
  {
    id: "dvorak-m",
    name: "Martin Dvořák",
    party: "ODS",
    partyColor: "#2172c2",
    region: "Plzeňský kraj",
    score: 78.2,
    rank: 3,
    delta: -2,
    headline: "Silná práce ve výborech; jedna přiznaná firma v prověřování.",
    pillars: { activity: 81, attendance: 86, independence: 62, integrity: 84 },
    trend: [80.1, 81.6, 82.3, 80.8, 79.5, 78.2],
  },
  {
    id: "hruska-k",
    name: "Karel Hruška",
    party: "ANO",
    partyColor: "#16255c",
    region: "Moravskoslezský kraj",
    score: 60.1,
    rank: 74,
    delta: 5,
    headline: "Docházka se zlepšila; 4,2 mil. Kč v zakázkách firmě napojené na poslance.",
    pillars: { activity: 58, attendance: 71, independence: 44, integrity: 68 },
    trend: [52.3, 54.1, 53.6, 56.8, 58.9, 60.1],
  },
  {
    id: "beran-t",
    name: "Tomáš Beran",
    party: "SPD",
    partyColor: "#7a2e2e",
    region: "Ústecký kraj",
    score: 40.1,
    rank: 193,
    delta: -11,
    headline: "Nejnižší decil v docházce; tři nepřiznané statutární role.",
    pillars: { activity: 31, attendance: 42, independence: 55, integrity: 34 },
    trend: [46.8, 45.2, 44.7, 42.9, 41.5, 40.1],
  },
];

// Osa X trendových grafů — 6 čtvrtletí 9. období.
export const TREND_QUARTERS = ["Q1/24", "Q2/24", "Q3/24", "Q4/24", "Q1/25", "Q2/25"];

export interface Module {
  key: string;
  name: string;
  tag: string;
  description: string;
  metric: { value: string; label: string };
  feeds: string; // co dodává do CivicScore
  source: string;
  /** Cesta na plochu modulu, jakmile existuje. */
  href?: string;
}

export const MODULES: Module[] = [
  {
    key: "civic-score",
    name: "CivicScore",
    tag: "Syntéza",
    description:
      "Souhrnný index efektivity 0–100 pro každého poslance — čtyři pilíře, zveřejněné váhy, každé číslo dohledatelné ke svému datasetu.",
    metric: { value: "200", label: "hodnocených poslanců, každé čtvrtletí" },
    feeds: "Plocha, kterou sytí ostatní čtyři moduly",
    source: "všechny moduly",
    href: "/zebricek",
  },
  {
    key: "vote-track",
    name: "VoteTrack",
    tag: "Analýza hlasování",
    description:
      "Každé jmenovité hlasování Sněmovny i Senátu — docházka, odchylky od stranické linie, rebelie a kdo co předložil.",
    metric: { value: "5 214", label: "jmenovitých hlasování, 9. období" },
    feeds: "Pilíře Aktivita + Docházka",
    source: "psp.cz · Senát XML",
    href: "/hlasovani",
  },
  {
    key: "follow-the-money",
    name: "FollowTheMoney",
    tag: "Síť peněz",
    description:
      "Veřejné zakázky a dotace dohledané přes firmy až k politikům, kteří jsou s nimi spojeni — propojeno přes osmimístné IČO.",
    metric: { value: "2,1 mld Kč", label: "dohledáno k napojeným firmám" },
    feeds: "Pilíř Integrita",
    source: "Registr smluv · ARES · Hlídač",
    href: "/penize",
  },
  {
    key: "budget-mirror",
    name: "BudgetMirror",
    tag: "Rozpočtové srovnání",
    description:
      "Hospodaření obcí srovnané s podobnými městy — dluh na obyvatele, podíl investic, správcovství v čase.",
    metric: { value: "6 254", label: "porovnávaných obcí" },
    feeds: "Správcovství, pro exekutivní role",
    source: "MONITOR / Státní pokladna",
    href: "/rozpocty",
  },
  {
    key: "law-watch",
    name: "LawWatch",
    tag: "Monitor legislativy",
    description:
      "Co se v zákonech skutečně změnilo — rozdíly po paragrafech propojené zpět na hlasování a poslance, kteří je odhlasovali.",
    metric: { value: "312", label: "novelizovaných zákonů v tomto období" },
    feeds: "Propojuje hlasování → dopady",
    source: "e-Sbírka SPARQL · psp.cz tisky",
    href: "/zakony",
  },
];

// Graf peněžní stopy pro investigativní variantu. Jedna realisticky tvarovaná
// stopa: poslanec → (statutární orgán) → firma → (dodavatel) → smlouva,
// plus darovací hrana.
export interface GraphNode {
  id: string;
  kind: "person" | "company" | "party" | "money";
  label: string;
  sub: string;
  x: number; // souřadnice 0..100 ve viewBoxu
  y: number;
}

export interface GraphEdge {
  from: string;
  to: string;
  label: string;
  trail?: boolean; // součást zvýrazněné důkazní stopy
}

export const GRAPH_NODES: GraphNode[] = [
  { id: "mp", kind: "person", label: "K. Hruška", sub: "poslanec · ANO", x: 10, y: 46 },
  { id: "co1", kind: "company", label: "Silnice MSK a.s.", sub: "IČO 258 41 991", x: 38, y: 22 },
  { id: "co2", kind: "company", label: "Agrofond s.r.o.", sub: "IČO 470 12 336", x: 38, y: 72 },
  { id: "party", kind: "party", label: "ANO 2011", sub: "strana", x: 62, y: 92 },
  { id: "k1", kind: "money", label: "4,2 mil. Kč", sub: "údržba silnic, 2025", x: 72, y: 14 },
  { id: "k2", kind: "money", label: "11,8 mil. Kč", sub: "dotace SZIF, 2024", x: 72, y: 58 },
  { id: "k3", kind: "money", label: "350 tis. Kč", sub: "dar, 2024", x: 88, y: 84 },
];

export const GRAPH_EDGES: GraphEdge[] = [
  { from: "mp", to: "co1", label: "statutární orgán", trail: true },
  { from: "mp", to: "co2", label: "vlastník 38 %" },
  { from: "co1", to: "k1", label: "dodavatel", trail: true },
  { from: "co2", to: "k2", label: "příjemce" },
  { from: "co2", to: "party", label: "dárce" },
  { from: "party", to: "k3", label: "obdržel" },
];

export const composite = (p: Record<Pillar["key"], number>, weights = PILLARS) =>
  Math.round(weights.reduce((s, w) => s + p[w.key] * w.weight, 0) * 10) / 10;

// ── Data pro BudgetMirror (Fáze 3) ──────────────────────────────────────

/** Roky osy rozpočtových trendů. */
export const BUDGET_YEARS = ["2021", "2022", "2023", "2024", "2025", "2026"];

/** Město ve srovnávací skupině — hospodaření z MONITOR / Státní pokladny. */
export interface Town {
  id: string;
  name: string;
  region: string;
  population: number;
  /** Dluh na obyvatele v Kč (poslední hodnota trendu). */
  debtPerCapita: number;
  /** Podíl kapitálových výdajů na výdajích celkem, %. */
  capexRatio: number;
  /** Saldo rozpočtu na obyvatele v Kč (+ přebytek / − schodek). */
  saldoPerCapita: number;
  /** Dluh na obyvatele přes BUDGET_YEARS (Kč); končí na debtPerCapita. */
  debtTrend: number[];
}

/** Vrstevnická skupina „města 20–40 tis. obyvatel" — ilustrativní mock. */
export const TOWNS: Town[] = [
  {
    id: "pisek",
    name: "Písek",
    region: "Jihočeský kraj",
    population: 30100,
    debtPerCapita: 2300,
    capexRatio: 24.1,
    saldoPerCapita: 2600,
    debtTrend: [3100, 2900, 2700, 2500, 2400, 2300],
  },
  {
    id: "trebic",
    name: "Třebíč",
    region: "Vysočina",
    population: 34800,
    debtPerCapita: 4100,
    capexRatio: 22.6,
    saldoPerCapita: 2100,
    debtTrend: [5800, 5400, 5000, 4700, 4400, 4100],
  },
  {
    id: "krnov",
    name: "Krnov",
    region: "Moravskoslezský kraj",
    population: 22900,
    debtPerCapita: 6700,
    capexRatio: 16.4,
    saldoPerCapita: 900,
    debtTrend: [7500, 7300, 7100, 7000, 6800, 6700],
  },
  {
    id: "kolin",
    name: "Kolín",
    region: "Středočeský kraj",
    population: 32300,
    debtPerCapita: 8400,
    capexRatio: 18.2,
    saldoPerCapita: 1250,
    debtTrend: [11200, 10400, 9800, 9100, 8800, 8400],
  },
  {
    id: "cheb",
    name: "Cheb",
    region: "Karlovarský kraj",
    population: 31400,
    debtPerCapita: 9800,
    capexRatio: 14.8,
    saldoPerCapita: 600,
    debtTrend: [8900, 9200, 9400, 9600, 9700, 9800],
  },
  {
    id: "beroun",
    name: "Beroun",
    region: "Středočeský kraj",
    population: 20600,
    debtPerCapita: 12600,
    capexRatio: 12.3,
    saldoPerCapita: -400,
    debtTrend: [9800, 10400, 11000, 11600, 12100, 12600],
  },
];

// ── Data pro LawWatch (Fáze 3) ──────────────────────────────────────────

/** Změna paragrafu propojená na jmenovité hlasování (RollCall.id). */
export interface LawChange {
  id: string;
  law: string;
  lawRef: string; // "č. 134/2016 Sb."
  paragraph: string;
  effectiveFrom: string; // ISO
  rollCallId: string;
  summary: string;
  before: string;
  after: string;
}

export const LAW_CHANGES: LawChange[] = [
  {
    id: "lc1",
    law: "Zákon o zadávání veřejných zakázek",
    lawRef: "č. 134/2016 Sb.",
    paragraph: "§ 16 odst. 2",
    effectiveFrom: "2027-01-01",
    rollCallId: "h-412",
    summary: "Údaje o skutečném majiteli dodavatele nově povinné před podpisem smlouvy.",
    before:
      "Zadavatel může požadovat předložení údajů o skutečném majiteli vybraného dodavatele.",
    after:
      "Zadavatel požaduje předložení údajů o skutečném majiteli vybraného dodavatele před podpisem smlouvy; bez nich smlouvu neuzavře.",
  },
  {
    id: "lc2",
    law: "Zákon o ochraně oznamovatelů",
    lawRef: "č. 171/2023 Sb.",
    paragraph: "§ 4",
    effectiveFrom: "2026-10-01",
    rollCallId: "h-398",
    summary: "Vnitřní oznamovací systém nově i pro obce nad 5 000 obyvatel.",
    before:
      "Povinnost zavést vnitřní oznamovací systém se vztahuje na obce s více než 10 000 obyvateli.",
    after:
      "Povinnost zavést vnitřní oznamovací systém se vztahuje na obce s více než 5 000 obyvateli.",
  },
  {
    id: "lc3",
    law: "Stavební zákon",
    lawRef: "č. 283/2021 Sb.",
    paragraph: "§ 312",
    effectiveFrom: "2027-07-01",
    rollCallId: "h-387",
    summary: "Plná digitalizace stavebního řízení odložena o 12 měsíců.",
    before: "Portál stavebníka se použije pro všechna řízení zahájená po 1. červenci 2026.",
    after: "Portál stavebníka se použije pro všechna řízení zahájená po 1. červenci 2027.",
  },
];

/** Fáze legislativního potrubí (index = Bill.stage). */
export const BILL_STAGES = ["1. čtení", "výbory", "2. čtení", "3. čtení", "Senát", "podpis", "účinnost"];

export interface Bill {
  tisk: string;
  title: string;
  /** Index do BILL_STAGES — kam tisk zatím došel. */
  stage: number;
  /** Jmenovité hlasování 3. čtení, existuje-li (RollCall.id). */
  rollCallId?: string;
}

export const BILLS: Bill[] = [
  { tisk: "sn. tisk 440", title: "Digitalizace stavebního řízení — odklad účinnosti", stage: 6, rollCallId: "h-387" },
  { tisk: "sn. tisk 455", title: "Ochrana oznamovatelů — rozšíření působnosti", stage: 5, rollCallId: "h-398" },
  { tisk: "sn. tisk 486", title: "Novela zákona o zadávání veřejných zakázek", stage: 4, rollCallId: "h-412" },
  { tisk: "sn. tisk 471", title: "Rozpočet krajské dopravní infrastruktury", stage: 4, rollCallId: "h-409" },
  { tisk: "sn. tisk 448", title: "Zastropování cen energií pro domácnosti", stage: 3, rollCallId: "h-391" },
  { tisk: "sn. tisk 502", title: "Novela zákona o střetu zájmů", stage: 1 },
  { tisk: "sn. tisk 509", title: "Registr lobbistů", stage: 0 },
];

// ── Data pro dashboard (kolo 1 prototypu) ────────────────────────────────

/** Agregáty sněmovny pro přehledové dlaždice. */
export interface ChamberStat {
  key: string;
  label: string;
  value: string;
  sub: string;
  source: string;
}

export const CHAMBER_STATS: ChamberStat[] = [
  // Hodnoty avg dlaždice jsou přišité testem k CHAMBER_SUMMARY
  // (lib/civic/leaderboard.ts) — počítají se z plného žebříčku.
  {
    key: "avg",
    label: "průměrný kompozit",
    value: "56,8",
    sub: "medián 55,4 · rozptyl σ 11,6",
    source: "civicscore v1.4",
  },
  {
    key: "attendance",
    label: "průměrná docházka",
    value: "78,3 %",
    sub: "−1,2 p. b. proti Q1/25",
    source: "psp.cz — jmenovitá hlasování",
  },
  {
    key: "money",
    label: "peníze k napojeným firmám",
    value: "2,1 mld Kč",
    sub: "+180 mil. Kč toto čtvrtletí",
    source: "registr smluv ⋈ ares",
  },
  {
    key: "laws",
    label: "novelizované zákony",
    value: "312",
    sub: "38 mění § s dopadem na občany",
    source: "e-sbírka · psp.cz tisky",
  },
];

/** Průměrný kompozit sněmovny přes 6 čtvrtletí (osa = TREND_QUARTERS);
 * poslední hodnota je přišitá testem k CHAMBER_SUMMARY.avg. */
export const CHAMBER_TREND = [54.2, 54.9, 55.3, 55.8, 56.3, 56.8];

export type VoteChoice = "pro" | "proti" | "zdržel se" | "omluven";

/** Strana ve sněmovně — barva je datový údaj (malé čipy, nikdy dekorace).
 *
 *  POZOR: `PARTIES` je součást UKÁZKOVÉHO katalogu (viz hlavička souboru) —
 *  200 křesel 9. období, tedy sněmovna, která už není. Skutečné klubovní
 *  kluby PSP10 mají vlastní tabulku `CLUB_DISPLAY` na KONCI tohoto souboru;
 *  reálná cesta (features/civicscore/getLeaderboardData.ts) čte JI, ne tuhle. */
export interface PartyMeta {
  code: string;
  name: string;
  color: string;
  seats: number;
}

/** 200 křesel 9. období. */
export const PARTIES: PartyMeta[] = [
  { code: "ano", name: "ANO 2011", color: "#16255c", seats: 72 },
  { code: "ods", name: "ODS", color: "#2172c2", seats: 34 },
  { code: "stan", name: "STAN", color: "#147d8d", seats: 33 },
  { code: "kdu", name: "KDU-ČSL", color: "#c48a0f", seats: 23 },
  { code: "spd", name: "SPD", color: "#7a2e2e", seats: 20 },
  { code: "top", name: "TOP 09", color: "#7b2d8e", seats: 14 },
  { code: "pir", name: "Piráti", color: "#0b6e4f", seats: 4 },
];

/** Rozpad hlasů strany v jednom hlasování; součet = mandáty strany. */
export interface PartyVotes {
  pro: number;
  proti: number;
  zdrzel: number;
  omluven: number;
}

/** Jmenovité hlasování s hlasy vzorku poslanců (klíč = MP.id). */
export interface RollCall {
  id: string;
  date: string; // ISO
  tisk: string;
  title: string;
  result: "přijato" | "zamítnuto";
  pro: number;
  proti: number;
  perMP: Record<string, VoteChoice>;
  /** MP.id poslanců, kteří šli proti linii své strany. */
  rebels: string[];
  /** Rozpad po stranách (klíč = PartyMeta.code); testy hlídají součty. */
  byParty: Record<string, PartyVotes>;
}

export const ROLL_CALLS: RollCall[] = [
  {
    id: "h-412",
    date: "2026-07-14",
    tisk: "sn. tisk 486",
    title: "Novela zákona o zadávání veřejných zakázek",
    result: "přijato",
    pro: 108,
    proti: 62,
    perMP: { "novakova-p": "pro", "pokorna-e": "pro", "dvorak-m": "pro", "hruska-k": "proti", "beran-t": "omluven" },
    rebels: [],
    byParty: {
      ano: { pro: 0, proti: 45, zdrzel: 12, omluven: 15 },
      ods: { pro: 34, proti: 0, zdrzel: 0, omluven: 0 },
      stan: { pro: 33, proti: 0, zdrzel: 0, omluven: 0 },
      kdu: { pro: 23, proti: 0, zdrzel: 0, omluven: 0 },
      spd: { pro: 0, proti: 17, zdrzel: 2, omluven: 1 },
      top: { pro: 14, proti: 0, zdrzel: 0, omluven: 0 },
      pir: { pro: 4, proti: 0, zdrzel: 0, omluven: 0 },
    },
  },
  {
    id: "h-409",
    date: "2026-07-02",
    tisk: "sn. tisk 471",
    title: "Rozpočet krajské dopravní infrastruktury",
    result: "přijato",
    pro: 96,
    proti: 84,
    perMP: { "novakova-p": "proti", "pokorna-e": "zdržel se", "dvorak-m": "proti", "hruska-k": "pro", "beran-t": "omluven" },
    rebels: ["hruska-k"],
    byParty: {
      ano: { pro: 30, proti: 38, zdrzel: 2, omluven: 2 },
      ods: { pro: 10, proti: 20, zdrzel: 2, omluven: 2 },
      stan: { pro: 25, proti: 2, zdrzel: 6, omluven: 0 },
      kdu: { pro: 19, proti: 2, zdrzel: 1, omluven: 1 },
      spd: { pro: 2, proti: 16, zdrzel: 0, omluven: 2 },
      top: { pro: 10, proti: 3, zdrzel: 0, omluven: 1 },
      pir: { pro: 0, proti: 3, zdrzel: 0, omluven: 1 },
    },
  },
  {
    id: "h-398",
    date: "2026-06-18",
    tisk: "sn. tisk 455",
    title: "Ochrana oznamovatelů — rozšíření působnosti",
    result: "přijato",
    pro: 121,
    proti: 41,
    perMP: { "novakova-p": "pro", "pokorna-e": "pro", "dvorak-m": "zdržel se", "hruska-k": "proti", "beran-t": "proti" },
    rebels: ["dvorak-m"],
    byParty: {
      ano: { pro: 28, proti: 30, zdrzel: 8, omluven: 6 },
      ods: { pro: 26, proti: 0, zdrzel: 5, omluven: 3 },
      stan: { pro: 30, proti: 0, zdrzel: 0, omluven: 3 },
      kdu: { pro: 20, proti: 0, zdrzel: 2, omluven: 1 },
      spd: { pro: 0, proti: 11, zdrzel: 4, omluven: 5 },
      top: { pro: 13, proti: 0, zdrzel: 0, omluven: 1 },
      pir: { pro: 4, proti: 0, zdrzel: 0, omluven: 0 },
    },
  },
  {
    id: "h-391",
    date: "2026-06-05",
    tisk: "sn. tisk 448",
    title: "Zastropování cen energií pro domácnosti",
    result: "zamítnuto",
    pro: 82,
    proti: 98,
    perMP: { "novakova-p": "pro", "pokorna-e": "proti", "dvorak-m": "proti", "hruska-k": "omluven", "beran-t": "pro" },
    rebels: ["novakova-p"],
    byParty: {
      ano: { pro: 55, proti: 11, zdrzel: 2, omluven: 4 },
      ods: { pro: 0, proti: 30, zdrzel: 2, omluven: 2 },
      stan: { pro: 0, proti: 29, zdrzel: 2, omluven: 2 },
      kdu: { pro: 5, proti: 16, zdrzel: 2, omluven: 0 },
      spd: { pro: 17, proti: 1, zdrzel: 0, omluven: 2 },
      top: { pro: 4, proti: 9, zdrzel: 0, omluven: 1 },
      pir: { pro: 1, proti: 2, zdrzel: 0, omluven: 1 },
    },
  },
  {
    id: "h-387",
    date: "2026-05-27",
    tisk: "sn. tisk 440",
    title: "Digitalizace stavebního řízení — odklad účinnosti",
    result: "přijato",
    pro: 102,
    proti: 71,
    perMP: { "novakova-p": "proti", "pokorna-e": "pro", "dvorak-m": "pro", "hruska-k": "pro", "beran-t": "omluven" },
    rebels: [],
    byParty: {
      ano: { pro: 58, proti: 7, zdrzel: 3, omluven: 4 },
      ods: { pro: 24, proti: 6, zdrzel: 2, omluven: 2 },
      stan: { pro: 20, proti: 8, zdrzel: 3, omluven: 2 },
      kdu: { pro: 0, proti: 20, zdrzel: 2, omluven: 1 },
      spd: { pro: 0, proti: 14, zdrzel: 0, omluven: 6 },
      top: { pro: 0, proti: 12, zdrzel: 1, omluven: 1 },
      pir: { pro: 0, proti: 4, zdrzel: 0, omluven: 0 },
    },
  },
];

/** Peněžní vazba poslance — vždy datovaný, doložený fakt, nikdy obvinění. */
export interface MoneyTie {
  mpId: string;
  company: string;
  ico: string;
  kind: string; // druh vazby (statutární orgán, vlastník, …)
  amount: string; // "4,2 mil. Kč" | "—"
  note: string;
  year: string;
  source: string;
  /** false = čeká na lidskou kontrolu; do skóre se nepropisuje. */
  verified: boolean;
  /** PartyMeta.code — firma je zároveň doloženým dárcem této strany. */
  donorParty?: string;
  /** Dar straně, jak ho vykazuje hlídač /sponzoring (formátovaný řetězec). */
  donationAmount?: string;
}

export const MONEY_TIES: MoneyTie[] = [
  {
    mpId: "hruska-k",
    company: "Silnice MSK a.s.",
    ico: "258 41 991",
    kind: "statutární orgán (od 03/2019)",
    amount: "4,2 mil. Kč",
    note: "veřejná zakázka — údržba silnic, Kraj MSK",
    year: "2025",
    source: "registr smluv · ares v3",
    verified: true,
  },
  {
    mpId: "hruska-k",
    company: "Agrofond s.r.o.",
    ico: "470 12 336",
    kind: "vlastník 38 %",
    amount: "11,8 mil. Kč",
    note: "dotace SZIF; firma zároveň dárce ANO 2011 (350 tis. Kč)",
    year: "2024",
    source: "registr dotací · hlídač státu",
    verified: true,
    donorParty: "ano",
    donationAmount: "350 tis. Kč",
  },
  {
    mpId: "dvorak-m",
    company: "DK Stav s.r.o.",
    ico: "291 55 402",
    kind: "přiznaná firma (společník 50 %)",
    amount: "—",
    note: "bez veřejných zakázek; v prověřování entity-resolution",
    year: "2026",
    source: "ares v3 · registr oznámení",
    verified: false,
  },
  {
    mpId: "beran-t",
    company: "3 společnosti",
    ico: "—",
    kind: "nepřiznané statutární role",
    amount: "—",
    note: "rozpor mezi ARES a registrem oznámení; čeká na lidskou kontrolu",
    year: "2026",
    source: "ares v3 ⋈ registr oznámení",
    verified: false,
  },
];

/**
 * Na které entity událost ukazuje. Feed a přehledový graf kreslí TYTÝŽ entity —
 * bez explicitních odkazů by je musela párovat heuristika nad textem (křehké a
 * nepřeložitelné). Odkazy drží obě plochy v synchronizaci: kliknutí na řádek
 * rozsvítí uzly, kliknutí na uzel profiltruje řádky.
 */
export interface FeedRefs {
  /** MP.id */
  mps?: string[];
  /** Index do MONEY_TIES. */
  ties?: number[];
  /** RollCall.id */
  rollCalls?: string[];
  /** LawChange.id */
  lawChanges?: string[];
  /** PartyMeta.code */
  parties?: string[];
}

/** Událost pro živý přehled — co se v grafu změnilo. */
export interface FeedEvent {
  id: string;
  ts: string; // "dnes 09:14" / "út 15. 7."
  kind: "money" | "vote" | "law" | "score";
  text: string;
  source: string;
  /** signal = zaslouží pozornost, cobalt = neutrální změna, ink = rutina. */
  tone: "signal" | "cobalt" | "ink";
  mpId?: string;
  /** Entity, kterých se událost dotkla — prázdné u čistě agregátních přepočtů. */
  refs?: FeedRefs;
}

export const EVENTS: FeedEvent[] = [
  {
    id: "e1",
    ts: "dnes 09:14",
    kind: "money",
    text: "Nová smlouva 4,2 mil. Kč — Silnice MSK a.s. (vazba: K. Hruška, statutární orgán)",
    source: "registr smluv",
    tone: "signal",
    mpId: "hruska-k",
    refs: { mps: ["hruska-k"], ties: [0] },
  },
  {
    id: "e2",
    ts: "dnes 08:02",
    kind: "score",
    text: "Pilíř integrity K. Hrušky přepočten 68 → 61; čeká na lidskou kontrolu před zveřejněním",
    source: "civicscore v1.4",
    tone: "cobalt",
    mpId: "hruska-k",
    refs: { mps: ["hruska-k"], ties: [0, 1] },
  },
  {
    id: "e3",
    ts: "út 14. 7.",
    kind: "vote",
    text: "Hlasování č. 412: novela zákona o zadávání veřejných zakázek přijata 108:62",
    source: "psp.cz",
    tone: "ink",
    refs: { rollCalls: ["h-412"] },
  },
  {
    id: "e4",
    ts: "út 14. 7.",
    kind: "vote",
    text: "P. Nováková šla proti linii Pirátů u zastropování cen energií (4. rebelie v období)",
    source: "psp.cz — odchylky od linie",
    tone: "cobalt",
    mpId: "novakova-p",
    refs: { mps: ["novakova-p"], rollCalls: ["h-391"] },
  },
  {
    id: "e5",
    ts: "po 13. 7.",
    kind: "law",
    text: "Novela mění § 16 zákona o střetu zájmů — účinnost od 1. 1. 2027; diff připraven",
    source: "e-sbírka",
    tone: "ink",
    refs: { lawChanges: ["lc1"], rollCalls: ["h-412"] },
  },
  {
    id: "e6",
    ts: "pá 10. 7.",
    kind: "money",
    text: "Dar 350 tis. Kč pro ANO 2011 od Agrofond s.r.o. — překryv vlastníků 38 %",
    source: "hlídač státu /sponzoring",
    tone: "signal",
    refs: { ties: [1], parties: ["ano"] },
  },
  {
    id: "e7",
    ts: "čt 9. 7.",
    kind: "score",
    text: "Čtvrtletní přepočet žebříčku: 200 poslanců, 14 změn v první dvacítce",
    source: "civicscore v1.4",
    tone: "ink",
  },
];

// ═════════════════════════════════════════════════════════════════════════════
// KONEC UKÁZKOVÉHO KATALOGU. Co je pod touhle linkou, NENÍ mock.
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Jak se SÁZÍ skutečné poslanecké klubovní klubu 10. období (PSP10).
 *
 * Dvě věci, které nejsou totéž, a proto stojí v jedné tabulce vedle sebe:
 *
 *  · `name` — REDAKČNÍ zápis obecně užívaného krátkého názvu klubu („ANO 2011",
 *    „TOP 09"). Není to tvrzení o datech: rejstřík psp.cz nese na jedné straně
 *    ZKRATKU (`organ.abbrev` → „ANO2011", „TOP09") a na druhé plný právní
 *    název v genitivu („Poslanecký klub Občanské demokratické strany"), a ani
 *    jedno se nedá vysázet do řádku žebříčku. Typografie mezi těmi dvěma je
 *    naše, a je tady přiznaná.
 *  · `color` — DESIGNOVÉ PŘIŘAZENÍ identity klubu (tečka u jména, výseč
 *    hemicyklu). Hodnoty jsou tady proto, že `custom/no-hardcoded-colors`
 *    označuje právě tento soubor za domov datově řízených barev
 *    (packages/eslint-plugin-civic-transparency/rules/no-hardcoded-colors.cjs)
 *    a jeho výjimková zóna v eslint.config.mjs jinou možnost nedává.
 *    Hexy jsou převzaté z `PARTIES` beze změny — žádná barva se neposunula.
 *
 * KLÍČ JE ZKRATKA Z REJSTŘÍKU, ne mock kód strany. Do 2026-08-12 se reálná
 * cesta k názvům a barvám dostávala oklikou přes `CLUB_TO_PARTY_CODE` →
 * `PARTIES`, tedy přes tabulku, jejíž vlastní hlavička o sobě říká
 * „ilustrativní mock" a jejíž křesla popisují 9. období: 207 skutečných řádků
 * žebříčku tak bralo jméno svého klubu ze vzorku. Ta závislost tímhle končí.
 *
 * Klub, který tady není, se NEDOMÝŠLÍ — volající vysází zkratku tak, jak přišla
 * z rejstříku, a neutrální barvu (viz `clubMeta` v getLeaderboardData.ts).
 */
export interface ClubDisplay {
  /** Obecně užívaný krátký název klubu — redakční typografie nad zkratkou. */
  name: string;
  /** Datová barva identity klubu; mirror tokenu, ne dekorace. */
  color: string;
}

export const CLUB_DISPLAY: Record<string, ClubDisplay> = {
  ANO2011: { name: "ANO 2011", color: "#16255c" },
  ODS: { name: "ODS", color: "#2172c2" },
  STAN: { name: "STAN", color: "#147d8d" },
  "KDU-ČSL": { name: "KDU-ČSL", color: "#c48a0f" },
  SPD: { name: "SPD", color: "#7a2e2e" },
  TOP09: { name: "TOP 09", color: "#7b2d8e" },
  Piráti: { name: "Piráti", color: "#0b6e4f" },
  // Motoristé sobě: v `PARTIES` nikdy nebyli (mock popisuje 9. období), takže
  // je reálná cesta až dosud řešila výjimkou přímo v loaderu. Tady jsou
  // řádným záznamem jako každý jiný klub; `#dfa321` zrcadlí token
  // `--color-ochre` z app/globals.css (týž hex jako features/landing/palette).
  MS: { name: "Motoristé", color: "#dfa321" },
};
