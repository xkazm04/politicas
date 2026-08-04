"use client";

/*
 * VZORKOVÝ žebříček — OZNAČENÝ fallback pro úplný výpadek grafu. Reálných
 * top 5 sází přímo ../DashboardPage.tsx z loaderu.
 *
 * Vlastní modul proto, že tenhle renderer (řádky se čtyřmi pilíři, `RankDelta`,
 * `PILLAR_BG`) na šťastné cestě nikdy nic nevykreslí — a přesto se do balíku
 * dostával vždycky.
 */

import { useTranslations } from "next-intl";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { MPS, PILLARS } from "@/lib/civic/data";
import { useFormat } from "@/lib/i18n/useFormat";
import RankDelta from "@/features/shared/components/RankDelta";
import SourceNote from "@/features/shared/components/SourceNote";
import { PILLAR_BG } from "@/features/landing/palette";

export default function MockRankingLedger() {
  const t = useTranslations("dashboard");
  const tc = useTranslations("content");
  const f = useFormat();

  return (
    <>
      {MPS.map((m) => (
        <Link
          key={m.id}
          href="/zebricek"
          className="group grid grid-cols-[2.5rem_1fr_auto_auto_auto] items-center gap-4 border-b border-hairline px-2 py-3.5 transition-colors hover:bg-paper-strong"
        >
          <span className={`font-mono text-xl font-bold ${m.rank <= 3 ? "text-signal" : "text-steel"}`}>
            {m.rank}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-base font-black uppercase tracking-tight">{m.name}</span>
            <span className="mt-0.5 flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-steel">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: m.partyColor }} />
              {m.party} · {tc(`regions.${m.region}`)}
            </span>
            {/* Rozpad kompozitu na pilíře — odečet, ne dekorace. */}
            <span className="mt-1.5 flex h-1.5 w-full max-w-56 gap-px" aria-hidden>
              {PILLARS.map((p) => (
                <span
                  key={p.key}
                  className={`${PILLAR_BG[p.key]} block`}
                  style={{ width: `${m.pillars[p.key] / 4}%`, minWidth: 2 }}
                />
              ))}
            </span>
          </span>
          <RankDelta delta={m.delta} />
          <span className="text-xl font-black tabular-nums">{f.dec(m.score)}</span>
          <ArrowUpRight className="h-4 w-4 text-signal transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </Link>
      ))}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
        <SourceNote>{t("rankingFootnote")}</SourceNote>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {PILLARS.map((p) => (
            <span
              key={p.key}
              className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest text-steel"
            >
              <span className={`inline-block h-2 w-2 ${PILLAR_BG[p.key]}`} />
              {tc(`pillars.${p.key}.label`)}
            </span>
          ))}
        </span>
      </div>
    </>
  );
}
