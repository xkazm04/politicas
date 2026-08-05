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
 * /dukazy a /denik. Copy žije v katalogu messages/*.json pod money.strety.*
 * (bilingvní migrace 2026-08).
 */

import Link from "next/link";
import { ExternalLink, Link as LinkIcon } from "lucide-react";
import { useTranslations } from "next-intl";
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

const RULE_KEYS = ["r1", "r2", "r3", "r4", "r5", "r6"] as const;

export default function StretyPage({ data }: { data: CollisionData | null }) {
  const t = useTranslations("money");
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
            {t("strety.backToLedger")}
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-10">
        <SourceNote tone="signal">{t("strety.eyebrow")}</SourceNote>
        <h1 className="mt-3 text-4xl font-black uppercase leading-[0.95] tracking-tight sm:text-5xl">
          {t("strety.title")}
          <span className="text-signal">.</span>
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-steel-aa">{t("strety.intro")}</p>

        {data === null ? (
          <div className="mt-10 border-2 border-dashed border-hairline p-8">
            <p className="text-lg">{t("strety.unavailable")}</p>
            <p className="mt-2 text-sm leading-relaxed text-steel-aa">{t("strety.unavailableNote")}</p>
          </div>
        ) : (
          <>
            <Methodology data={data} fInt={f.int} />
            <Candidates data={data} />
            <div className="mt-14">
              <SourceNote>
                {t("strety.sources", { pass: f.int(data.pass), rule: data.ruleVersion })}
              </SourceNote>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

/* ── metodika NA PRVNÍM MÍSTĚ ──────────────────────────────────────────────── */

function Methodology({ data, fInt }: { data: CollisionData; fInt: (n: number) => string }) {
  const t = useTranslations("money");
  const c = data.coverage;
  const tables: { title: string; rows: readonly { ref: string; label: string }[] }[] = [
    { title: t("strety.tableContracts"), rows: CONTRACT_STATUTES },
    { title: t("strety.tableSubsidies"), rows: SUBSIDY_STATUTES },
    { title: t("strety.tableDonations"), rows: DONATION_STATUTES },
  ];

  return (
    <section className="mt-12" aria-labelledby="metodika">
      <h2 id="metodika" className="text-xl font-black uppercase tracking-tight">
        {t("strety.joinRule")}{" "}
        <span className="font-mono text-sm font-normal normal-case tracking-wider text-steel-aa">{data.ruleVersion}</span>
      </h2>
      <div className="mt-3 max-w-md">
        <SectionRule />
      </div>
      <ol className="mt-5 max-w-3xl list-decimal space-y-2 pl-5 text-sm leading-relaxed text-ink">
        {RULE_KEYS.map((k) => (
          <li key={k}>{t(`strety.rules.${k}`)}</li>
        ))}
      </ol>

      {/* tabulka relevance — doslova, protože je součástí tvrzení */}
      <div className="mt-8 grid gap-px border border-ink bg-ink sm:grid-cols-3">
        {tables.map((tbl) => (
          <div key={tbl.title} className="bg-paper p-4">
            <p className="font-mono text-xs font-bold uppercase tracking-widest text-cobalt">{tbl.title}</p>
            <ul className="mt-2 space-y-1 text-sm leading-relaxed">
              {tbl.rows.map((r) => (
                <li key={r.ref}>
                  <span className="font-mono text-xs">{r.ref} Sb.</span> — {r.label}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="mt-2 max-w-3xl text-xs leading-relaxed text-steel-aa">{t("strety.tableNote")}</p>

      {/* poctivá čísla o vstupu joinu */}
      <div className="mt-8 grid grid-cols-2 gap-px border border-ink bg-ink sm:grid-cols-4">
        <CoverageCell label={t("strety.covTies")} value={fInt(c.tiesTotal)} />
        <CoverageCell label={t("strety.covVerified")} value={fInt(c.tiesVerified)} />
        <CoverageCell label={t("strety.covEntering")} value={fInt(c.tiesEntering)} />
        <CoverageCell label={t("strety.covCandidates")} value={fInt(c.candidates)} />
        <CoverageCell label={t("strety.covEvents")} value={fInt(c.events)} />
        <CoverageCell label={t("strety.covLinked")} value={fInt(c.eventsLinked)} />
        <CoverageCell label={t("strety.covAmbiguous")} value={fInt(c.eventsAmbiguousAgenda)} />
        <CoverageCell label={t("strety.covBills")} value={fInt(c.billsMatchedToVotes)} />
      </div>
      {!data.agendaAvailable && (
        <p className="mt-2 max-w-3xl text-xs leading-relaxed text-steel-aa">{t("strety.agendaNote")}</p>
      )}
      <p className="mt-2 max-w-3xl text-xs leading-relaxed text-steel-aa">
        {t("strety.pendingNote", {
          pending: fInt(c.tiesPendingWouldEnter),
          noPeriod: fInt(c.tiesVerifiedWithoutPeriod),
        })}
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

function Candidates({ data }: { data: CollisionData }) {
  const t = useTranslations("money");
  const c = data.coverage;
  return (
    <section className="mt-14" aria-labelledby="kandidati">
      <h2 id="kandidati" className="text-xl font-black uppercase tracking-tight">
        {t("strety.candidates")}
        <span className="text-signal">.</span>
      </h2>
      <div className="mt-3 max-w-md">
        <SectionRule />
      </div>

      {data.candidates.length === 0 ? (
        <div className="mt-6 border-2 border-dashed border-hairline p-8">
          {c.tiesEntering === 0 ? (
            <>
              <p className="text-lg">{t("strety.emptyGate")}</p>
              <p className="mt-2 text-sm leading-relaxed text-steel-aa">
                {t("strety.emptyGateNote")}{" "}
                <Link href="/penize/kontrola" className="underline underline-offset-4 hover:text-ink focus-visible:text-cobalt">
                  {t("strety.openConsole")}
                </Link>
              </p>
            </>
          ) : (
            <p className="text-lg">{t("strety.emptyResult")}</p>
          )}
        </div>
      ) : (
        <div className="mt-6 border-t-2 border-ink">
          {data.candidates.map((cand) => (
            <CandidateRow key={cand.id} c={cand} />
          ))}
        </div>
      )}
    </section>
  );
}

function CandidateRow({ c }: { c: CollisionCandidate }) {
  const t = useTranslations("money");
  const f = useFormat();
  const anchor = collisionAnchorId(c.id);
  const statuteList = c.statutes.map((s) => `${s.ref} Sb.`).join(", ");
  const choice = c.choice === "yes" ? t("strety.choiceYes") : t("strety.choiceNo");
  return (
    <article
      id={anchor}
      className="grid scroll-mt-24 gap-x-6 gap-y-2 border-b border-hairline py-5 target:bg-paper-strong sm:grid-cols-[7rem_1fr]"
    >
      <div className="font-mono text-xs uppercase tracking-wider text-steel-aa">{f.date(c.votedOn)}</div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="border-2 border-ochre bg-ochre/15 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-ink">
            {t("strety.candidateBadge")}
          </span>
          <a
            href={`#${anchor}`}
            aria-label={t("strety.permalinkAria", { name: c.personName })}
            className="border border-hairline p-1 text-steel-aa transition-colors hover:border-ink hover:text-signal focus-visible:border-cobalt focus-visible:text-cobalt"
          >
            <LinkIcon className="h-3.5 w-3.5" aria-hidden />
          </a>
        </div>
        {/* Věta se sází z typovaných polí grafu — v řádku nemůže být tvrzení,
            které graf nenese (vzor FactRow). */}
        <p className="mt-2 text-[15px] leading-relaxed">
          {t.rich("strety.sentence", {
            mp: (chunks) => (
              <Link href={`/poslanec/${c.personPspId}`} className="font-bold underline underline-offset-4 hover:text-signal focus-visible:text-cobalt">
                {chunks}
              </Link>
            ),
            print: (chunks) => (
              <Link href={`/zakony/${c.billCislo}`} className="underline underline-offset-4 hover:text-signal focus-visible:text-cobalt">
                {chunks}
              </Link>
            ),
            b: (chunks) => <span className="font-bold">{chunks}</span>,
            name: c.personName,
            club: c.club ? ` (${c.club})` : "",
            choice,
            bill: c.billCislo,
            billTitle: c.billTitle,
            statutes: statuteList,
            role: c.role,
            company: c.company,
            ico: c.ico,
          })}
        </p>
        <p className="mt-1 font-mono text-xs uppercase tracking-wider text-steel-aa">
          {t("strety.rolePeriod")}: {f.date(c.roleValidFrom)} –{" "}
          {c.roleValidTo ? f.date(c.roleValidTo) : t("strety.noRecordedEnd")}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-steel-aa">{t("strety.overlapNote")}</p>
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs uppercase tracking-wider">
          <a
            href={votePspUrl(c.votePspId)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-steel-aa underline underline-offset-4 hover:text-ink focus-visible:text-cobalt"
          >
            {t("strety.rollCall")}
            <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
          <Link href={`/penize/${c.personPspId}`} className="text-steel-aa underline underline-offset-4 hover:text-ink focus-visible:text-cobalt">
            {t("shared.mpMoneyFile")}
          </Link>
        </p>
      </div>
    </article>
  );
}
