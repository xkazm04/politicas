// Server-only loader for the Volební kompas naruby (moonshot 5B): joins the
// REAL PSP10 vote ledger (vote_event + vote_ballot) with the Silver-layer
// vote_tag themes, clubs, mandates and person names, runs the disclosed
// selection rule (kompas/select.ts) and ships the /kompas client tree a
// compact positional record of the ~20 selected roll calls. Alignment itself
// is computed client-side (kompas/score.ts) from the reader's answers — the
// URL is the whole state, no accounts.
//
// ── Čtecí cesta (2026-08-11) ───────────────────────────────────────────────
// Do 2026-08-10 si tenhle loader četl SVÝCH pět relací vedle getVoteRecord.ts.
// Pak obojí šlo přes `readLedger()` — jedno čtení v jednom požadavku — ale
// napříč požadavky si kompas držel VLASTNÍ memo nad VLASTNÍ derivací, takže
// studený /kompas platil celý průchod 406 000 hlasy i ve chvíli, kdy /hlasovani
// mělo záznam teplý. A počítal si přitom dvě věci, které ta derivace už spočítala
// a zahodila: celosněmovní tally každého otagovaného hlasování a linii klubu.
//
// Teď kompas JEDE NA ZÁZNAMU: otázky vybírá z `record.voteIndex`
// (record/types.ts) — rejstříku, který `getFullVoteRecord()` odvozuje a memoizuje
// pro obě plochy. Vlastní memo tady žádné není: dvě mema nad jedním záznamem jsou
// dvoje hodiny nad jedním číslem (precedens features/profile/getRebellionRecord.ts).
//
// Jediné, co kompas z hlasů opravdu potřebuje a záznam to neveze, jsou JMENOVITÉ
// hlasy vybraných ~20 hlasování. Ty se čtou indexovaně přes `vote_ballot_vote_idx`
// (`readBallotsForVotes`) — ~4 000 řádků místo 406 000.
//
// Pořadí čtení je taky rozhodnutí: tagy jdou PRVNÍ. Jsou to jednotky ms a bez nich
// kompas neexistuje; do 2026-08-11 se četly až po záznamu, takže store s prázdnou
// silver vrstvou (dnešní živý stav: 0 řádků ve `vote_tag`) platil ~15 s čtení hlasů
// jen proto, aby vzápětí odpověděl „data nedostupná".
//
// Degrades gracefully to null (→ the page renders the honest DataUnavailable
// state) if no store is configured, the ledger is below readiness, or PGlite is
// unavailable at request time. VÝBĚR, KTERÝ POCTIVĚ NEVYBRAL NIC, null NENÍ —
// vrací se záznam s prázdnými otázkami a stránka pro něj má vlastní větu
// (výpadek a prázdno jsou dvě různá tvrzení).
//
// ── A od 2026-08-12 ani prázdná vrstva štítků není výpadek ─────────────────────
// `vote_tag` je NAŠE odvozená vrstva a na živém store má nula řádků — nikdy se
// nespočítala. Loader na to vracel `null`, tedy tutéž odpověď jako na nečitelný
// store, a /kompas nad tím tiskl „data nedostupná". Teď se vrací třetí, TYPOVANÝ
// stav (`silverLayer.ts`) a stránka pro něj má vlastní věty.
//
// Ten stav musí stát na ÚSPĚŠNÉM čtení: `readVoteTags()` vrací prázdné pole i bez
// store, takže se napřed sáhne pro store (`getStore()` — memoizovaný handle, žádný
// dotaz navíc, `readVoteTags` si o něj stejně říká vzápětí). Bez toho by se výpadek
// vydával za nespočítanou vrstvu.

import "server-only";
import { cache } from "react";
import { reportLoaderFailure } from "@/lib/db/loaderGuard";
import { getStore } from "@/lib/db/store";
import { getFullVoteRecord } from "./getVoteRecord";
import { readBallotsForVotes, readRegistry, readVoteTags } from "./ledgerRead";
import { bucketOf } from "./record/derive";
import { selectQuestions } from "./kompas/select";
import { SILVER_NEVER_COMPUTED, silverReady, type SilverLayerRead } from "./silverLayer";
import type { KompasBallots, KompasClubLines, KompasData, KompasMp } from "./kompas/types";

