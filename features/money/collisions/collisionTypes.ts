// Sdílené tvary Vote-Collision Engine (/penize/strety) — čistý modul bez
// server-importů, aby ho mohl číst server-loader (getCollisionCandidates.ts)
// i "use client" plocha (StretyPage.tsx) stejně jako moneyTypes.ts.
//
// DISCIPLÍNA OBVIŇUJÍCÍCH TVRZENÍ (batch-4, bod 17): všechno, co tenhle modul
// popisuje, je KANDIDÁT — deterministicky vypočtený časový překryv mezi
// doloženou rolí poslance ve firmě a jeho hlasováním o tisku, který novelizuje
// zákon z vyhlášené tabulky relevance. Překryv je fakt; věcná souvislost NENÍ
// a bez lidského ověření se nikde nesmí tvrdit. Nic z tohoto modulu nezapisuje
// review-řádky ani nemění review_state — kandidáti se odvozují znovu při každém
// požadavku (paritní pravidlo moneyLoaderu: chybějící review_state = pending,
// nikdy verified).

import type { ReviewState, TieClass } from "../reviewTypes";

/** Proč zákon z tabulky relevance souvisí s VEŘEJNÝMI PENĚZI té firmy —
 *  vyhlášené pravidlo (statuteRelevance.ts), nikdy inference. */
export const RELEVANCE_WHYS = ["contracts", "subsidies", "donation"] as const;
export type RelevanceWhy = (typeof RELEVANCE_WHYS)[number];

/** Jeden zákon, kvůli kterému se tisk počítá jako relevantní pro firmu. */
export interface RelevantStatute {
  ref: string; // "134/2016"
  label: string; // český název zákona z vyhlášené tabulky
  why: RelevanceWhy;
}

/** Jeden vypočtený kandidát střetu: poslanec × hlasování × tisk × firma.
 *  VŽDY rámovaný „vyžaduje lidské ověření" — viz hlavička modulu. */
export interface CollisionCandidate {
  /** Deterministický otisk obsahu (fnv-1a/32 nad kanonickým JSON klíče
   *  {personPspId, companyId, votePspId}) — stabilní adresa #s-<id>. */
  id: string;
  personPspId: number;
  personName: string;
  club: string | null;
  companyId: string; // kg_node id firmy
  company: string;
  ico: string;
  role: string; // props.role z linked_to hrany, citováno doslova
  tieClass: TieClass;
  /** Rejstříkem potvrzené období role (ARES VR) — vstupní podmínka joinu. */
  roleValidFrom: string;
  roleValidTo: string | null; // null = rejstřík neeviduje konec
  votePspId: number;
  votedOn: string; // YYYY-MM-DD
  voteTitle: string;
  voteOutcome: string;
  voteSourceUrl: string;
  /** Jen poziční hlas (ano/ne) — zdržení a nepřítomnost kandidáta netvoří. */
  choice: "yes" | "no";
  billCislo: number; // veřejné číslo sněmovního tisku (psp.cz)
  billNodeId: string; // kg_node id (bill:tisk:<interní id>)
  billTitle: string;
  /** Zákony z vyhlášené tabulky, které tisk novelizuje a které se týkají
   *  veřejných peněz té firmy. Jeden kandidát na (vazba × hlasování) — víc
   *  zasažených zákonů se sčítá sem, netvoří další řádky. */
  statutes: RelevantStatute[];
  /** Hrana linked_to, na které kandidát stojí — tvar kompatibilní s review
   *  bránou (/penize/kontrola čte tentýž src/dst). Žádný zápis se nekoná.
   *  `rel` se veze proto, aby plocha složila TRVALOU ADRESU účtenky
   *  (`claimRefPath(edgeClaimRef(src, rel, dst))`) tímtéž jediným kodekem, co
   *  `mapLinkedToTie` razí do `MoneyTie.receiptRef` — druhá gramatika adresy by
   *  vypadala správně a rozhodla se na `gone`. */
  tieRef: { src: string; rel: string; dst: string };
}

/** Poctivá čísla o tom, co do joinu vstoupilo a co ne — vykreslují se v bloku
 *  metodiky PŘED kandidáty.
 *
 *  DVA DRUHY NULY (2026-08-11): pole odvozená z hlasovací a legislativní vrstvy
 *  jsou `number | null`. `null` NENÍ nula — znamená „nečteno": brána vazeb byla
 *  prázdná, join by nad jakýmkoli ledgerem vyrobil týž prázdný výsledek, a
 *  loader proto těch ~410 000 řádků vůbec nečetl (viz getCollisionCandidates).
 *  Vytisknout tam 0 by byl údaj bez krytí — plocha místo něj říká, že se
 *  nečetlo, a proč. */
