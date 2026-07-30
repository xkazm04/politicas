"use client";

/*
 * Full per-bill dossier body — the /zakony/[cislo] detail (moved out of the old
 * single-page LawWatchPage inline detail pane so each bill is independently
 * linkable/shareable). Renders: origin/submitter, what it changes (title-derived
 * `amends` edges — HONESTLY distinguished from the fuller pass-20 census list
 * where one exists, per the undercount finding C6/C8), formal committee routing
 * (F15), sponsors with money-flag context (Case ①, sector-adjacency honesty —
 * P32: a flag is a signal, not a proven conflict), the real e-Sbírka §-diff where
 * it exists, and the gated forensic verdict block (always rendered as
 * derived/pending_review, never as a fact).
 */

import { useState } from "react";
import Link from "next/link";
import { ExternalLink, ArrowUpRight } from "lucide-react";
import type { LawBillView } from "../getLawData";
import {
  ORIGIN_CZ,
  ROLE_CZ,
  STATUS_CZ,
  SEVERITY_CZ,
  DIFF_OP_CZ,
  CITATION_KIND_CZ,
  SPONSOR_ROLE_CZ,
  RAPPORTEUR_SCOPE_CZ,
  pspBillUrl,
  czkCompact,
  citationRef,
} from "../lawwatchLabels";
import { statuteSlug } from "../statuteRef";
import { useFormat } from "@/lib/i18n/useFormat";
import SourceNote from "@/features/shared/components/SourceNote";

/** České skloňování po číslovce: 1 zákon / 2–4 zákony / 5+ zákonů. */
function zakonPlural(n: number): string {
  if (n === 1) return "zákon";
  return n >= 2 && n <= 4 ? "zákony" : "zákonů";
}