export const getKompas = cache(async function getKompas(): Promise<SilverLayerRead<KompasData> | null> {
  try {
    const store = await getStore();
    if (!store) return null;
    const tags = await readVoteTags();
    if (tags.length === 0) return SILVER_NEVER_COMPUTED;

    const record = await getFullVoteRecord();
    if (record === null) return null;

    const themeByVote = new Map(tags.map((t) => [t.votePspId, t.theme]));
    // Sebehlášená jistota klasifikátoru — dosud se při mapování tagů zahazovala,
    // takže špatně zařazené hlasování mohlo tiše změnit, kterých ~20 hlasování
    // reprezentuje období. Práh (select.ts) i počty vyřazených jdou na stránku.
    const confidenceByVote = new Map(tags.map((t) => [t.votePspId, t.confidence]));

    const selection = selectQuestions({ votes: record.voteIndex, themeByVote, confidenceByVote });

    let tagged = 0;
    for (const v of record.voteIndex) if (themeByVote.has(v.pspId)) tagged++;

    // Pokrytí se NEPOČÍTÁ ZNOVU: `valid`, okno deníku i rozsah dat jsou pole
    // téhož záznamu, který kreslí /hlasovani. Kdyby se dopočítávala tady, mohly
    // by dvě plochy o jednom období tvrdit dvě různá čísla.
    const coverage: KompasData["coverage"] = {
      valid: record.coverage.valid,
      tagged,
      candidates: selection.candidates,
      droppedByTheme: selection.droppedByTheme,
      withoutBallots: selection.withoutBallots,
      droppedByPositional: selection.droppedByPositional,
      droppedByConfidence: selection.droppedByConfidence,
      withoutConfidence: selection.withoutConfidence,
      ledgerWindow: record.coverage.ledgerWindow,
      from: record.coverage.from,
      to: record.coverage.to,
    };

    const questions = selection.selected.map((s) => ({
      votePspId: s.vote.pspId,
      title: s.vote.title,
      theme: s.theme,
      votedOn: s.vote.votedOn,
      sessionNo: s.vote.sessionNo,
      voteNo: s.vote.voteNo,
      outcome: s.vote.outcome,
      total: s.total,
      margin: s.margin,
      sourceUrl: s.vote.sourceUrl,
      inLedger: s.vote.inLedger,
    }));

    // Poctivé prázdno: pravidlo proběhlo nad přečteným záznamem a nevybralo nic.
    // Žádné čtení hlasů se kvůli tomu nekoná — a stránka to smí říct jinak než výpadek.
    if (questions.length === 0) {
      return silverReady({ questions, mps: [], ballots: {}, clubLines: {}, coverage });
    }

    // Linie klubů si kompas UŽ NEPOČÍTÁ — jsou to tytéž přísné většiny, které
    // record/derive.ts spočítal pro celou sněmovnu (a /hlasovani z nich kreslí
    // disciplínu klubů). Druhá kopie toho pravidla by znamenala dvě odpovědi na
    // otázku, jak klub v jednom hlasování stál.
    const clubLines: KompasClubLines = {};
    for (const s of selection.selected) {
      if (Object.keys(s.vote.clubLines).length > 0) clubLines[s.vote.pspId] = { ...s.vote.clubLines };
    }

    /* jmenovité hlasy vybraných hlasování — jediné, co potřebuje syrové hlasy */
    const registry = await readRegistry();
    if (registry === null) return null;
    const rows = await readBallotsForVotes(questions.map((q) => q.votePspId));
    if (rows.length === 0) {
      // Vybraná hlasování existují, hlasy k nim ne — to je nečitelná vrstva, ne
      // sněmovna, ve které nikdo nehlasoval. Prázdný poziční záznam by z výpadku
      // udělal tvrzení o poslancích.
      reportLoaderFailure(
        "getKompas",
        new Error(`no ballots for ${questions.length} selected roll calls`),
      );
      return null;
    }

    const { clubByMandate, personByMandate, nameByPerson } = registry;
    const ballotMap: KompasBallots = {};
    const mpSeen = new Map<number, KompasMp>();
    for (const b of rows) {
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
    }

    return silverReady({
      questions,
      mps: [...mpSeen.values()].sort((a, b) => a.name.localeCompare(b.name, "cs")),
      ballots: ballotMap,
      clubLines,
      coverage,
    });
  } catch (err) {
    reportLoaderFailure("getKompas", err);
    return null;
  }
});
