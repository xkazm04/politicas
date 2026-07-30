"use client";

/**
 * /penize/strety — Vote-Collision Engine. Forenzní, klidná plocha: NEJDŘÍV
 * metodika (vyhlášené pravidlo joinu, doslova, včetně tabulky relevance
 * a poctivých čísel o tom, co do joinu nevstoupilo), TEPRVE POTOM kandidáti.
 *
 * Disciplína obviňujících tvrzení (batch-4, bod 17): každý řádek níž je
 * vypočtený ČASOVÝ PŘEKRYV, nikdy zjištění o věcné souvislosti — každý nese
 * štítek „vyžaduje lidské ověření" přímo na sobě, ne až v patičce. Hlas věty
 * je věcný jako FactRow: datum, typovaná věta složená z polí grafu, citace.
 * Žádné skandální rámování, žádná červená čísla, žádné animace.
 *
 * Kotvy: každý kandidát má stabilní adresu #s-<otisk> (obsahový otisk klíče,
 * vzor exhibit.ts) — scroll-mt + target:bg-paper-strong, tentýž vzor jako
 * /dukazy a /denik. Copy je česky přímo tady (messages/*.json je sdílený a
 * tahle plocha do něj nezapisuje — precedent batchů 1–3).
 */

import Link from "next/link";
import { ExternalLink, Link as LinkIcon } from "lucide-react";
import { useLocale } from "next-intl";
import { useFormat } from "@/lib/i18n/useFormat";
import SourceNote from "@/features/shared/components/SourceNote";
import SectionRule from "@/features/shared/components/SectionRule";
import { votePspUrl } from "@/features/votetrack/record/anchor";
import type { CollisionCandidate, CollisionData } from "./collisionTypes";
import { collisionAnchorId } from "./collisionTypes";
import {
  CONTRACT_STATUTES,
  DONATION_STATUTES,
  SUBSIDY_STATUTES,
} from "./statuteRelevance";

