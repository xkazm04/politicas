// ČISTÁ derivace kandidátů střetů — Vote-Collision Engine (/penize/strety).
//
// DB-free podle konvence lib/analysis/kg.ts a votetrack/record/derive.ts:
// vstupy jsou typované řádky + mapy, každé pravidlo je unit-testované
// (deriveCollisions.test.ts) a loader (getCollisionCandidates.ts) zůstává
// tenkou IO slupkou. Nic tady neběží přes model — kandidát existuje, protože
// ho vypočetl deterministický join, nebo neexistuje.
//
// Vyhlášené pravidlo joinu (COLLISION_RULE_VERSION, vykreslené doslova
// v metodice na stránce):
//   1. Vstupují JEN vazby verified ∧ registry-confirmed ∧ se známým začátkem
//      období role (tieEntersJoin; chybějící review_state = pending, nikdy
//      verified — parita s moneyLoaderem).
//   2. Hlasování vstupuje, jen když není zmatečné a dá se deterministicky
//      napojit na tisk: primárně přes pořad schůze (agendaTisk — bod_schuze
//      mapuje (schůze, bod) na interní id tisku; bod s víc tisky najednou se
//      konzervativně vynechává a počítá zvlášť), záložně přes „tisk N"
//      v titulku (tiskRefOf; na živých PSP10 datech titulky číslo nenesou —
//      změřeno 0 z 2 014).
//   3. Tisk vstupuje, jen když v grafu novelizuje (amends) aspoň jeden zákon
//      z vyhlášené tabulky relevance pro kanály veřejných peněz té firmy
//      (relevantStatutesFor — zakázky/dotace/dary, žádná inference).
//   4. Den hlasování leží v rejstříkovém období role, oba krajní dny včetně
//      (voteInRolePeriod).
//   5. Počítá se jen POZIČNÍ hlas (ano/ne) — zdržel se, nehlasoval a
//      nepřítomnost kandidáta netvoří (bucketOf, týž slovník jako Seismograf).
//   6. Jeden kandidát na (vazba × hlasování); víc zasažených zákonů se sčítá
//      do candidate.statutes, netvoří další řádky.
//
// Výstup je KANDIDÁT, nikdy zjištění: časový překryv je fakt, věcná souvislost
// vyžaduje lidské ověření (disciplína obviňujících tvrzení, batch-4 bod 17).

import { bucketOf } from "@/features/votetrack/record/derive";
import { canonicalJson, contentHash } from "@/features/dashboard/exhibit";
import type {
  CollisionBallotIn,
  CollisionBillIn,
  CollisionCandidate,
  CollisionData,
  CollisionTieIn,
  CollisionVoteIn,
} from "./collisionTypes";
import {
  COLLISION_RULE_VERSION,
  relevantStatutesFor,
  tieEntersJoin,
  tiskRefOf,
  voteInRolePeriod,
} from "./statuteRelevance";
import { agendaKey, type AgendaTisk } from "./voteAgenda";

export interface DeriveCollisionsInput {
  ties: readonly CollisionTieIn[];
  votes: readonly CollisionVoteIn[];
  bills: readonly CollisionBillIn[];
  ballots: readonly CollisionBallotIn[];
  /** mandát (vote_ballot.mandate_psp_id) → osoba (psp person id). */
  personByMandate: ReadonlyMap<number, number>;
  /** Pořad schůze: agendaKey → interní id tisku / "ambiguous" (voteAgenda.ts).
   *  undefined = schuze.zip nebyl k dispozici; zbývá titulkové pravidlo a
   *  výstup to přizná (agendaAvailable). */
  agendaTisk?: ReadonlyMap<string, AgendaTisk>;
  /** kg pass peněžní vrstvy — jen se protahuje do výstupu. */
  pass?: number;
  /** Četl volající hlasovací + legislativní vrstvu? Výchozí `true`.
   *  `false` znamená, že `votes`/`ballots`/`bills` jsou prázdné ZÁMĚRNĚ (brána
   *  vazeb byla prázdná, join by nad jakýmkoli ledgerem vrátil totéž) — coverage
   *  o hlasování pak není nula, ale `null`: nečteno. */
  voteLayerConsulted?: boolean;
}

