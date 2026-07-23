"use client";

/**
 * Kniha doložených vazeb — vazby vzorku seskupené po poslancích, se stavem
 * kontroly. Sporné záznamy nesou okrový štítek „čeká na kontrolu" a do
 * skóre se nepropisují; poslanci bez vazeb jsou uvedeni výslovně (absence
 * nálezu je také zjištění).
 */

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { MONEY_TIES, MPS } from "@/lib/civic/data";
import SourceNote from "@/features/shared/components/SourceNote";

const WITH_TIES = MPS.filter((m) => MONEY_TIES.some((t) => t.mpId === m.id));
const WITHOUT_TIES = MPS.filter((m) => !MONEY_TIES.some((t) => t.mpId === m.id));

export default function TiesLedger() {
  return (
    <div>
      {WITH_TIES.map((mp) => {
        const ties = MONEY_TIES.filter((t) => t.mpId === mp.id);
        return (
          <div key={mp.id} className="mb-8">
            <Link
              href={`/poslanec/${mp.id}`}
              className="group flex items-center justify-between gap-3 border-b-2 border-ink pb-2 transition-colors hover:text-signal"
            >
              <span className="text-xl font-black uppercase tracking-tight">
                {mp.name}
                <span className="ml-2 font-mono text-xs font-normal normal-case tracking-normal text-steel">
                  · {mp.party} · spis č. {mp.rank}
                </span>
              </span>
              <ArrowUpRight className="h-5 w-5 text-signal transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
            {ties.map((t) => (
              <div
                key={`${t.mpId}-${t.company}`}
                className="grid gap-3 border-b border-hairline px-1 py-4 sm:grid-cols-[1.2fr_1fr_auto]"
              >
                <span>
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-black uppercase tracking-tight">{t.company}</span>
                    {t.verified ? (
                      <span className="border-2 border-cobalt px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-cobalt">
                        doloženo
                      </span>
                    ) : (
                      <span className="border-2 border-ochre bg-ochre/15 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-ink">
                        čeká na kontrolu
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block font-mono text-[11px] uppercase tracking-wider text-steel">
                    IČO {t.ico} · {t.kind}
                  </span>
                </span>
                <span className="text-[15px] leading-relaxed text-steel">{t.note}</span>
                <span className="text-right">
                  <span className={`block text-xl font-black tabular-nums ${t.amount === "—" ? "text-steel" : "text-signal"}`}>
                    {t.amount}
                  </span>
                  <span className="mt-0.5 block font-mono text-[11px] uppercase tracking-wider text-steel">
                    {t.year} · {t.source}
                  </span>
                </span>
              </div>
            ))}
          </div>
        );
      })}

      <div className="border-2 border-dashed border-hairline p-5">
        <SourceNote>bez doložených vazeb — kontrola běží při každé denní ingesci</SourceNote>
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
        Vazby zveřejňujeme jako datovaná, doložená fakta — nikdy jako obvinění. Záznamy
        se štítkem &bdquo;čeká na kontrolu&ldquo; se do pilíře Integrita nepropisují,
        dokud je neschválí člověk.
      </p>
    </div>
  );
}