export default function StretyPage({ data }: { data: CollisionData | null }) {
  const locale = useLocale();
  const en = locale === "en";
  const f = useFormat();

  return (
    <main className="min-h-screen overflow-x-clip bg-paper font-sans text-ink">
      <header className="border-b-4 border-ink">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
          <span className="font-mono text-xs uppercase tracking-widest text-steel-aa">/ penize / strety</span>
          <Link
            href="/penize"
            className="font-mono text-xs uppercase tracking-widest text-steel-aa underline-offset-4 hover:text-ink hover:underline focus-visible:text-cobalt"
          >
            {en ? "back to the money ledger" : "zpět na peněžní ledger"}
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-10">
        <SourceNote tone="signal">
          {en
            ? "deterministic join over the graph · every candidate requires human verification"
            : "deterministický výpočet nad grafem · každý kandidát vyžaduje lidské ověření"}
        </SourceNote>
        <h1 className="mt-3 text-4xl font-black uppercase leading-[0.95] tracking-tight sm:text-5xl">
          {en ? "Vote collisions" : "Střety u hlasování"}
          <span className="text-signal">.</span>
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-steel-aa">
          {en
            ? "Where a verified company role and a chamber vote touch in time. Each row below is a computed candidate: an MP cast a positional vote on a print amending a statute that governs the public-money channel of a company where the registry confirms they held a role on that day. The time overlap is a fact; whether the vote actually concerned that company's interest is NOT computed here and requires a human reviewer."
            : "Kde se ověřená role ve firmě a sněmovní hlasování potkávají v čase. Každý řádek níž je vypočtený kandidát: poslanec hlasoval (ano/ne) o tisku novelizujícím zákon, který upravuje kanál veřejných peněz firmy, kde podle obchodního rejstříku v den hlasování zastával roli. Časový překryv je fakt; jestli se hlasování věcně týkalo zájmu té firmy, se tady NEPOČÍTÁ — to musí posoudit člověk."}
        </p>

        {data === null ? (
          <div className="mt-10 border-2 border-dashed border-hairline p-8">
            <p className="text-lg">
              {en
                ? "The data layer is unavailable in this environment — this page cannot say whether any candidates exist, and refuses to guess."
                : "Datová vrstva je v tomto prostředí nedostupná — stránka nemůže říct, jestli nějací kandidáti existují, a odmítá hádat."}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-steel-aa">
              {en
                ? "Candidates are re-derived from the live record on every request; nothing is cached as an accusation."
                : "Kandidáti se odvozují z živého záznamu při každém požadavku; nic se neukládá jako obvinění."}
            </p>
          </div>
        ) : (
          <>
            <Methodology data={data} en={en} fInt={f.int} />
            <Candidates data={data} en={en} />
            <div className="mt-14">
              <SourceNote>
                {en
                  ? `sources: kg money layer (pass ${f.int(data.pass)}) · psp.cz roll calls (vote_event/vote_ballot, PSP10) · amends edges of the legislation layer · rule ${data.ruleVersion}`
                  : `zdroje: peněžní vrstva grafu (pass ${f.int(data.pass)}) · hlasování psp.cz (vote_event/vote_ballot, PSP10) · amends hrany legislativní vrstvy · pravidlo ${data.ruleVersion}`}
              </SourceNote>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

/* ── metodika NA PRVNÍM MÍSTĚ ──────────────────────────────────────────────── */

function Methodology({ data, en, fInt }: { data: CollisionData; en: boolean; fInt: (n: number) => string }) {
  const c = data.coverage;
  const tables: { title: string; rows: readonly { ref: string; label: string }[] }[] = [
    {
      title: en ? "company has public contracts →" : "firma má veřejné zakázky →",
      rows: CONTRACT_STATUTES,
    },
    { title: en ? "company draws subsidies →" : "firma čerpá dotace →", rows: SUBSIDY_STATUTES },
    { title: en ? "company donated to a party →" : "firma darovala straně →", rows: DONATION_STATUTES },
  ];
  const rules = en
    ? [
        "Only ties that passed human review (verified), whose role the commercial registry confirms (ARES VR), and whose role period has a recorded start enter the join. A tie with no recorded review state counts as pending, never as verified.",
        "A roll call enters only if it is not voided and links deterministically to a print: primarily through the session agenda (psp.cz bod_schuze — session + agenda item → print), as a fallback through a print number in its title. An agenda item covering several prints at once (joint debate) is conservatively skipped and counted separately — no candidate is ever built on an ambiguous key.",
        "A print enters only if the graph records it amending at least one statute from the disclosed relevance table below, matched to the public-money channels that company actually has.",
        "The vote day must lie inside the registry-confirmed role period — both boundary days inclusive.",
        "Only a positional ballot (yes/no) forms a candidate; abstentions and absences never do.",
        "One candidate per (tie × vote); several affected statutes merge into that one row.",
      ]
    : [
        "Do joinu vstupují jen vazby, které prošly lidskou kontrolou (verified), jejichž roli potvrzuje obchodní rejstřík (ARES VR) a jejichž období role má zapsaný začátek. Vazba bez zapsaného stavu kontroly se počítá jako čekající, nikdy jako ověřená.",
        "Hlasování vstupuje, jen když není zmatečné a dá se deterministicky napojit na tisk: primárně přes pořad schůze (psp.cz bod_schuze — schůze + bod → tisk), záložně přes číslo tisku v titulku. Bod projednávající víc tisků najednou (společná rozprava) se konzervativně vynechává a počítá zvlášť — nad nejednoznačným klíčem se kandidát nikdy nestaví.",
        "Tisk vstupuje, jen když podle grafu novelizuje aspoň jeden zákon z níže vyhlášené tabulky relevance, napojené na kanály veřejných peněz, které ta firma skutečně má.",
        "Den hlasování musí ležet v rejstříkovém období role — oba krajní dny včetně.",
        "Kandidáta tvoří jen poziční hlas (ano/ne); zdržení a nepřítomnost nikdy.",
        "Jeden kandidát na (vazba × hlasování); víc zasažených zákonů se sčítá do téhož řádku.",
      ];

  return (
    <section className="mt-12" aria-labelledby="metodika">
      <h2 id="metodika" className="text-xl font-black uppercase tracking-tight">
        {en ? "Join rule" : "Pravidlo spojení"}{" "}
        <span className="font-mono text-sm font-normal normal-case tracking-wider text-steel-aa">{data.ruleVersion}</span>
      </h2>
      <div className="mt-3 max-w-md">
        <SectionRule />
      </div>
      <ol className="mt-5 max-w-3xl list-decimal space-y-2 pl-5 text-sm leading-relaxed text-ink">
        {rules.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ol>

      {/* tabulka relevance — doslova, protože je součástí tvrzení */}
      <div className="mt-8 grid gap-px border border-ink bg-ink sm:grid-cols-3">
        {tables.map((t) => (
          <div key={t.title} className="bg-paper p-4">
            <p className="font-mono text-xs font-bold uppercase tracking-widest text-cobalt">{t.title}</p>
            <ul className="mt-2 space-y-1 text-sm leading-relaxed">
              {t.rows.map((r) => (
                <li key={r.ref}>
                  <span className="font-mono text-xs">{r.ref} Sb.</span> — {r.label}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="mt-2 max-w-3xl text-xs leading-relaxed text-steel-aa">
        {en
          ? "The channel → statute table is fixed and printed verbatim above; it claims nothing about the substantive reach of any particular amendment. That is exactly why every candidate requires human verification."
          : "Tabulka kanál → zákon je pevná a vypsaná doslova výš; netvrdí nic o věcném dosahu konkrétní novely. Přesně proto každý kandidát vyžaduje lidské ověření."}
      </p>

      {/* poctivá čísla o vstupu joinu */}
      <div className="mt-8 grid grid-cols-2 gap-px border border-ink bg-ink sm:grid-cols-4">
        <CoverageCell label={en ? "ties in the graph" : "vazeb v grafu"} value={fInt(c.tiesTotal)} />
        <CoverageCell label={en ? "passed human review" : "prošlo lidskou kontrolou"} value={fInt(c.tiesVerified)} />
        <CoverageCell label={en ? "enter the join" : "vstupuje do joinu"} value={fInt(c.tiesEntering)} />
        <CoverageCell label={en ? "computed candidates" : "vypočtených kandidátů"} value={fInt(c.candidates)} />
        <CoverageCell label={en ? "valid roll calls" : "platných hlasování"} value={fInt(c.events)} />
        <CoverageCell label={en ? "linked to a print" : "napojených na tisk"} value={fInt(c.eventsLinked)} />
        <CoverageCell label={en ? "skipped: joint debates" : "vynecháno: společné rozpravy"} value={fInt(c.eventsAmbiguousAgenda)} />
        <CoverageCell label={en ? "prints matched to votes" : "tisků napojených na hlasování"} value={fInt(c.billsMatchedToVotes)} />
      </div>
      {!data.agendaAvailable && (
        <p className="mt-2 max-w-3xl text-xs leading-relaxed text-steel-aa">
          {en
            ? "The session agenda dump (schuze.zip) is unavailable in this environment — only the title fallback links votes to prints here, so the linked count is a floor, not the record."
            : "Dump pořadu schůze (schuze.zip) není v tomto prostředí dostupný — hlasování se na tisky napojují jen záložním titulkovým pravidlem, takže počet napojených je dolní mez, ne záznam."}
        </p>
      )}
      <p className="mt-2 max-w-3xl text-xs leading-relaxed text-steel-aa">
        {en
          ? `${fInt(c.tiesPendingWouldEnter)} registry-confirmed tie(s) with a recorded role period are still awaiting human review and would enter the join once verified; ${fInt(c.tiesVerifiedWithoutPeriod)} verified tie(s) stay out solely because the registry period is missing. Neither group produces candidates here.`
          : `${fInt(c.tiesPendingWouldEnter)} rejstříkem potvrzených vazeb se zapsaným obdobím role teprve čeká na lidskou kontrolu a do joinu by vstoupily po ověření; ${fInt(c.tiesVerifiedWithoutPeriod)} ověřených vazeb zůstává mimo jen proto, že chybí rejstříkové období. Ani jedna skupina tady kandidáty netvoří.`}
      </p>
    </section>
  );
}

function CoverageCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-paper p-4">
      <p className="font-mono text-2xl font-black tabular-nums">{value}</p>
      <p className="mt-1 font-mono text-xs uppercase tracking-wider text-steel-aa">{label}</p>
    </div>
  );
}

/* ── kandidáti ─────────────────────────────────────────────────────────────── */

function Candidates({ data, en }: { data: CollisionData; en: boolean }) {
  const c = data.coverage;
  return (
    <section className="mt-14" aria-labelledby="kandidati">
      <h2 id="kandidati" className="text-xl font-black uppercase tracking-tight">
        {en ? "Candidates" : "Kandidáti"}
        <span className="text-signal">.</span>
      </h2>
      <div className="mt-3 max-w-md">
        <SectionRule />
      </div>

      {data.candidates.length === 0 ? (
        <div className="mt-6 border-2 border-dashed border-hairline p-8">
          {c.tiesEntering === 0 ? (
            <>
              <p className="text-lg">
                {en
                  ? "No tie currently clears the join's entry gate — so there are zero candidates, honestly, not because nothing was checked."
                  : "Žádná vazba zatím neprošla vstupní branou joinu — kandidátů je proto nula poctivě, ne proto, že by se nic nekontrolovalo."}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-steel-aa">
                {en
                  ? "The gate requires human review + registry confirmation + a recorded role period (rule 1 above). The queue for reviewers lives at /penize/kontrola."
                  : "Brána vyžaduje lidskou kontrolu + potvrzení rejstříkem + zapsané období role (pravidlo 1 výš). Fronta pro kontrolory je na /penize/kontrola."}{" "}
                <Link href="/penize/kontrola" className="underline underline-offset-4 hover:text-ink focus-visible:text-cobalt">
                  {en ? "open the review console" : "otevřít kontrolní konzoli"}
                </Link>
              </p>
            </>
          ) : (
            <p className="text-lg">
              {en
                ? "The join ran over every eligible tie and the full roll-call ledger and found no time overlap that satisfies the rule. Zero is the result, not a gap."
                : "Join proběhl přes všechny způsobilé vazby a celý hlasovací ledger a nenašel žádný časový překryv splňující pravidlo. Nula je výsledek, ne mezera."}
            </p>
          )}
        </div>
      ) : (
        <div className="mt-6 border-t-2 border-ink">
          {data.candidates.map((cand) => (
            <CandidateRow key={cand.id} c={cand} en={en} />
          ))}
        </div>
      )}
    </section>
  );
}

function CandidateRow({ c, en }: { c: CollisionCandidate; en: boolean }) {
  const f = useFormat();
  const anchor = collisionAnchorId(c.id);
  const statuteList = c.statutes.map((s) => `${s.ref} Sb.`).join(", ");
  const choiceCs = c.choice === "yes" ? "ano" : "ne";
  const choiceEn = c.choice === "yes" ? "yes" : "no";
  return (
    <article
      id={anchor}
      className="grid scroll-mt-24 gap-x-6 gap-y-2 border-b border-hairline py-5 target:bg-paper-strong sm:grid-cols-[7rem_1fr]"
    >
      <div className="font-mono text-xs uppercase tracking-wider text-steel-aa">{f.date(c.votedOn)}</div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="border-2 border-ochre bg-ochre/15 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-ink">
            {en ? "candidate · requires human verification" : "kandidát · vyžaduje lidské ověření"}
          </span>
          <a
            href={`#${anchor}`}
            aria-label={en ? `permanent link to this candidate (${c.personName})` : `trvalý odkaz na tohoto kandidáta (${c.personName})`}
            className="border border-hairline p-1 text-steel-aa transition-colors hover:border-ink hover:text-signal focus-visible:border-cobalt focus-visible:text-cobalt"
          >
            <LinkIcon className="h-3.5 w-3.5" aria-hidden />
          </a>
        </div>
        {/* Věta se sází z typovaných polí grafu — v řádku nemůže být tvrzení,
            které graf nenese (vzor FactRow). */}
        <p className="mt-2 text-[15px] leading-relaxed">
          {en ? (
            <>
              <Link href={`/poslanec/${c.personPspId}`} className="font-bold underline underline-offset-4 hover:text-signal focus-visible:text-cobalt">
                {c.personName}
              </Link>
              {c.club ? ` (${c.club})` : ""} voted <span className="font-bold">{choiceEn}</span> on print{" "}
              <Link href={`/zakony/${c.billCislo}`} className="underline underline-offset-4 hover:text-signal focus-visible:text-cobalt">
                {c.billCislo}
              </Link>{" "}
              — “{c.billTitle}” — which amends {statuteList}. On the vote day the commercial registry records the role
              “{c.role}” at {c.company} (IČO {c.ico}).
            </>
          ) : (
            <>
              <Link href={`/poslanec/${c.personPspId}`} className="font-bold underline underline-offset-4 hover:text-signal focus-visible:text-cobalt">
                {c.personName}
              </Link>
              {c.club ? ` (${c.club})` : ""} hlasoval(a) <span className="font-bold">{choiceCs}</span> o tisku{" "}
              <Link href={`/zakony/${c.billCislo}`} className="underline underline-offset-4 hover:text-signal focus-visible:text-cobalt">
                {c.billCislo}
              </Link>{" "}
              — „{c.billTitle}“ — který novelizuje {statuteList}. V den hlasování obchodní rejstřík eviduje roli
              „{c.role}“ ve firmě {c.company} (IČO {c.ico}).
            </>
          )}
        </p>
        <p className="mt-1 font-mono text-xs uppercase tracking-wider text-steel-aa">
          {en ? "registry role period" : "období role dle rejstříku"}: {f.date(c.roleValidFrom)} –{" "}
          {c.roleValidTo ? f.date(c.roleValidTo) : en ? "no recorded end" : "bez zapsaného konce"}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-steel-aa">
          {en
            ? "The time overlap is computed; the substantive link is not established here and must be assessed by a human reviewer."
            : "Časový překryv je vypočtený; věcná souvislost tady doložena není a musí ji posoudit člověk."}
        </p>
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs uppercase tracking-wider">
          <a
            href={votePspUrl(c.votePspId)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-steel-aa underline underline-offset-4 hover:text-ink focus-visible:text-cobalt"
          >
            {en ? "roll call on psp.cz" : "hlasování na psp.cz"}
            <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
          <Link href={`/penize/${c.personPspId}`} className="text-steel-aa underline underline-offset-4 hover:text-ink focus-visible:text-cobalt">
            {en ? "money case file" : "peněžní spis poslance"}
          </Link>
        </p>
      </div>
    </article>
  );
}