export interface CollisionCoverage {
  tiesTotal: number; // všech linked_to vazeb
  tiesVerified: number; // review_state === "verified"
  /** Vazby, které join skutečně čte: verified ∧ registry-confirmed ∧ známé
   *  období role. */
  tiesEntering: number;
  /** Verified vazby vyřazené jen proto, že rejstříkové období chybí. */
  tiesVerifiedWithoutPeriod: number;
  /** Vazby s potvrzeným obdobím, které by do joinu vstoupily, jakmile projdou
   *  lidskou kontrolou (dnes pending_review). Číslo o frontě, ne kandidáti. */
  tiesPendingWouldEnter: number;
  events: number | null; // platná (nezmatečná) hlasování PSP10
  eventsVoided: number | null;
  /** Platná hlasování napojená na tisk — primárně přes pořad schůze
   *  (bod_schuze → interní id tisku), záložně přes „tisk N" v titulku. */
  eventsLinked: number | null;
  /** Body pořadu s víc tisky najednou (společná rozprava) — konzervativně
   *  vynechané, nikdy kandidát nad nejednoznačným klíčem. */
  eventsAmbiguousAgenda: number | null;
  billsInGraph: number | null;
  /** Tisky z grafu, na které se povedlo napojit aspoň jedno hlasování. */
  billsMatchedToVotes: number | null;
  candidates: number;
}

export interface CollisionData {
  candidates: CollisionCandidate[];
  coverage: CollisionCoverage;
  /** Verze vyhlášeného pravidla joinu — cituje se v metodice i v testech. */
  ruleVersion: string;
  /** Pořad schůze (schuze.zip) byl k dispozici — bez něj zbývá jen záložní
   *  titulkové pravidlo a stránka to poctivě řekne. `null` = nezjišťováno
   *  (hlasovací vrstva se vůbec nečetla, viz `voteLayerConsulted`); tvrdit
   *  „pořad chybí" o dumpu, na který se nikdo nepodíval, by byl výmysl. */
  agendaAvailable: boolean | null;
  /** Četl se vůbec hlasovací a legislativní ledger? `false` = branou vazeb
   *  neprošla ANI JEDNA vazba (tiesEntering === 0), takže join nemůže vyrobit
   *  kandidáta ať by ledger obsahoval cokoli — čtení ~410 000 řádků by výsledek
   *  nezměnilo, jen ho o 10 s zdrželo. Coverage o hlasování je pak `null`. */
  voteLayerConsulted: boolean;
  /** kg pass peněžní vrstvy (sebepoznávací údaj, jako MoneyData.pass). */
  pass: number;
}

/** Vstupní tvar jedné vazby pro čistou derivaci (deriveCollisions.ts). */
export interface CollisionTieIn {
  personPspId: number;
  personName: string;
  club: string | null;
  edgeSrc: string;
  /** Doslovné `rel` hrany (dnes vždy "linked_to") — nese se až do
   *  `CollisionCandidate.tieRef`, aby adresu účtenky skládal jediný kodek. */
  edgeRel: string;
  edgeDst: string;
  companyId: string;
  company: string;
  ico: string;
  role: string;
  tieClass: TieClass;
  reviewState: ReviewState;
  corroboration: string | null;
  roleValidFrom: string | null;
  roleValidTo: string | null;
  contractCount: number;
  subsidiesCount: number;
  donatedToPartyCzk: number | null;
}

/** Vstupní tvar jednoho hlasování. */
export interface CollisionVoteIn {
  pspId: number;
  votedOn: string | null;
  voided: boolean;
  title: string;
  outcome: string;
  sourceUrl: string;
  /** Klíč do pořadu schůze (agendaKey) — primární cesta k tisku. */
  termPspId: number | null;
  sessionNo: number | null;
  agendaItem: number | null;
}

/** Vstupní tvar jednoho tisku (bill uzel + jeho amends hrany, už rozvedené). */
export interface CollisionBillIn {
  nodeId: string;
  cislo: number | null;
  title: string;
  amendedRefs: { ref: string; label: string }[];
}

/** Vstupní tvar jednoho hlasovacího lístku. */
export interface CollisionBallotIn {
  votePspId: number;
  mandatePspId: number;
  choice: string;
}

/* ── kotvy ─────────────────────────────────────────────────────────────────── */

/** DOM id / URL fragment jednoho kandidáta: /penize/strety#s-<otisk>. */
export const collisionAnchorId = (candidateId: string): string => `s-${candidateId}`;

/** `#s-1a2b3c4d` / `s-1a2b3c4d` → "1a2b3c4d"; cokoli jiného → null. */
export function parseCollisionAnchor(hash: string): string | null {
  const m = /^#?s-([0-9a-f]{8})$/.exec(hash.trim());
  return m ? m[1] : null;
}
