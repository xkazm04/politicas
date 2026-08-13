"use client";

/**
 * Kronika rebelií + míra rebelie nad REÁLNÝM záznamem. Vlevo jmenovité hlasy
 * proti linii vlastního klubu (nejnovější první, proklik na skutečný profil i
 * na zápis v deníku / psp.cz); vpravo žebříček poslanců podle míry rebelie —
 * počítáno jen nad hlasováními, kde klub linii měl, a jen pro poslance nad
 * zveřejněným prahem měřitelnosti (lib/analysis/kg.ts MIN_ELIGIBLE_VOTES).
 */

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { MIN_ELIGIBLE_VOTES } from "@/lib/analysis/kg";
import { useFormat } from "@/lib/i18n/useFormat";
import SourceNote from "@/features/shared/components/SourceNote";
import { votePspUrl } from "../record/anchor";
import { clubStyle } from "../record/clubStyle";
import type { VoteRecordData } from "../record/types";

export default function RealRebellions({
  data,
  onSelectVote,
}: {
  data: VoteRecordData;
  onSelectVote: (votePspId: number) => void;
}) {
  const t = useTranslations("votetrack");
  const tcom = useTranslations("common");
  const f = useFormat();
  const maxRate = data.topRebels.length ? data.topRebels[0].rate : 0;

  return (
    <div className="grid gap-12 lg:grid-cols-2">
      {/* ── kronika ───────────────────────────────────────────── */}
      <div className="min-w-0">
        {/* Výpis JE okno; populace je `chronicleTotal` spočítaný před řezem.
            Bez ní se „24 nejnovějších" čte jako „rebelií bylo dvacet čtyři". */}
        <SourceNote>
          {t("record.chronicleNote", { shown: f.int(data.chronicle.length), total: f.int(data.chronicleTotal) })}
        </SourceNote>
        {/* Kronika i žebříček JSOU seznamy — do 2026-08-12 to byly holé <div>y,
            takže odečítačka neuměla říct, že jde o seznam, ani kolik má položek
            (týž nález a týž lék jako v /denik). Tabulkou schválně nejsou: řádek
            kroniky je věta („X hlasoval PRO proti linii klubu, tisk Y"), ne
            mřížka hodnot, a řádek žebříčku je celý jedním odkazem na spis —
            role `row`/`cell` by tu roli odkazu přepsaly. */}
        <ul className="mt-3 list-none border-t-2 border-ink" aria-label={t("record.chronicleListAria")}>
          {data.chronicle.map((r) => (
            <li key={`${r.votePspId}-${r.personPspId}`} className="border-b border-hairline px-2 py-4">
              <span className="flex items-center justify-between gap-3">
                <span className="font-mono text-xs uppercase tracking-wider text-steel-aa">
                  {r.votedOn ? f.date(r.votedOn) : "—"}
                </span>
                {r.inLedger ? (
                  <button
                    type="button"
                    onClick={() => onSelectVote(r.votePspId)}
                    className="inline-flex items-center gap-1 font-mono text-[11px] font-bold uppercase tracking-wider text-cobalt transition-colors hover:text-signal motion-reduce:transition-none"
                  >
                    {t("record.seismoJump")} <ArrowUpRight className="h-3 w-3" aria-hidden />
                  </button>
                ) : (
                  <a
                    href={votePspUrl(r.votePspId)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-mono text-[11px] font-bold uppercase tracking-wider text-steel-aa transition-colors hover:text-ink motion-reduce:transition-none"
                  >
                    psp.cz <ArrowUpRight className="h-3 w-3" aria-hidden />
                  </a>
                )}
              </span>
              <span className="mt-1 block text-[15px] leading-relaxed">
                <Link href={`/poslanec/${r.personPspId}`} className="font-black uppercase underline-offset-2 hover:underline">
                  {r.name}
                </Link>{" "}
                <span className="text-steel-aa">({clubStyle(r.club).short})</span> {t("votedVerb")}{" "}
                <span
                  className={`font-mono text-sm font-bold uppercase ${r.choice === "yes" ? "text-cobalt" : "text-signal-deep"}`}
                >
                  {r.choice === "yes" ? tcom("voteChoice.for") : tcom("voteChoice.against")}
                </span>{" "}
                {t("againstPartyLine")} <span className="line-clamp-2">{r.title}</span>
              </span>
            </li>
          ))}
          {data.chronicle.length === 0 && (
            <li className="border-2 border-dashed border-hairline p-6 text-sm text-steel-aa">{t("record.noRebellions")}</li>
          )}
        </ul>
      </div>

      {/* ── míra rebelie ──────────────────────────────────────── */}
      <div className="min-w-0">
        {/* Žebříček je useknutý na TOP_REBELS_CAP; kolik poslanců prošlo prahem
            měřitelnosti, ví jen derivace — a tady se to říká. */}
        <SourceNote>
          {t("record.topRebelsNote", {
            minEligible: MIN_ELIGIBLE_VOTES,
            shown: f.int(data.topRebels.length),
            total: f.int(data.topRebelsTotal),
          })}
        </SourceNote>
        <ul className="mt-3 list-none border-t-2 border-ink" aria-label={t("record.topRebelsListAria")}>
          {data.topRebels.map((r) => (
            <li key={r.personPspId}>
              <Link
                href={`/poslanec/${r.personPspId}`}
                className="group grid grid-cols-[10.5rem_1fr_5.5rem] items-center gap-3 border-b border-hairline px-2 py-3.5 transition-colors hover:bg-paper-strong motion-reduce:transition-none"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-black uppercase tracking-tight">{r.name}</span>
                  <span className="mt-0.5 flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-steel-aa">
                    <span
                      aria-hidden
                      className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ background: clubStyle(r.club).color }}
                    />
                    {/* Klub se sází ve své DISPLEJOVÉ formě („TOP 09") a čte se
                        tak, jak je vidět: `clubStyle` je jediný zdroj té formy
                        a záznam hlasování žádný delší název klubu nenese, takže
                        `sr-only` kopie by odečítačce nabídla jen holou rejstříkovou
                        zkratku („TOP09") — horší čtení téhož faktu, ne doplněk. */}
                    {clubStyle(r.club).short} ·{" "}
                    {t("record.eligibleShort", { rebel: f.int(r.rebelVotes), eligible: f.int(r.eligibleVotes) })}
                  </span>
                </span>
                {/* Pruh je JEN obrázek téhož čísla, které stojí vpravo — dvakrát
                    přečtený by byl dvakrát tentýž údaj. */}
                <span aria-hidden className="h-4 w-full bg-hairline">
                  <span
                    className="block h-full bg-ink"
                    style={{ width: `${maxRate > 0 ? (r.rate / maxRate) * 100 : 0}%` }}
                  />
                </span>
                <span className="text-right text-lg font-black tabular-nums">
                  {/* Holé „41,6 %" nemá bez sloupce podmět — jmenovku nese sr-only text. */}
                  <span className="sr-only">{t("record.rateAria")} </span>
                  {f.dec(Math.round(r.rate * 1000) / 10)} %
                  <ArrowUpRight
                    className="ml-1 inline h-3.5 w-3.5 align-baseline text-steel-aa transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transition-none"
                    aria-hidden
                  />
                </span>
              </Link>
            </li>
          ))}
          {data.topRebels.length === 0 && (
            <li className="border-2 border-dashed border-hairline p-6 text-sm text-steel-aa">{t("record.topRebelsEmpty")}</li>
          )}
        </ul>
      </div>
    </div>
  );
}