/** bill:tisk:<interní id> → interní id (klíč pořadu schůze); jinak null. */
const internalTiskIdOf = (nodeId: string): number | null => {
  const m = /^bill:tisk:(\d+)$/.exec(nodeId);
  return m ? Number(m[1]) : null;
};

/** Stabilní adresa kandidáta: otisk (fnv-1a/32, vzor exhibit.ts) nad
 *  kanonickým JSON klíče. Číslo hlasování je v klíči — týž poslanec a firma
 *  u dvou různých hlasování jsou dva různé kandidáty. */
export const collisionCandidateId = (key: {
  personPspId: number;
  companyId: string;
  votePspId: number;
}): string => contentHash(canonicalJson(key));

export function deriveCollisions(input: DeriveCollisionsInput): CollisionData {
  const { ties, votes, bills, ballots, personByMandate } = input;

  /* ── 1. brána vazeb ──────────────────────────────────────────────────────── */
  let tiesVerified = 0;
  let tiesVerifiedWithoutPeriod = 0;
  let tiesPendingWouldEnter = 0;
  const entering: CollisionTieIn[] = [];
  for (const t of ties) {
    if (t.reviewState === "verified") {
      tiesVerified++;
      if (tieEntersJoin(t)) entering.push(t);
      else if (t.roleValidFrom === null) tiesVerifiedWithoutPeriod++;
    } else if (
      t.reviewState === "pending_review" &&
      t.corroboration === "registry-confirmed" &&
      t.roleValidFrom !== null
    ) {
      tiesPendingWouldEnter++;
    }
  }

  /* ── 2.–3. hlasování × tisky × tabulka relevance ─────────────────────────── */
  const { agendaTisk } = input;
  const billByCislo = new Map<number, CollisionBillIn>();
  const billByInternal = new Map<number, CollisionBillIn>();
  for (const b of bills) {
    const internal = internalTiskIdOf(b.nodeId);
    if (internal !== null) billByInternal.set(internal, b);
    // Duplicitní číslo tisku by bylo datovou chybou; deterministicky vyhrává
    // první v pořadí node id, aby dvojí ingest nemohl přehodit výsledek.
    if (b.cislo === null) continue;
    const prev = billByCislo.get(b.cislo);
    if (!prev || b.nodeId < prev.nodeId) billByCislo.set(b.cislo, b);
  }

  let eventsVoided = 0;
  let eventsLinked = 0;
  let eventsAmbiguousAgenda = 0;
  const matchedBillNodes = new Set<string>();
  /** Platná hlasování napojená na tisk s aspoň jednou amends hranou. */
  const joinableVotes: { vote: CollisionVoteIn; bill: CollisionBillIn }[] = [];
  for (const v of votes) {
    if (v.voided) {
      eventsVoided++;
      continue;
    }
    // Primárně pořad schůze; bod s víc tisky (společná rozprava) se
    // konzervativně vynechává BEZ titulkové záchrany — nejednoznačný klíč
    // nesmí vyrobit kandidáta. Titulkové pravidlo nastupuje, jen když pořad
    // hlasování vůbec nezná.
    let bill: CollisionBillIn | undefined;
    let ambiguous = false;
    if (agendaTisk && v.termPspId !== null && v.sessionNo !== null && v.agendaItem !== null) {
      const hit = agendaTisk.get(agendaKey(v.termPspId, v.sessionNo, v.agendaItem));
      if (hit === "ambiguous") ambiguous = true;
      else if (typeof hit === "number") bill = billByInternal.get(hit);
    }
    if (ambiguous) {
      eventsAmbiguousAgenda++;
      continue;
    }
    if (!bill) {
      const cislo = tiskRefOf(v.title);
      if (cislo !== null) bill = billByCislo.get(cislo);
    }
    if (!bill) continue;
    eventsLinked++;
    matchedBillNodes.add(bill.nodeId);
    if (v.votedOn === null || bill.amendedRefs.length === 0) continue;
    joinableVotes.push({ vote: v, bill });
  }

  /* ── lístky jen pro napojitelná hlasování ────────────────────────────────── */
  const joinableVoteIds = new Set(joinableVotes.map((jv) => jv.vote.pspId));
  const choiceByVoteThenPerson = new Map<number, Map<number, string>>();
  for (const b of ballots) {
    if (!joinableVoteIds.has(b.votePspId)) continue;
    const person = personByMandate.get(b.mandatePspId);
    if (person === undefined) continue;
    let perVote = choiceByVoteThenPerson.get(b.votePspId);
    if (!perVote) {
      perVote = new Map();
      choiceByVoteThenPerson.set(b.votePspId, perVote);
    }
    // Dva lístky téže osoby na tomtéž hlasování by byly datovou chybou;
    // deterministicky drží první (řazení vstupu je stabilní: listVoteBallots
    // řadí podle vote_psp_id, mandate_psp_id).
    if (!perVote.has(person)) perVote.set(person, b.choice);
  }

  /* ── 4.–6. join ──────────────────────────────────────────────────────────── */
  const candidates: CollisionCandidate[] = [];
  for (const t of entering) {
    const statutes = relevantStatutesFor(t);
    if (statutes.length === 0) continue; // firma bez kanálu veřejných peněz
    const relevantRefs = new Set(statutes.map((s) => s.ref));
    for (const { vote, bill } of joinableVotes) {
      const hit = bill.amendedRefs.filter((r) => relevantRefs.has(r.ref));
      if (hit.length === 0) continue;
      if (!voteInRolePeriod(vote.votedOn!, t.roleValidFrom!, t.roleValidTo)) continue;
      const choice = choiceByVoteThenPerson.get(vote.pspId)?.get(t.personPspId);
      if (choice === undefined) continue;
      const bucket = bucketOf(choice);
      if (bucket !== "yes" && bucket !== "no") continue;
      const hitRefs = new Set(hit.map((r) => r.ref));
      candidates.push({
        id: collisionCandidateId({
          personPspId: t.personPspId,
          companyId: t.companyId,
          votePspId: vote.pspId,
        }),
        personPspId: t.personPspId,
        personName: t.personName,
        club: t.club,
        companyId: t.companyId,
        company: t.company,
        ico: t.ico,
        role: t.role,
        tieClass: t.tieClass,
        roleValidFrom: t.roleValidFrom!,
        roleValidTo: t.roleValidTo,
        votePspId: vote.pspId,
        votedOn: vote.votedOn!.slice(0, 10),
        voteTitle: vote.title,
        voteOutcome: vote.outcome,
        voteSourceUrl: vote.sourceUrl,
        choice: bucket,
        billCislo: bill.cislo!,
        billNodeId: bill.nodeId,
        billTitle: bill.title,
        statutes: statutes.filter((s) => hitRefs.has(s.ref)),
        tieRef: { src: t.edgeSrc, rel: t.edgeRel, dst: t.edgeDst },
      });
    }
  }

  /* Deterministické pořadí: nejnovější hlasování první, pak jméno (cs),
   * pak IČO, pak id hlasování — úplné pořadí, žádný nestabilní zbytek. */
  candidates.sort(
    (a, b) =>
      b.votedOn.localeCompare(a.votedOn) ||
      a.personName.localeCompare(b.personName, "cs") ||
      a.ico.localeCompare(b.ico) ||
      b.votePspId - a.votePspId,
  );

  /* Nečtená vrstva se přiznává jako `null`, ne jako nula: `votes.length - 0`
   * by vypadalo jako „sněmovna nehlasovala", což je tvrzení, které tenhle běh
   * nikdy neověřoval. Číslo o vazbách (jediné, co se opravdu četlo) zůstává
   * číslem, protože kandidátů je poctivá nula z něj. */
  const consulted = input.voteLayerConsulted ?? true;
  const orNull = (n: number): number | null => (consulted ? n : null);

  return {
    candidates,
    coverage: {
      tiesTotal: ties.length,
      tiesVerified,
      tiesEntering: entering.length,
      tiesVerifiedWithoutPeriod,
      tiesPendingWouldEnter,
      events: orNull(votes.length - eventsVoided),
      eventsVoided: orNull(eventsVoided),
      eventsLinked: orNull(eventsLinked),
      eventsAmbiguousAgenda: orNull(eventsAmbiguousAgenda),
      billsInGraph: orNull(bills.length),
      billsMatchedToVotes: orNull(matchedBillNodes.size),
      candidates: candidates.length,
    },
    ruleVersion: COLLISION_RULE_VERSION,
    agendaAvailable: consulted ? agendaTisk !== undefined : null,
    voteLayerConsulted: consulted,
    pass: input.pass ?? 0,
  };
}
