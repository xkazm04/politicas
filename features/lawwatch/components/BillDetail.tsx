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
import { ORIGIN_CZ, ROLE_CZ, STATUS_CZ, SEVERITY_CZ, DIFF_OP_CZ, pspBillUrl, czkCompact } from "../lawwatchLabels";
import { useFormat } from "@/lib/i18n/useFormat";
import SourceNote from "@/features/shared/components/SourceNote";

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

      <p className="mt-4 text-[15px] font-bold leading-snug">{bill.title}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-steel">
        <span className="border border-hairline px-2 py-0.5">{ORIGIN_CZ[bill.origin]}</span>
        {bill.submitter && <span>{bill.submitter}</span>}
      </div>

      {/* novelizované zákony — title-derived edges */}
      <div className="mt-6">
        <SourceNote>novelizuje — {bill.amendedLaws.length} {bill.amendedLaws.length === 1 ? "zákon" : "zákonů"} (dle citace v názvu)</SourceNote>
        {bill.amendedLaws.length > 0 ? (
          <ul className="mt-2 divide-y divide-hairline border-t border-hairline">
            {bill.amendedLaws.map((l) => (
              <li key={l.urn} className="py-2.5">
                <span className="block font-mono text-xs font-bold text-signal">č. {l.ref} Sb.</span>
                {l.title && <span className="mt-0.5 block text-sm leading-snug text-steel">{l.title}</span>}
              </li>
            ))}
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
            census pass 20 · plný výčet z textu tisku, ne z názvu
          </SourceNote>
          <p className="mt-2 text-[13px] leading-relaxed">
            Tento tisk ve skutečnosti novelizuje <span className="font-black">{f.int(bill.amendedLawsFull.length)}</span>{" "}
            {bill.amendedLawsFull.length === 1 ? "zákon" : "zákonů"} — o{" "}
            <span className="font-black text-signal">{f.int(bill.amendsUndercount)}</span> více, než kolik zachytí
            vazba odvozená jen z citace v názvu tisku (obvyklé u obřích novel / doprovodných zákonů). Toto je
            systematický, ne ojedinělý jev — viz poznámku u „Nejnovelizovanějších zákonů“.
          </p>
          {missedRefs.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {missedRefs.map((ref) => (
                <li key={ref} className="border border-ochre/40 px-2 py-0.5 font-mono text-[11px] font-bold text-ink">
                  č. {ref} Sb.
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* formální přikázání výborům (F15) */}
      {bill.committees.length > 0 && (
        <div className="mt-6 border-t-2 border-ink pt-4">
          <SourceNote>projednávají výbory — psp.cz hist_vybory ⋈ hist (F15)</SourceNote>
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

      {/* předkladatelé */}
      {bill.sponsors.length > 0 && (
        <div className="mt-6 border-t-2 border-ink pt-4">
          <SourceNote>předkladatelé — psp.cz predkladatel</SourceNote>
          <div className="mt-3 flex flex-wrap gap-2">
            {bill.sponsors.map((s) => (
              <Link
                key={s.pspId}
                href={`/poslanec/${s.pspId}`}
                className="group inline-flex items-center gap-2 border-2 border-hairline px-3 py-1.5 transition-colors hover:border-ink hover:bg-paper-strong"
              >
                <span className="text-sm font-bold">{s.name}</span>
                <ArrowUpRight className="h-3.5 w-3.5 text-signal opacity-0 transition-opacity group-hover:opacity-100" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* příznak střetu (Case ①) */}
      {bill.flaggedConflict && (
        <div className="mt-6 border-l-4 border-signal bg-paper-strong p-4">
          <SourceNote tone="signal" className="!text-[10px]">
            možný střet zájmů · odvozeno z peněžních vazeb předkladatele (Case ①)
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
      {bill.forensic && <ForensicBlock forensic={bill.forensic} />}
    </div>
  );
}

/** Gatovaný forenzní posudek — vždy jako ODVOZENÝ návrh k revizi, ne jako fakt. */
function ForensicBlock({ forensic }: { forensic: NonNullable<LawBillView["forensic"]> }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-8 border-2 border-cobalt">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-cobalt bg-cobalt/5 px-4 py-3">
        <SourceNote tone="steel" className="!text-cobalt">
          forenzní posudek · odvozeno (gate „law-verdict“) · {forensic.reviewState}
        </SourceNote>
        <span className="font-mono text-[11px] uppercase tracking-wider text-steel">
          závažnost <span className="font-black text-ink">{SEVERITY_CZ[forensic.severity] ?? forensic.severity}</span>
          {forensic.confidence != null && <> · jistota {forensic.confidence}/5</>}
        </span>
      </div>
      <div className="space-y-4 px-4 py-4">
        <div>
          <SourceNote className="!text-[10px]">deklarovaný důvod (důvodová zpráva)</SourceNote>
          <p className="mt-1.5 text-sm leading-relaxed text-steel">{forensic.statedReasoning}</p>
        </div>
        {forensic.conflictAssessment && (
          <div>
            <SourceNote className="!text-[10px]">posouzení střetu</SourceNote>
            <p className="mt-1.5 text-sm leading-relaxed">{forensic.conflictAssessment}</p>
          </div>
        )}

        {open && (
          <>
            {forensic.researchedContext && (
              <div>
                <SourceNote className="!text-[10px]">nezávislý kontext (rešerše)</SourceNote>
                <p className="mt-1.5 text-sm leading-relaxed text-steel">{forensic.researchedContext}</p>
              </div>
            )}
            {forensic.unstatedEffects.length > 0 && (
              <div>
                <SourceNote className="!text-[10px]">nedeklarované dopady · každý s citací</SourceNote>
                <ul className="mt-2 space-y-3">
                  {forensic.unstatedEffects.map((u, i) => (
                    <li key={i} className="border-l-4 border-signal pl-3">
                      <p className="text-sm font-medium leading-snug">{u.effect}</p>
                      <p className="mt-1 text-[13px] leading-snug text-steel">
                        <span className="font-bold uppercase tracking-wide">komu prospívá:</span> {u.whoBenefits}
                      </p>
                      {/^https?:\/\//.test(u.evidence) && (
                        <a href={u.evidence} target="_blank" rel="noreferrer" className="mt-0.5 inline-flex items-center gap-1 font-mono text-[11px] text-cobalt hover:text-signal">
                          zdroj <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {forensic.citations.length > 0 && (
              <div>
                <SourceNote className="!text-[10px]">citace ({forensic.citations.length})</SourceNote>
                <ul className="mt-2 space-y-1.5">
                  {forensic.citations.map((c, i) => (
                    <li key={i} className="text-[13px] leading-snug text-steel">
                      <span className="font-mono text-[10px] uppercase tracking-wider text-signal">[{c.kind}]</span>{" "}
                      {c.claim}{" "}
                      {/^https?:\/\//.test(c.source) ? (
                        <a href={c.source} target="_blank" rel="noreferrer" className="text-cobalt hover:text-signal">↗</a>
                      ) : (
                        <span className="font-mono text-[11px] text-steel">({c.source})</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="font-mono text-[11px] font-bold uppercase tracking-wider text-cobalt transition-colors hover:text-signal"
        >
          {open ? "méně —" : "rešerše, nedeklarované dopady a citace +"}
        </button>
        <p className="border-t border-hairline pt-3 text-[13px] italic leading-relaxed text-steel">
          Odvozený nález gatovaný proti fabrikaci (každá citovaná č. N/RRRR Sb. musí být reálný zákon).
          Uložen jako <span className="font-bold not-italic">pending_review</span> — podnět pro člověka, ne publikovaný verdikt.
        </p>
      </div>
    </div>
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
