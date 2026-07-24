"use client";

/**
 * Kniha doložených vazeb — vazby vzorku seskupené po poslancích, se stavem
 * kontroly. Sporné záznamy nesou okrový štítek „čeká na kontrolu" a do
 * skóre se nepropisují; poslanci bez vazeb jsou uvedeni výslovně (absence
 * nálezu je také zjištění).
 */

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { MONEY_TIES, MPS } from "@/lib/civic/data";
import { useFormat } from "@/lib/i18n/useFormat";
import SourceNote from "@/features/shared/components/SourceNote";

const WITH_TIES = MPS.filter((m) => MONEY_TIES.some((tie) => tie.mpId === m.id));
const WITHOUT_TIES = MPS.filter((m) => !MONEY_TIES.some((tie) => tie.mpId === m.id));

export default function TiesLedger() {
  const t = useTranslations("money");
  const tc = useTranslations("content");
  const tcom = useTranslations("common");
  const f = useFormat();

  return (
    <div>
      {WITH_TIES.map((mp) => {
        const ties = MONEY_TIES.filter((tie) => tie.mpId === mp.id);
        return (
          <div key={mp.id} className="mb-8">
            <Link
              href={`/poslanec/${mp.id}`}
              className="group flex items-center justify-between gap-3 border-b-2 border-ink pb-2 transition-colors hover:text-signal"
            >
              <span className="text-xl font-black uppercase tracking-tight">
                {mp.name}
                <span className="ml-2 font-mono text-xs font-normal normal-case tracking-normal text-steel">
                  · {mp.party} · {t("ledger.caseFile", { rank: f.int(mp.rank) })}
                </span>
              </span>
              <ArrowUpRight className="h-5 w-5 text-signal transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
            {ties.map((tie) => {
              const i = MONEY_TIES.indexOf(tie);
              return (
                <div
                  key={`${tie.mpId}-${tie.company}`}
                  className="grid gap-3 border-b border-hairline px-1 py-4 sm:grid-cols-[1.2fr_1fr_auto]"
                >
                  <span>
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-black uppercase tracking-tight">{tc(`moneyTies.${i}.company`)}</span>
                      {tie.verified ? (
                        <span className="border-2 border-cobalt px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-cobalt">
                          {tcom("verified")}
                        </span>
                      ) : (
                        <span className="border-2 border-ochre bg-ochre/15 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-ink">
                          {tcom("pendingReview")}
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block font-mono text-[11px] uppercase tracking-wider text-steel">
                      IČO {tie.ico} · {tc(`moneyTies.${i}.kind`)}
                    </span>
                  </span>
                  <span className="text-[15px] leading-relaxed text-steel">{tc(`moneyTies.${i}.note`)}</span>
                  <span className="text-right">
                    <span className={`block text-xl font-black tabular-nums ${tie.amount === "—" ? "text-steel" : "text-signal"}`}>
                      {tc(`moneyTies.${i}.amount`)}
                    </span>
                    <span className="mt-0.5 block font-mono text-[11px] uppercase tracking-wider text-steel">
                      {tie.year} · {tc(`moneyTies.${i}.source`)}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        );
      })}

      <div className="border-2 border-dashed border-hairline p-5">
        <SourceNote>{t("ledger.noTiesNote")}</SourceNote>
        <div className="mt-2 flex flex-wrap gap-2">
          {WITHOUT_TIES.map((mp) => (
            <Link
              key={mp.id}
              href={`/poslanec/${mp.id}`}
              className="border-2 border-hairline px-3 py-1.5 text-sm font-bold transition-colors hover:border-ink hover:bg-paper-strong"
            >
              {mp.name}
            </Link>
          ))}
        </div>
      </div>

      <p className="mt-4 max-w-3xl text-sm italic leading-relaxed text-steel">
        {t("ledger.disclaimer", { pendingLabel: tcom("pendingReview") })}
      </p>
    </div>
  );
}
