// Server-only loader for the Volební kompas naruby (moonshot 5B): joins the
// REAL PSP10 vote ledger (vote_event + vote_ballot) with the Silver-layer
// vote_tag themes, clubs, mandates and person names, runs the disclosed
// selection rule (kompas/select.ts) and ships the /kompas client tree a
// compact positional record of the ~20 selected roll calls. Alignment itself
// is computed client-side (kompas/score.ts) from the reader's answers — the
// URL is the whole state, no accounts.
//
// ── Čtecí cesta (2026-08-10) ───────────────────────────────────────────────
// Do 2026-08-10 si tenhle loader četl SVÝCH pět relací vedle getVoteRecord.ts —
// stejné události, stejných ~406 000 hlasů, stejný registr, jen o dvě stě řádků
// vedle. Teď obojí jde přes `readLedger()` (ledgerRead.ts, `react.cache()`d), takže
// v jednom požadavku je čtení JEDNO; přes požadavky drží výsledek memo na stejném
// okně jako peněžní vrstva (`MONEY_MEMO_TTL_MS`). Jediné čtení navíc, které tahle
// plocha potřebuje a záznam ne, jsou tagy — `readVoteTags()`, taky sdílené.
//
// Degrades gracefully to null (→ the page renders the honest DataUnavailable
// state) if no store is configured, the ledger or the tag layer is below
// readiness, or PGlite is unavailable at request time.

import "server-only";
import { cache } from "react";
import { reportLoaderFailure } from "@/lib/db/loaderGuard";
import { createLedgerMemo } from "./ledgerMemo";
import { readLedger, readVoteTags } from "./ledgerRead";
import { bucketOf, lineOf } from "./record/derive";
import type { ClubTally } from "./record/types";
import { selectQuestions } from "./kompas/select";
import type { KompasBallots, KompasClubLines, KompasData, KompasMp } from "./kompas/types";

const emptyTally = (): ClubTally => ({ yes: 0, no: 0, k: 0, away: 0 });

/** Cross-request memo of the DERIVED compass (compact), bounded by the money layer's
 *  window. A compass with no questions is never memoized — see ledgerMemo.ts. */
const kompasMemo = createLedgerMemo<KompasData>({ usable: (d) => d.questions.length > 0 });

/** Test seam: drop the cross-request memo. Never called by the app. */
export function resetKompasMemo(): void {
  kompasMemo.reset();
}

export const getKompas = cache(async function getKompas(): Promise<KompasData | null> {
  try {
    const memoized = kompasMemo.read();
    if (memoized !== null) return memoized;

    const ledger = await readLedger();
    if (ledger === null) return null;

    const tags = await readVoteTags();
    if (tags.length === 0) return null;

    const eventsIn = ledger.events;
    const themeByVote = new Map(tags.map((t) => [t.votePspId, t.theme]));

    /* full-chamber tallies for tagged votes (one O(ballots) pass) */
    const totals = new Map<number, ClubTally>();
    for (const b of ledger.ballots) {
      if (!themeByVote.has(b.votePspId)) continue;
      let t = totals.get(b.votePspId);
      if (!t) {
        t = emptyTally();
        totals.set(b.votePspId, t);
      }
      t[bucketOf(b.choice)]++;
    }

    const { selected, candidates } = selectQuestions({ events: eventsIn, totals, themeByVote });
    if (selected.length === 0) return null;
    const selectedIds = new Set(selected.map((s) => s.event.pspId));

    /* per-question positional record + club tallies (second O(ballots) pass) */
    const { clubByMandate, personByMandate, nameByPerson } = ledger;

    const ballotMap: KompasBallots = {};
    const clubTallies = new Map<number, Map<string, ClubTally>>();
    const mpSeen = new Map<number, KompasMp>();
    for (const b of ledger.ballots) {
      if (!selectedIds.has(b.votePspId)) continue;
      const person = personByMandate.get(b.mandatePspId);
      if (person === undefined) continue;
      const club = clubByMandate.get(b.mandatePspId) ?? null;
      if (!mpSeen.has(person)) {
        mpSeen.set(person, { personPspId: person, name: nameByPerson.get(person) ?? `#${person}`, club });
      }
      const bucket = bucketOf(b.choice);
      if (bucket !== "away") {
        (ballotMap[b.votePspId] ??= {})[person] = bucket;
      }
      if (club !== null) {
        let clubs = clubTallies.get(b.votePspId);
        if (!clubs) {
          clubs = new Map();
          clubTallies.set(b.votePspId, clubs);
        }
        let t = clubs.get(club);
        if (!t) {
          t = emptyTally();
          clubs.set(club, t);
        }
        t[bucket]++;
      }
    }

    const clubLines: KompasClubLines = {};
    for (const [voteId, clubs] of clubTallies) {
      for (const [club, t] of clubs) {
        const line = lineOf(t);
        if (line !== null) (clubLines[voteId] ??= {})[club] = line;
      }
    }

    const valid = eventsIn.filter((e) => !e.voided);
    const validDates = valid.map((e) => e.votedOn).filter((d): d is string => d !== null);
    let tagged = 0;
    for (const e of valid) if (themeByVote.has(e.pspId)) tagged++;

    const data: KompasData = {
      questions: selected.map((s) => ({
        votePspId: s.event.pspId,
        title: (s.event.titleLong ?? s.event.titleShort ?? s.event.titleNorm ?? "").trim() || `#${s.event.pspId}`,
        theme: s.theme,
        votedOn: s.event.votedOn,
        sessionNo: s.event.sessionNo,
        voteNo: s.event.voteNo,
        outcome: s.event.outcome,
        total: s.total,
        margin: s.margin,
        sourceUrl: s.event.sourceUrl,
      })),
      mps: [...mpSeen.values()].sort((a, b) => a.name.localeCompare(b.name, "cs")),
      ballots: ballotMap,
      clubLines,
      coverage: {
        valid: valid.length,
        tagged,
        candidates,
        from: validDates.length ? validDates.reduce((a, b) => (a < b ? a : b)) : null,
        to: validDates.length ? validDates.reduce((a, b) => (a > b ? a : b)) : null,
      },
    };
    kompasMemo.write(data);
    return data;
  } catch (err) {
    reportLoaderFailure("getKompas", err);
    return null;
  }
});
