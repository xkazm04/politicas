"use client";

/*
 * Paměť zákona — /zakony/predpis/[ref] (moonshot 5A). Kritické vydání
 * jednoho předpisu: hlava zákona, kronika tisků, které ho měnily (kdo, kdy,
 * s jakou proveniencí vazby), a §-stopa — doslovné před/po každého doloženého
 * fragmentu mezi dvěma platnými zněními e-Sbírky, s marginálií kandidátů okna.
 *
 * Poctivost je součást sazby: pokrytí autorství se přiznává nahoře na stránce
 * (kolik tisků je vyhlášených, kolik § nese stopu, že kandidát ≠ doložený
 * autor), každá skupina § má trvalou kotvu `#p-<§>` a každé okno odkazuje na
 * obě konsolidovaná znění (ELI). Žádná animace — archová sazba, ne přístroj.
 *
 * Čtyři dlaždice pokrytí jsou CITACE (features/lawwatch/lawClaims.ts): každá nese
 * vlastní trvalou adresu, kterou /overeni znovu odvodí přes tentýž dosjar. Stav
 * brány je součást tvrzení a u téhle rodiny je to `ungated` — pokrytí je
 * aritmetika censu a žádná lidská brána pro počítání neexistuje; věta o tom
 * pochází ze slovníku /overeni, ne z druhé kopie téže formulace.
 */

