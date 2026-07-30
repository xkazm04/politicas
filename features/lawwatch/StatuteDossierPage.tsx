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
 */

import Link from "next/link";
import { ArrowLeft, ArrowUpRight, ExternalLink, Link as LinkIcon } from "lucide-react";
import { useFormat } from "@/lib/i18n/useFormat";
import SectionHeading from "@/features/shared/components/SectionHeading";
import SectionRule from "@/features/shared/components/SectionRule";
import SourceNote from "@/features/shared/components/SourceNote";
import type { ParagraphTrail, StatuteDossier, StatuteTrailEntry } from "./deriveStatuteDossier";
import { DIFF_OP_CZ, ORIGIN_CZ, SPONSOR_ROLE_CZ, esbirkaUrl } from "./lawwatchLabels";

/** České skloňování po číslovce. */
const plural = (n: number, one: string, few: string, many: string): string =>
  n === 1 ? one : n >= 2 && n <= 4 ? few : many;

const PROVENANCE_CZ: Record<StatuteTrailEntry["provenance"], string> = {
  title: "vazba z názvu tisku",
  census: "jen census textu",
  both: "název i census",
};

export default function StatuteDossierPage({ dossier }: { dossier: StatuteDossier }) {
  const f = useFormat();
  const c = dossier.coverage;
  const esb = esbirkaUrl(dossier.ref);

  return (
    <main className="min-h-screen overflow-x-clip bg-paper font-sans text-ink">
      <header className="border-b-4 border-ink">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
          <span className="font-mono text-xs uppercase tracking-widest text-steel">/ zákony / předpis</span>
          <Link
            href="/zakony/predpis"
            className="inline-flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-cobalt transition-colors hover:text-signal"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> rejstřík předpisů
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6">
        {/* ── Hlava zákona ─────────────────────────────────── */}
        <div className="py-10">
          <SourceNote tone="signal">paměť zákona · kritické vydání předpisu</SourceNote>
          <h1 className="mt-3 text-4xl font-black uppercase leading-[0.95] tracking-tight sm:text-5xl">
            Zákon č. {dossier.ref} Sb.<span className="text-signal">.</span>
          </h1>
          {dossier.title && <p className="mt-3 max-w-3xl text-lg font-bold leading-snug">{dossier.title}</p>}
          <div className="mt-4 max-w-xl">
            <SectionRule />
          </div>
          <p className="mt-4 max-w-3xl text-base leading-relaxed text-steel">
            Předpis viděný ze strany zákona, ne tisku: kdo ho v tomto volebním období měnil, kdy byla
            změna vyhlášena ve Sbírce a — tam, kde archiv nese reálný §-diff z e-Sbírky — doslovná
            §-stopa „před / po“ s trvalými kotvami. Data z psp.cz a e-Sbírky, ne z modelu.
          </p>
          {esb && (
            <a
              href={esb}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-cobalt transition-colors hover:text-signal"
            >
              úplné znění v e-Sbírce <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>

        {/* ── Statistický pás ──────────────────────────────── */}
        <div className="grid grid-cols-2 gap-px border-2 border-ink bg-ink sm:grid-cols-4">
          {[
            { v: f.int(c.trailBills), l: `${plural(c.trailBills, "tisk", "tisky", "tisků")} ve stopě` },
            { v: f.int(c.enactedBills), l: "vyhlášeno ve Sbírce" },
            { v: f.int(c.paragraphs), l: "§ se §-stopou" },
            { v: f.int(c.changes), l: "doložených změn fragmentů" },
          ].map((s) => (
            <div key={s.l} className="bg-paper px-4 py-4">
              <div className="text-3xl font-black tabular-nums">{s.v}</div>
              <div className="mt-0.5 font-mono text-[11px] uppercase tracking-wider text-steel">{s.l}</div>
            </div>
          ))}
        </div>
        <div className="mt-2">
          <SourceNote>
            psp.cz tisky (amends + census) · e-Sbírka SPARQL §-diffy · {f.int(c.windows)}{" "}
            {plural(c.windows, "verzní okno", "verzní okna", "verzních oken")}
          </SourceNote>
        </div>

        {/* ── Pokrytí autorství — přiznané, ne schované ────── */}
        <div className="mt-4 border-l-4 border-ochre bg-ochre/5 p-4">
          <SourceNote tone="steel" className="!text-ochre">
            pokrytí autorství — co tato stránka dokládá a co ne
          </SourceNote>
          <p className="mt-2 max-w-3xl text-[13px] leading-relaxed">
            Stopa tisků níže je úplná v rámci grafu ({f.int(c.trailBills)}{" "}
            {plural(c.trailBills, "tisk", "tisky", "tisků")}, z toho {f.int(c.censusOnlyBills)} doloženo jen
            censem textu). §-stopa je bodová: reálný e-Sbírka diff dnes nese{" "}
            <span className="font-black">{f.int(c.paragraphs)}</span>{" "}
            {plural(c.paragraphs, "paragraf", "paragrafy", "paragrafů")} tohoto předpisu (
            {f.int(c.changes)} {plural(c.changes, "změna fragmentu", "změny fragmentů", "změn fragmentů")}
            {c.changes > 0 && (
              <>, u {f.int(c.changesWithCandidates)} z nich je v okně aspoň jeden tisk-kandidát</>
            )}
            ); u ostatních paragrafů §-stopa zatím není a nic se nedomýšlí. Autorství na úrovni § se
            NEURČUJE — u každého okna se ukazují jen <span className="font-bold">kandidáti okna</span>:
            tisky z této stopy vyhlášené ve Sbírce mezi oběma zněními (pravidlo je vytištěné u §-stopy).
            Kandidát není doložený autor změny.
          </p>
        </div>

        {/* ── 01 Kronika tisků ─────────────────────────────── */}
        <section id="kronika" className="mt-12">
          <SectionHeading
            index={1}
            title="Kdo zákon měnil"
            aside={
              <SourceNote>
                {f.int(c.trailBills)} {plural(c.trailBills, "tisk", "tisky", "tisků")} · psp.cz · řazeno dnem
                vyhlášení, pak číslem tisku
              </SourceNote>
            }
          />
          <div className="mt-8 border-t-2 border-ink">
            {dossier.trail.map((t) => (
              <TrailRow key={t.tiskId} entry={t} />
            ))}
          </div>
          <p className="mt-4 max-w-3xl text-sm italic leading-relaxed text-steel">
            Řazení (vyhlášené pravidlo): nejdřív tisky vyhlášené ve Sbírce chronologicky podle dne
            vyhlášení, pak projednávané tisky podle čísla tisku. Provenience vazby se přiznává u každého
            řádku — „vazba z názvu tisku“ je citace č. N/RRRR Sb. v názvu, „census textu“ nezávislý
            průchod plným textem tisku (u velkých novel název systematicky podhodnocuje).
          </p>
        </section>

        {/* ── 02 §-stopa ───────────────────────────────────── */}
        <section id="paragrafy" className="mt-14 border-t-4 border-ink pt-10 pb-20">
          <SectionHeading
            index={2}
            title="§-stopa — kritické vydání"
            aside={
              <SourceNote>
                {c.changes > 0
                  ? `${f.int(c.paragraphs)} § · ${f.int(c.changes)} ${plural(c.changes, "změna", "změny", "změn")} · e-Sbírka SPARQL`
                  : "e-Sbírka SPARQL · zatím bez záznamu"}
              </SourceNote>
            }
          />
          {dossier.paragraphs.length > 0 ? (
            <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(8rem,2fr)_9fr]">
              {/* § rejstřík — sloupec kritického vydání */}
              <nav aria-label="Rejstřík paragrafů" className="lg:sticky lg:top-8 lg:self-start">
                <SourceNote className="!text-[10px]">rejstřík §</SourceNote>
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
                  Vyhlášené pravidlo marginálie: „v okně vyhlášeno“ jsou tisky z kroniky výše, jejichž den
                  vyhlášení ve Sbírce padá do intervalu mezi oběma zněními (starší znění výlučně, novější
                  včetně). Používá se den vyhlášení, ne účinnosti; okno mezi dvěma konsolidovanými zněními
                  může nést zásahy více novel najednou — proto kandidáti, nikdy „autor“.
                </p>
              </div>
            </div>
          ) : (
            <p className="mt-8 max-w-3xl text-sm italic leading-relaxed text-steel">
              Pro tento předpis zatím žádný reálný §-diff v archivu není — e-Sbírka diffy se dopočítávají
              bodově (SPARQL point-query, žádný hromadný výpis) a Politicas nezobrazuje smyšlená data.
              Kronika tisků výše platí i bez §-stopy.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}

/* ── řádek kroniky ───────────────────────────────────────────────────── */

function TrailRow({ entry: t }: { entry: StatuteTrailEntry }) {
  const f = useFormat();
  return (
    <div className="grid grid-cols-[minmax(7rem,auto)_1fr] gap-x-6 gap-y-1 border-b border-hairline px-2 py-4 max-sm:grid-cols-1">
      {/* datum — margo kroniky */}
      <div className="pt-0.5">
        {t.fatePublishedOn ? (
          <>
            <span className="block font-mono text-xs font-black uppercase tracking-wider text-signal">
              {f.date(t.fatePublishedOn)}
            </span>
            {t.fateSb && (
              <span className="mt-0.5 block font-mono text-[11px] uppercase tracking-wider text-steel">
                č. {t.fateSb} Sb.
              </span>
            )}
          </>
        ) : (
          <span className="block font-mono text-[11px] uppercase tracking-wider text-steel">
            {t.stav ?? "v projednávání"}
          </span>
        )}
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          {t.cislo != null ? (
            <Link
              href={`/zakony/${t.cislo}`}
              className="group inline-flex items-center gap-1 font-mono text-xs font-bold text-cobalt transition-colors hover:text-signal"
            >
              Sn. tisk {t.cislo}
              <ArrowUpRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
            </Link>
          ) : (
            <span className="font-mono text-xs font-bold text-steel">tisk {t.tiskId}</span>
          )}
          <span className="font-mono text-[10px] uppercase tracking-wider text-steel">
            {ORIGIN_CZ[t.origin]} · {PROVENANCE_CZ[t.provenance]}
          </span>
          {t.flaggedConflict && (
            <span className="font-mono text-[10px] font-black uppercase tracking-wider text-signal">
              možný střet — signál, ne důkaz
            </span>
          )}
        </div>
        <p className="mt-1 text-[15px] font-bold leading-snug">{t.title}</p>
        {t.summary && <p className="mt-1 text-sm leading-snug text-steel">{t.summary}</p>}
        {t.sponsors.length > 0 && (
          <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[13px] leading-snug">
            {t.sponsors.slice(0, 6).map((s) => (
              <Link
                key={s.pspId}
                href={`/poslanec/${s.pspId}`}
                className="font-bold transition-colors hover:text-signal"
              >
                {s.name}
                {s.role && (
                  <span className="ml-1 font-mono text-[10px] font-normal uppercase tracking-wider text-steel">
                    {SPONSOR_ROLE_CZ[s.role]}
                  </span>
                )}
              </Link>
            ))}
            {t.sponsors.length > 6 && (
              <span className="font-mono text-[11px] uppercase tracking-wider text-steel">
                + {t.sponsors.length - 6} dalších
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
          aria-label={`Trvalá kotva ${p.label}`}
          className="inline-flex items-center gap-1 font-mono text-[11px] font-bold uppercase tracking-wider text-cobalt transition-colors hover:text-signal"
        >
          <LinkIcon className="h-3 w-3" /> #{p.anchor}
        </a>
      </div>
      {p.windows > 1 && (
        <p className="mt-2 font-mono text-[11px] uppercase tracking-wider text-ochre">
          měněno opakovaně — {f.int(p.windows)} verzní okna
        </p>
      )}

      <ul className="mt-4 space-y-6">
        {p.changes.map((ch, i) => (
          <li key={`${ch.fragment}|${ch.windowFrom}|${i}`} className="border-l-4 border-hairline pl-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-signal">
                {ch.fragment} <span className="text-steel">— {DIFF_OP_CZ[ch.op] ?? ch.op}</span>
              </span>
              <span className="font-mono text-[11px] uppercase tracking-wider text-steel">
                {f.date(ch.windowFrom)} → {f.date(ch.windowTo)}
              </span>
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {ch.before && (
                <div className="border-l-4 border-hairline bg-paper-strong p-3">
                  <SourceNote className="!text-[10px]">znění {f.date(ch.windowFrom)}</SourceNote>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-steel">{ch.before}</p>
                </div>
              )}
              {ch.after && (
                <div className="border-l-4 border-signal p-3">
                  <SourceNote tone="signal" className="!text-[10px]">znění {f.date(ch.windowTo)}</SourceNote>
                  <p className="mt-1.5 text-[13px] font-medium leading-relaxed">{ch.after}</p>
                </div>
              )}
            </div>

            {/* marginálie — kandidáti okna dle vyhlášeného pravidla */}
            <div className="mt-2 border-l-2 border-ochre/60 pl-3">
              {ch.candidates.length > 0 ? (
                <p className="text-[13px] leading-relaxed">
                  <span className="font-mono text-[10px] font-black uppercase tracking-wider text-ochre">
                    v okně vyhlášeno (kandidáti, ne doložené autorství):{" "}
                  </span>
                  {ch.candidates.map((cand, ci) => (
                    <span key={cand.tiskId}>
                      {ci > 0 && " · "}
                      {cand.cislo != null ? (
                        <Link
                          href={`/zakony/${cand.cislo}`}
                          className="font-bold text-cobalt transition-colors hover:text-signal"
                        >
                          Sn. tisk {cand.cislo}
                        </Link>
                      ) : (
                        <span className="font-bold">tisk {cand.tiskId}</span>
                      )}
                      {cand.fateSb && <span className="text-steel"> (č. {cand.fateSb} Sb.)</span>}
                    </span>
                  ))}
                </p>
              ) : (
                <p className="font-mono text-[11px] uppercase tracking-wider text-steel">
                  v okně nebyl vyhlášen žádný tisk z této stopy — kandidát autorství chybí
                </p>
              )}
            </div>

            <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-steel">
              doslovný text obou znění:{" "}
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
        citace: /zakony/predpis/{slug}#{p.anchor}
      </p>
    </article>
  );
}