export default function BillDetail({ bill }: { bill: LawBillView }) {
  const f = useFormat();

  // Census cross-check (pass 20, 53 bills): the fuller body-derived amends list vs the
  // title-only `amends` edges. Only rendered when this bill actually carries a census
  // record — the other 88 bills only ever had the title-derived list, and that's not a
  // gap worth flagging per-bill (it's the systemic C8 finding, footnoted on /zakony §2).
  const hasCensus = bill.amendedLawsFull.length > 0;
  const recordedRefs = new Set(bill.amendedLaws.map((l) => l.ref));
  const missedRefs = hasCensus ? bill.amendedLawsFull.filter((r) => !recordedRefs.has(r)) : [];

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b-2 border-ink pb-3">
        <h3 className="text-2xl font-black uppercase leading-tight tracking-tight">
          {bill.cislo != null ? "Sn. tisk " : "Tisk "}
          <span className="text-signal">{bill.cislo ?? bill.tiskId}</span>
        </h3>
        {pspBillUrl(bill.cislo) && (
          <a
            href={pspBillUrl(bill.cislo)!}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-cobalt transition-colors hover:text-signal"
          >
            historie na psp.cz <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>

      {/* „CO TO MĚNÍ" — jedna čitelná věta dřív než cokoli jiného. Odvozeno deterministicky
          z textu tisku (nadpisy ČÁSTí / návětí / zrušovací klauzule), nikdy vymyšleno. */}
      <div className="mt-5 border-l-4 border-signal bg-paper-strong px-4 py-3">
        <SourceNote tone="signal" className="!text-[11px]">
          co to mění
        </SourceNote>
        {bill.summary ? (
          <>
            <p className="mt-1.5 text-lg font-bold leading-snug">{bill.summary}</p>
            <p className="mt-2 font-mono text-[11px] uppercase tracking-wider text-steel">
              odvozeno z textu tisku{bill.summarySource ? ` · ${bill.summarySource}` : ""}
            </p>
          </>
        ) : (
          <p className="mt-1.5 text-[15px] italic leading-relaxed text-steel">
            Shrnutí zatím není — text tohoto tisku nemáme v archivu ve strojově čitelné podobě, ze které by
            šlo shrnutí poctivě odvodit. Raději nic než domyšlená věta.
          </p>
        )}
      </div>

      <p className="mt-4 text-[15px] font-bold leading-snug">{bill.title}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-steel">
        <span className="border border-hairline px-2 py-0.5">{ORIGIN_CZ[bill.origin]}</span>
        {bill.submitter && <span>{bill.submitter}</span>}
      </div>

      {/* osud tisku — stav projednávání dle psp.cz, vyhlášení ve Sbírce, když k němu došlo */}
      {(bill.stav || bill.fateSb) && (
        <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          {bill.fateSb ? (
            <span className="border-l-4 border-signal bg-paper-strong px-3 py-1.5 text-sm font-bold">
              vyhlášen ve Sbírce jako <span className="text-signal">č. {bill.fateSb} Sb.</span>
              {bill.fatePublishedOn && (
                <span className="ml-2 font-mono text-[11px] font-normal uppercase tracking-wider text-steel">
                  {f.date(bill.fatePublishedOn)}
                </span>
              )}
            </span>
          ) : (
            <span className="font-mono text-[11px] uppercase tracking-wider text-steel">
              stav projednávání: <span className="font-black text-ink">{bill.stav}</span>
            </span>
          )}
          <SourceNote className="!text-[10px]">stav dle psp.cz — tisky (stavy/hist)</SourceNote>
        </div>
      )}

      {/* novelizované zákony — title-derived edges */}
      <div className="mt-6">
        <SourceNote>novelizuje — {bill.amendedLaws.length} {zakonPlural(bill.amendedLaws.length)} (dle citace v názvu)</SourceNote>
        {bill.amendedLaws.length > 0 ? (
          <ul className="mt-2 divide-y divide-hairline border-t border-hairline">
            {bill.amendedLaws.map((l) => {
              const slug = statuteSlug(l.ref);
              return (
                <li key={l.urn} className="py-2.5">
                  {slug ? (
                    <Link href={`/zakony/predpis/${slug}`} className="group block">
                      <span className="inline-flex items-center gap-1 font-mono text-xs font-bold text-signal transition-colors group-hover:text-cobalt">
                        č. {l.ref} Sb.
                        <ArrowUpRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
                      </span>
                      {l.title && <span className="mt-0.5 block text-sm leading-snug text-steel">{l.title}</span>}
                    </Link>
                  ) : (
                    <>
                      <span className="block font-mono text-xs font-bold text-signal">č. {l.ref} Sb.</span>
                      {l.title && <span className="mt-0.5 block text-sm leading-snug text-steel">{l.title}</span>}
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-2 text-sm italic leading-relaxed text-steel">
            Graf u tohoto tisku nenašel v názvu citaci konkrétního zákona (č. N/RRRR Sb.).
          </p>
        )}
      </div>

      {/* census honesty note — the fuller body-derived list, where it exists */}
      {hasCensus && (
        <div className="mt-4 border-l-4 border-ochre bg-ochre/5 p-4">
          <SourceNote tone="steel" className="!text-ochre">
            census textu tisku (průchod grafu 20) · plný výčet z textu, ne z názvu
          </SourceNote>
          <p className="mt-2 text-[13px] leading-relaxed">
            Tento tisk ve skutečnosti novelizuje <span className="font-black">{f.int(bill.amendedLawsFull.length)}</span>{" "}
            {zakonPlural(bill.amendedLawsFull.length)} — o{" "}
            <span className="font-black text-signal">{f.int(bill.amendsUndercount)}</span> více, než kolik zachytí
            vazba odvozená jen z citace v názvu tisku (obvyklé u obřích novel / doprovodných zákonů). Toto je
            systematický, ne ojedinělý jev — viz poznámku u nejčastěji novelizovaných zákonů.
          </p>
          {missedRefs.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {missedRefs.map((ref) => {
                const slug = statuteSlug(ref);
                return (
                  <li key={ref}>
                    {slug ? (
                      <Link
                        href={`/zakony/predpis/${slug}`}
                        className="block border border-ochre/40 px-2 py-0.5 font-mono text-[11px] font-bold text-ink transition-colors hover:border-ochre hover:bg-ochre/10"
                      >
                        č. {ref} Sb.
                      </Link>
                    ) : (
                      <span className="block border border-ochre/40 px-2 py-0.5 font-mono text-[11px] font-bold text-ink">
                        č. {ref} Sb.
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* formální přikázání výborům (F15) */}
      {bill.committees.length > 0 && (
        <div className="mt-6 border-t-2 border-ink pt-4">
          <SourceNote>projednávají výbory — přikázání podle psp.cz</SourceNote>
          <ul className="mt-3 space-y-2">
            {bill.committees.map((c) => (
              <li
                key={c.organUrn}
                className={`flex flex-wrap items-baseline justify-between gap-2 border-l-4 px-3 py-2 ${
                  c.role === "garancni" ? "border-cobalt bg-cobalt/5" : "border-hairline"
                }`}
              >
                <span className="flex items-baseline gap-2">
                  <span className="text-[15px] font-bold">{c.organLabel}</span>
                  <span
                    className={`font-mono text-[10px] font-black uppercase tracking-wider ${
                      c.role === "garancni" ? "text-cobalt" : "text-steel"
                    }`}
                  >
                    {ROLE_CZ[c.role] ?? c.role}
                  </span>
                </span>
                <span className="font-mono text-[11px] uppercase tracking-wider text-steel">
                  {STATUS_CZ[c.status] ?? c.status}
                  {c.assignedOn && <> · {c.assignedOn}</>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* předkladatelé — od průchodu 34 s pořadím podpisu: první podepsaný nese návrh,
          ostatní ho spolupodepsali. Rozlišení, které dřív povrch neuměl (Q-effort-2). */}
      {bill.sponsors.length > 0 && (
        <div className="mt-6 border-t-2 border-ink pt-4">
          <SourceNote>předkladatelé — psp.cz predkladatel (pořadí podpisu)</SourceNote>
          <div className="mt-3 flex flex-wrap gap-2">
            {bill.sponsors.map((s) => (
              <Link
                key={s.pspId}
                href={`/poslanec/${s.pspId}`}
                className={`group inline-flex items-center gap-2 border-2 px-3 py-1.5 transition-colors hover:bg-paper-strong ${
                  s.role === "predkladatel" ? "border-ink" : "border-hairline hover:border-ink"
                }`}
              >
                <span className="text-sm font-bold">{s.name}</span>
                {s.role && (
                  <span
                    className={`font-mono text-[10px] font-black uppercase tracking-wider ${
                      s.role === "predkladatel" ? "text-signal" : "text-steel"
                    }`}
                  >
                    {SPONSOR_ROLE_CZ[s.role]}
                    {s.joinedLater && " · dodatečně"}
                  </span>
                )}
                <ArrowUpRight className="h-3.5 w-3.5 text-signal opacity-0 transition-opacity group-hover:opacity-100" />
              </Link>
            ))}
          </div>
          {bill.sponsorMinContribution != null && (
            <p className="mt-3 text-[13px] leading-relaxed text-steel">
              Nejnižší index přínosu mezi předkladateli:{" "}
              <span className="font-black text-ink">{f.int(Math.round(bill.sponsorMinContribution))}</span> ze 100
              (CivicScore, průřez sněmovní práce poslance — účast, výbory, legislativa, vystoupení).
            </p>
          )}
        </div>
      )}

      {/* zpravodajové — přidělená analytická role: kdo tisk odborně zpracovává pro
          plénum či výbor. Jiná práce než podpis pod návrhem. */}
      {bill.rapporteurs.length > 0 && (
        <div className="mt-6 border-t-2 border-ink pt-4">
          <SourceNote>zpravodajové — psp.cz hist · hist_vybory · tisky_za</SourceNote>
          <ul className="mt-3 space-y-2">
            {bill.rapporteurs.map((r) => (
              <li key={r.pspId} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <Link
                  href={`/poslanec/${r.pspId}`}
                  className="group inline-flex items-center gap-1.5 text-sm font-bold transition-colors hover:text-signal"
                >
                  {r.name}
                  <ArrowUpRight className="h-3.5 w-3.5 text-signal opacity-0 transition-opacity group-hover:opacity-100" />
                </Link>
                <span className="font-mono text-[10px] uppercase tracking-wider text-steel">
                  {r.scopes.map((s) => RAPPORTEUR_SCOPE_CZ[s] ?? s).join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* rozprava — kdo k tisku skutečně vystoupil na plénu (věcná vystoupení,
          předsedající vyloučeni). Počet vystoupení ≠ kvalita, proto jen poctivý počet. */}
      {bill.speakers.length > 0 && (
        <div className="mt-6 border-t-2 border-ink pt-4">
          <SourceNote>
            rozprava — {f.int(bill.speakers.reduce((s, x) => s + x.turns, 0))} věcných vystoupení ·
            stenozáznamy psp.cz
          </SourceNote>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
            {bill.speakers.slice(0, 12).map((s) => (
              <Link
                key={s.pspId}
                href={`/poslanec/${s.pspId}`}
                className="group inline-flex items-baseline gap-1.5 text-sm font-bold transition-colors hover:text-signal"
              >
                {s.name}
                <span className="font-mono text-[11px] font-normal tabular-nums text-steel">{s.turns}×</span>
              </Link>
            ))}
            {bill.speakers.length > 12 && (
              <span className="font-mono text-[11px] uppercase tracking-wider text-steel">
                + {f.int(bill.speakers.length - 12)} dalších
              </span>
            )}
          </div>
        </div>
      )}

      {/* písemné pozměňovací návrhy — autorství ze sněmovních dokumentů (typ 13) */}
      {bill.amendmentAuthors.length > 0 && (
        <div className="mt-6 border-t-2 border-ink pt-4">
          <SourceNote>
            písemné pozměňovací návrhy — {f.int(bill.amendmentAuthors.reduce((s, x) => s + x.count, 0))} ·
            sněmovní dokumenty psp.cz
          </SourceNote>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
            {bill.amendmentAuthors.map((a) => (
              <Link
                key={a.pspId}
                href={`/poslanec/${a.pspId}`}
                className="group inline-flex items-baseline gap-1.5 text-sm font-bold transition-colors hover:text-signal"
              >
                {a.name}
                <span className="font-mono text-[11px] font-normal tabular-nums text-steel">{a.count}×</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* příznak střetu (Case ①) */}
      {bill.flaggedConflict && (
        <div className="mt-6 border-l-4 border-signal bg-paper-strong p-4">
          <SourceNote tone="signal" className="!text-[10px]">
            možný střet zájmů · odvozeno z peněžních vazeb předkladatele
          </SourceNote>
          <p className="mt-2 text-[15px] font-medium leading-relaxed">
            Předkladatel má vazby na {f.int(bill.sponsorMoneyCompanies)}{" "}
            {bill.sponsorMoneyCompanies === 1 ? "firmu" : "firem"} s celkovým tokem veřejných zakázek{" "}
            <span className="font-black">{czkCompact(bill.sponsorContractCzk)}</span>. Signál k prověření, ne prokázaný
            střet — sektorová blízkost je indicie, ne důkaz.
          </p>
        </div>
      )}

      {/* reálný §-diff (e-Sbírka) */}
      {bill.paragraphDiffs.length > 0 && <ParagraphDiffBlock diffs={bill.paragraphDiffs} />}

      {/* gatovaný forenzní posudek */}
      {bill.forensic && <ForensicBlock forensic={bill.forensic} summary={bill.summary} />}
    </div>
  );
}

/**
 * Gatovaný forenzní posudek — vždy jako ODVOZENÝ NÁVRH ČEKAJÍCÍ NA REVIZI, nikdy jako fakt
 * a nikdy jako verdikt o pochybení.
 *
 * Struktura (přestavba, dávka 009 — prezentační brána): nejdřív nepřehlédnutelný stav, pak
 * kompaktní hlavička se závažností a jistotou, pak tři panely v pořadí, v jakém čtenář
 * uvažuje — „co to mění“ (odvozeno z textu tisku) / „co analýza zjistila“ / „co analýza
 * NETVRDÍ“ — a na konci reference jako formátované odkazy, nikdy jako serializovaný objekt.
 *
 * Texty, které neprošly českou jazykovou branou (lib/analysis/language-gate.ts), se
 * NEZOBRAZUJÍ. Jejich počet se čtenáři přiznává, aby zkrácený blok nevypadal jako úplný.
 */
function ForensicBlock({
  forensic,
  summary,
}: {
  forensic: NonNullable<LawBillView["forensic"]>;
  summary: string | null;
}) {
  const [open, setOpen] = useState(false);
  const effects = forensic.unstatedEffects.filter((u) => u.effect);
  const hasFindings =
    Boolean(forensic.statedReasoning || forensic.researchedContext || forensic.conflictAssessment) || effects.length > 0;

  return (
    <div className="mt-8 border-2 border-cobalt">
      {/* stav — nepřehlédnutelný, plná plocha */}
      <div className="border-b-2 border-cobalt bg-cobalt px-4 py-2.5">
        <p className="font-mono text-[11px] font-black uppercase tracking-widest text-paper">
          odvozený návrh · čeká na revizi člověkem · není to verdikt o pochybení
        </p>
      </div>

      {/* kompaktní hlavička: závažnost + jistota + stav */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline bg-cobalt/5 px-4 py-3">
        <SourceNote tone="steel" className="!text-cobalt">
          forenzní posudek · kontrola proti fabrikaci{forensic.pass != null ? ` · průchod grafu ${forensic.pass}` : ""}
        </SourceNote>
        <span className="flex flex-wrap items-baseline gap-x-4 gap-y-1 font-mono text-[11px] uppercase tracking-wider text-steel">
          <span>
            závažnost{" "}
            <span className="text-sm font-black text-ink">{SEVERITY_CZ[forensic.severity] ?? forensic.severity}</span>
          </span>
          {forensic.confidence != null && (
            <span>
              jistota <span className="text-sm font-black text-ink">{forensic.confidence}/5</span>
            </span>
          )}
          <span>
            stav <span className="font-black text-ink">{forensic.reviewState}</span>
          </span>
        </span>
      </div>

      <div className="space-y-6 px-4 py-5">
        {/* 1 — co to mění */}
        <section>
          <h4 className="font-mono text-[11px] font-black uppercase tracking-widest text-signal">co to mění</h4>
          <p className="mt-1.5 text-[15px] font-medium leading-relaxed">
            {summary ?? "Shrnutí zatím není — text tisku nemáme ve strojově čitelné podobě."}
          </p>
        </section>

        {/* 2 — co analýza zjistila */}
        <section className="border-t border-hairline pt-4">
          <h4 className="font-mono text-[11px] font-black uppercase tracking-widest text-cobalt">
            co analýza zjistila
          </h4>
          {!hasFindings && (
            <p className="mt-1.5 text-sm italic leading-relaxed text-steel">
              Česká verze tohoto posudku se připravuje — do té doby jeho text nezobrazujeme.
            </p>
          )}
          {forensic.statedReasoning && (
            <div className="mt-3">
              <SourceNote className="!text-[11px]">deklarovaný důvod (důvodová zpráva)</SourceNote>
              <p className="mt-1.5 text-sm leading-relaxed text-steel">{forensic.statedReasoning}</p>
            </div>
          )}
          {forensic.conflictAssessment && (
            <div className="mt-4">
              <SourceNote className="!text-[11px]">posouzení střetu zájmů</SourceNote>
              <p className="mt-1.5 text-sm leading-relaxed">{forensic.conflictAssessment}</p>
            </div>
          )}

          {open && (
            <>
              {forensic.researchedContext && (
                <div className="mt-4">
                  <SourceNote className="!text-[11px]">nezávislý kontext (rešerše)</SourceNote>
                  <p className="mt-1.5 text-sm leading-relaxed text-steel">{forensic.researchedContext}</p>
                </div>
              )}
              {effects.length > 0 && (
                <div className="mt-4">
                  <SourceNote className="!text-[11px]">nedeklarované dopady · každý s citací</SourceNote>
                  <ul className="mt-2 space-y-3">
                    {effects.map((u, i) => (
                      <li key={i} className="border-l-4 border-signal pl-3">
                        <p className="text-sm font-medium leading-snug">{u.effect}</p>
                        {u.whoBenefits && (
                          <p className="mt-1 text-[13px] leading-snug text-steel">
                            <span className="font-bold uppercase tracking-wide">komu prospívá:</span> {u.whoBenefits}
                          </p>
                        )}
                        {/^https?:\/\//.test(u.evidence) && (
                          <a
                            href={u.evidence}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-wider text-cobalt hover:text-signal"
                          >
                            {citationRef("web", u.evidence).registry} <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          {(forensic.researchedContext || effects.length > 0) && (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="mt-4 font-mono text-[11px] font-bold uppercase tracking-wider text-cobalt transition-colors hover:text-signal"
            >
              {open ? "méně —" : "rešerše a nedeklarované dopady +"}
            </button>
          )}
        </section>

        {/* 3 — co analýza NETVRDÍ */}
        <section className="border-t border-hairline pt-4">
          <h4 className="font-mono text-[11px] font-black uppercase tracking-widest text-ochre">
            co analýza NETVRDÍ
          </h4>
          <ul className="mt-2 space-y-1.5 text-[13px] leading-relaxed text-steel">
            <li className="border-l-2 border-ochre pl-3">
              Netvrdí, že se kdokoli dopustil protiprávního jednání. Jde o odvozený podnět k prověření, uložený
              jako <span className="font-bold text-ink">{forensic.reviewState}</span>, nikoli o publikovaný závěr.
            </li>
            <li className="border-l-2 border-ochre pl-3">
              Uvedená závažnost „{SEVERITY_CZ[forensic.severity] ?? forensic.severity}“
              {forensic.confidence != null && <> a jistota {forensic.confidence}/5</>} jsou hodnocením analýzy, ne
              zjištěním úřadu ani soudu.
            </li>
            <li className="border-l-2 border-ochre pl-3">
              Peněžní vazba předkladatele je indicie, ne důkaz. Blízkost oboru sama o sobě střet zájmů
              neprokazuje.
            </li>
            {effects.length === 0 && (
              <li className="border-l-2 border-ochre pl-3">
                U tohoto tisku analýza neuvádí žádný nedeklarovaný dopad — absence nálezu je také nález.
              </li>
            )}
            {forensic.withheldFields > 0 && (
              <li className="border-l-2 border-ochre pl-3">
                {forensic.withheldFields}{" "}
                {forensic.withheldFields === 1
                  ? "část textu"
                  : forensic.withheldFields < 5
                    ? "části textu"
                    : "částí textu"}{" "}
                tohoto posudku zatím není v češtině, a proto se nezobrazuje. Blok je tím neúplný.
              </li>
            )}
          </ul>
        </section>

        {forensic.citations.length > 0 && <CitationList citations={forensic.citations} />}

        <p className="border-t border-hairline pt-3 text-[13px] italic leading-relaxed text-steel">
          Odvozený nález gatovaný proti fabrikaci: každá citovaná č. N/RRRR Sb. musí být reálný zákon. Uložen jako{" "}
          <span className="font-bold not-italic">pending_review</span> — podnět pro člověka, ne publikovaný verdikt.
        </p>
      </div>
    </div>
  );
}

/** Reference jako formátované odkazy — psp.cz podle čísla tisku, e-Sbírka podle „č. N/RRRR Sb.“,
 * uzly grafu jako čitelný identifikátor bez odkazu (veřejná stránka pro ně neexistuje). */
function CitationList({ citations }: { citations: NonNullable<LawBillView["forensic"]>["citations"] }) {
  return (
    <section className="border-t border-hairline pt-4">
      <SourceNote className="!text-[11px]">reference ({citations.length})</SourceNote>
      <ol className="mt-2 space-y-2.5">
        {citations.map((c, i) => {
          const ref = citationRef(c.kind, c.source);
          return (
            <li key={i} className="grid grid-cols-[2rem_1fr] gap-2">
              <span className="pt-0.5 font-mono text-[11px] font-bold tabular-nums text-steel">[{i + 1}]</span>
              <span>
                {c.claim && <span className="block text-[13px] leading-snug">{c.claim}</span>}
                <span className="mt-0.5 flex flex-wrap items-baseline gap-x-2 font-mono text-[11px] uppercase tracking-wider">
                  <span className="text-steel">{CITATION_KIND_CZ[c.kind] ?? c.kind}</span>
                  {ref.url ? (
                    <a
                      href={ref.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-bold text-cobalt transition-colors hover:text-signal"
                    >
                      {ref.registry} · {ref.label} <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <span className="text-steel">
                      {ref.registry} · {ref.label}
                    </span>
                  )}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** Reálný §-diff mezi dvěma PLATNÝMI zněními zákona z e-Sbírky (SPARQL point-query — žádný
 * hromadný výpis, žádná syntetizovaná data). Text před/po je doslovný `text-fragmentu`
 * z e-Sbírky (jen bez HTML značek), nikdy dopočítaný. */
function ParagraphDiffBlock({ diffs }: { diffs: LawBillView["paragraphDiffs"] }) {
  const f = useFormat();
  return (
    <div className="mt-8 border-2 border-ochre">
      {diffs.map((d, di) => (
        <div key={`${d.law}-${d.parScope}-${di}`} className={di > 0 ? "border-t-2 border-ochre" : ""}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-ochre bg-ochre/5 px-4 py-3">
            <SourceNote tone="steel" className="!text-ochre">
              reálný §-diff · č. {d.law} Sb. · e-Sbírka (SPARQL, ne hromadný výpis)
            </SourceNote>
            <span className="font-mono text-[11px] uppercase tracking-wider text-steel">
              {f.date(d.from.date)} → {f.date(d.to.date)}
            </span>
          </div>
          <ul className="space-y-4 px-4 py-4">
            {d.hunks.map((h, hi) => (
              <li key={hi} className="border-l-4 border-hairline pl-3">
                <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-signal">
                  {h.fragment} <span className="text-steel">— {DIFF_OP_CZ[h.op] ?? h.op}</span>
                </span>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {h.before && (
                    <div className="border-l-4 border-hairline bg-paper-strong p-3">
                      <SourceNote className="!text-[10px]">{f.date(d.from.date)}</SourceNote>
                      <p className="mt-1.5 text-[13px] leading-relaxed text-steel">{h.before}</p>
                    </div>
                  )}
                  {h.after && (
                    <div className="border-l-4 border-signal p-3">
                      <SourceNote tone="signal" className="!text-[10px]">{f.date(d.to.date)}</SourceNote>
                      <p className="mt-1.5 text-[13px] font-medium leading-relaxed">{h.after}</p>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <p className="border-t border-hairline px-4 py-3 text-[13px] italic leading-relaxed text-steel">
            Doslovný text obou znění z e-Sbírky (
            <a href={d.from.eli} target="_blank" rel="noreferrer" className="text-cobalt hover:text-signal">
              {d.from.date}
            </a>
            {" → "}
            <a href={d.to.eli} target="_blank" rel="noreferrer" className="text-cobalt hover:text-signal">
              {d.to.date}
            </a>
            ), nikdy dopočítaný. Zdroj: {d.source}.
          </p>
        </div>
      ))}
    </div>
  );
}