import Link from "next/link";
import { ArrowLeft, ArrowUpRight, ExternalLink, Link as LinkIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import CitableNumber from "@/lib/claims/CitableNumber";
import { defaultLocale, isLocale } from "@/lib/i18n/config";
import { useFormat } from "@/lib/i18n/useFormat";
import SectionHeading from "@/features/shared/components/SectionHeading";
import SectionRule from "@/features/shared/components/SectionRule";
import SourceNote from "@/features/shared/components/SourceNote";
import { GATE_UNGATED_KEY } from "@/features/overeni/gateVocabulary";
import type { ParagraphTrail, StatuteDossier, StatuteTrailEntry } from "./deriveStatuteDossier";
import { statuteCoverageClaim, statuteCoverageValue } from "./lawClaims";
import { DIFF_OP_KEYS, SPONSOR_ROLE_KEYS, esbirkaUrl } from "./lawwatchLabels";

export default function StatuteDossierPage({ dossier }: { dossier: StatuteDossier }) {
  const t = useTranslations("lawwatch");
  const tOvereni = useTranslations("overeni");
  const f = useFormat();
  // Táž cesta k locale jako v `useFormat` — viditelný text svědčícího čísla musí
  // být bajtově týž, jaký by vysázel prostý formátovač (kontrakt CitableNumber).
  const rawLocale = useLocale();
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const c = dossier.coverage;
  const esb = esbirkaUrl(dossier.ref);

  return (
    <main className="min-h-screen overflow-x-clip bg-paper font-sans text-ink">
      <header className="border-b-4 border-ink">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
          <span className="font-mono text-xs uppercase tracking-widest text-steel">{t("registry.crumb")}</span>
          <Link
            href="/zakony/predpis"
            className="inline-flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-cobalt transition-colors hover:text-signal"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> {t("statute.backToRegistry")}
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6">
        {/* ── Hlava zákona ─────────────────────────────────── */}
        <div className="py-10">
          <SourceNote tone="signal">{t("statute.eyebrow")}</SourceNote>
          <h1 className="mt-3 text-4xl font-black uppercase leading-[0.95] tracking-tight sm:text-5xl">
            {t("statute.title", { ref: dossier.ref })}<span className="text-signal">.</span>
          </h1>
          {dossier.title && <p className="mt-3 max-w-3xl text-lg font-bold leading-snug">{dossier.title}</p>}
          <div className="mt-4 max-w-xl">
            <SectionRule />
          </div>
          <p className="mt-4 max-w-3xl text-base leading-relaxed text-steel">
            {t("statute.intro")}
          </p>
          {esb && (
            <a
              href={esb}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-cobalt transition-colors hover:text-signal"
            >
              {t("statute.esbirkaFull")} <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>

        {/* ── Statistický pás ──────────────────────────────── */}
        <div className="grid grid-cols-2 gap-px border-2 border-ink bg-ink sm:grid-cols-4">
          {(
            [
              { m: "trailBills", l: t("statute.stats.inTrail", { count: c.trailBills }) },
              { m: "enactedBills", l: t("statute.stats.enacted") },
              { m: "paragraphs", l: t("statute.stats.paragraphs") },
              { m: "changes", l: t("statute.stats.changes") },
            ] as const
          ).map((s) => {
            // Metrika i hodnota se páruje v lawClaims — dlaždice nemá vlastní
            // mapování, takže citované číslo je vždy to vysázené. Předpis, jehož
            // ref nejde kanonicky složit, claim nedostane a sází se prosté číslo.
            const figure = statuteCoverageClaim(dossier.ref, s.m, c);
            return (
              <div key={s.l} className="bg-paper px-4 py-4">
                <div className="text-3xl font-black tabular-nums">
                  {figure ? (
                    <CitableNumber value={figure.value} claim={figure.claim} locale={locale} kind="int" />
                  ) : (
                    f.int(statuteCoverageValue(c, s.m))
                  )}
                </div>
                <div className="mt-0.5 font-mono text-[11px] uppercase tracking-wider text-steel">{s.l}</div>
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <SourceNote>
            {t("statute.statsSource", { windows: c.windows, windowsFmt: f.int(c.windows) })}
          </SourceNote>
          {/* Stav brány stojí u figury (vzor peněžních ploch). Tady je to negatovaná
              relace: počítání tisků, § a doložených změn žádnou lidskou branou neprochází. */}
          <SourceNote tone="steel" className="!text-ochre">
            {tOvereni(GATE_UNGATED_KEY)}
          </SourceNote>
        </div>

        {/* ── Pokrytí autorství — přiznané, ne schované ────── */}
        <div className="mt-4 border-l-4 border-ochre bg-ochre/5 p-4">
          <SourceNote tone="steel" className="!text-ochre">
            {t("statute.coverage.source")}
          </SourceNote>
          <p className="mt-2 max-w-3xl text-[13px] leading-relaxed">
            {t.rich("statute.coverage.text", {
              trailBills: c.trailBills,
              trailBillsFmt: f.int(c.trailBills),
              censusOnlyFmt: f.int(c.censusOnlyBills),
              paragraphs: c.paragraphs,
              paragraphsFmt: f.int(c.paragraphs),
              changes: c.changes,
              changesFmt: f.int(c.changes),
              candidatesClause:
                c.changes > 0
                  ? t("statute.coverage.candidates", { countFmt: f.int(c.changesWithCandidates) })
                  : "",
              b: (chunks) => <span className="font-black">{chunks}</span>,
              bold: (chunks) => <span className="font-bold">{chunks}</span>,
            })}
          </p>
        </div>

        {/* ── 01 Kronika tisků ─────────────────────────────── */}
        <section id="kronika" className="mt-12">
          <SectionHeading
            index={1}
            title={t("statute.chronicleTitle")}
            aside={
              <SourceNote>
                {t("statute.chronicleAside", { count: c.trailBills, countFmt: f.int(c.trailBills) })}
              </SourceNote>
            }
          />
          <div className="mt-8 border-t-2 border-ink">
            {dossier.trail.map((entry) => (
              <TrailRow key={entry.tiskId} entry={entry} />
            ))}
          </div>
          <p className="mt-4 max-w-3xl text-sm italic leading-relaxed text-steel">
            {t("statute.chronicleFootnote")}
          </p>
        </section>

        {/* ── 02 §-stopa ───────────────────────────────────── */}
        <section id="paragrafy" className="mt-14 border-t-4 border-ink pt-10 pb-20">
          <SectionHeading
            index={2}
            title={t("statute.trailTitle")}
            aside={
              <SourceNote>
                {c.changes > 0
                  ? t("statute.trailAside", {
                      paragraphsFmt: f.int(c.paragraphs),
                      changes: c.changes,
                      changesFmt: f.int(c.changes),
                    })
                  : t("statute.trailAsideEmpty")}
              </SourceNote>
            }
          />
          {dossier.paragraphs.length > 0 ? (
            <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(8rem,2fr)_9fr]">
              {/* § rejstřík — sloupec kritického vydání */}
              <nav aria-label={t("statute.paragraphNavAria")} className="lg:sticky lg:top-8 lg:self-start">
                <SourceNote className="!text-[10px]">{t("statute.paragraphNavLabel")}</SourceNote>
                <ul className="mt-2 border-t-2 border-ink">
                  {dossier.paragraphs.map((p) => (
                    <li key={p.key} className="border-b border-hairline">
                      <a
                        href={`#${p.anchor}`}
                        className="flex items-baseline justify-between gap-2 py-2 pr-1 font-mono text-sm font-bold text-cobalt transition-colors hover:text-signal"
                      >
                        {p.label}
                        <span className="font-normal tabular-nums text-steel">
                          {f.int(p.changes.length)}×
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>

              {/* § články s marginálií */}
              <div className="min-w-0 space-y-12">
                {dossier.paragraphs.map((p) => (
                  <ParagraphArticle key={p.key} trail={p} statuteRef={dossier.ref} slug={dossier.slug} />
                ))}
                <p className="border-t border-hairline pt-3 text-[13px] italic leading-relaxed text-steel">
                  {t("statute.marginaliaRule")}
                </p>
              </div>
            </div>
          ) : (
            <p className="mt-8 max-w-3xl text-sm italic leading-relaxed text-steel">
              {t("statute.trailEmpty")}
            </p>
          )}
        </section>
      </div>
    </main>
  );
}

/* ── řádek kroniky ───────────────────────────────────────────────────── */

function TrailRow({ entry: entryRow }: { entry: StatuteTrailEntry }) {
  const t = useTranslations("lawwatch");
  const f = useFormat();
  const row = entryRow;
  return (
    <div className="grid grid-cols-[minmax(7rem,auto)_1fr] gap-x-6 gap-y-1 border-b border-hairline px-2 py-4 max-sm:grid-cols-1">
      {/* datum — margo kroniky */}
      <div className="pt-0.5">
        {row.fatePublishedOn ? (
          <>
            <span className="block font-mono text-xs font-black uppercase tracking-wider text-signal">
              {f.date(row.fatePublishedOn)}
            </span>
            {row.fateSb && (
              <span className="mt-0.5 block font-mono text-[11px] uppercase tracking-wider text-steel">
                č. {row.fateSb} Sb.
              </span>
            )}
          </>
        ) : (
          <span className="block font-mono text-[11px] uppercase tracking-wider text-steel">
            {row.stav ?? t("statute.inProgress")}
          </span>
        )}
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          {row.cislo != null ? (
            <Link
              href={`/zakony/${row.cislo}`}
              className="group inline-flex items-center gap-1 font-mono text-xs font-bold text-cobalt transition-colors hover:text-signal"
            >
              {t("printNumberedCap", { cislo: row.cislo })}
              <ArrowUpRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
            </Link>
          ) : (
            <span className="font-mono text-xs font-bold text-steel">
              {t("printInternal", { tiskId: row.tiskId })}
            </span>
          )}
          <span className="font-mono text-[10px] uppercase tracking-wider text-steel">
            {t(`origin.${row.origin}`)} · {t(`provenance.${row.provenance}`)}
          </span>
          {row.flaggedConflict && (
            <span className="font-mono text-[10px] font-black uppercase tracking-wider text-signal">
              {t("statute.conflictFlag")}
            </span>
          )}
        </div>
        <p className="mt-1 text-[15px] font-bold leading-snug">{row.title}</p>
        {row.summary && <p className="mt-1 text-sm leading-snug text-steel">{row.summary}</p>}
        {row.sponsors.length > 0 && (
          <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[13px] leading-snug">
            {row.sponsors.slice(0, 6).map((s) => (
              <Link
                key={s.pspId}
                href={`/poslanec/${s.pspId}`}
                className="font-bold transition-colors hover:text-signal"
              >
                {s.name}
                {s.role && (
                  <span className="ml-1 font-mono text-[10px] font-normal uppercase tracking-wider text-steel">
                    {SPONSOR_ROLE_KEYS.has(s.role) ? t(`sponsorRole.${s.role}`) : s.role}
                  </span>
                )}
              </Link>
            ))}
            {row.sponsors.length > 6 && (
              <span className="font-mono text-[11px] uppercase tracking-wider text-steel">
                {t("moreCount", { count: row.sponsors.length - 6 })}
              </span>
            )}
          </p>
        )}
      </div>
    </div>
  );
}

/* ── § článek ────────────────────────────────────────────────────────── */

function ParagraphArticle({
  trail: p,
  statuteRef,
  slug,
}: {
  trail: ParagraphTrail;
  statuteRef: string;
  slug: string;
}) {
  const t = useTranslations("lawwatch");
  const f = useFormat();
  return (
    <article id={p.anchor} className="scroll-mt-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b-2 border-ink pb-2">
        <h3 className="text-2xl font-black uppercase leading-tight tracking-tight">
          <span className="text-signal">{p.label}</span>{" "}
          <span className="font-mono text-xs font-bold normal-case tracking-wider text-steel">
            č. {statuteRef} Sb.
          </span>
        </h3>
        <a
          href={`#${p.anchor}`}
          aria-label={t("statute.anchorAria", { label: p.label })}
          className="inline-flex items-center gap-1 font-mono text-[11px] font-bold uppercase tracking-wider text-cobalt transition-colors hover:text-signal"
        >
          <LinkIcon className="h-3 w-3" /> #{p.anchor}
        </a>
      </div>
      {p.windows > 1 && (
        <p className="mt-2 font-mono text-[11px] uppercase tracking-wider text-ochre">
          {t("statute.repeatedlyAmended", { count: p.windows, countFmt: f.int(p.windows) })}
        </p>
      )}

      <ul className="mt-4 space-y-6">
        {p.changes.map((ch, i) => (
          <li key={`${ch.fragment}|${ch.windowFrom}|${i}`} className="border-l-4 border-hairline pl-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-signal">
                {ch.fragment}{" "}
                <span className="text-steel">— {DIFF_OP_KEYS.has(ch.op) ? t(`diffOp.${ch.op}`) : ch.op}</span>
              </span>
              <span className="font-mono text-[11px] uppercase tracking-wider text-steel">
                {f.date(ch.windowFrom)} → {f.date(ch.windowTo)}
              </span>
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {ch.before && (
                <div className="border-l-4 border-hairline bg-paper-strong p-3">
                  <SourceNote className="!text-[10px]">
                    {t("statute.wording", { date: f.date(ch.windowFrom) })}
                  </SourceNote>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-steel">{ch.before}</p>
                </div>
              )}
              {ch.after && (
                <div className="border-l-4 border-signal p-3">
                  <SourceNote tone="signal" className="!text-[10px]">
                    {t("statute.wording", { date: f.date(ch.windowTo) })}
                  </SourceNote>
                  <p className="mt-1.5 text-[13px] font-medium leading-relaxed">{ch.after}</p>
                </div>
              )}
            </div>

            {/* marginálie — kandidáti okna dle vyhlášeného pravidla */}
            <div className="mt-2 border-l-2 border-ochre/60 pl-3">
              {ch.candidates.length > 0 ? (
                <p className="text-[13px] leading-relaxed">
                  <span className="font-mono text-[10px] font-black uppercase tracking-wider text-ochre">
                    {t("statute.candidatesLabel")}{" "}
                  </span>
                  {ch.candidates.map((cand, ci) => (
                    <span key={cand.tiskId}>
                      {ci > 0 && " · "}
                      {cand.cislo != null ? (
                        <Link
                          href={`/zakony/${cand.cislo}`}
                          className="font-bold text-cobalt transition-colors hover:text-signal"
                        >
                          {t("printNumberedCap", { cislo: cand.cislo })}
                        </Link>
                      ) : (
                        <span className="font-bold">{t("printInternal", { tiskId: cand.tiskId })}</span>
                      )}
                      {cand.fateSb && <span className="text-steel"> (č. {cand.fateSb} Sb.)</span>}
                    </span>
                  ))}
                </p>
              ) : (
                <p className="font-mono text-[11px] uppercase tracking-wider text-steel">
                  {t("statute.candidatesNone")}
                </p>
              )}
            </div>

            <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-steel">
              {t("statute.verbatimBoth")}{" "}
              <a href={ch.eliFrom} target="_blank" rel="noreferrer" className="text-cobalt hover:text-signal">
                {ch.windowFrom}
              </a>{" "}
              →{" "}
              <a href={ch.eliTo} target="_blank" rel="noreferrer" className="text-cobalt hover:text-signal">
                {ch.windowTo}
              </a>{" "}
              · e-Sbírka
            </p>
          </li>
        ))}
      </ul>
      {/* slug se veze kvůli stabilnímu citování stránky v patičce článku */}
      <p className="mt-3 font-mono text-[10px] uppercase tracking-wider text-steel">
        {t("statute.citeLabel")} /zakony/predpis/{slug}#{p.anchor}
      </p>
    </article>
  );
}
