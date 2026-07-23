"use client";

/**
 * Pohled do sálu — detail vybraného hlasování (detail strana fúze).
 * Hemicykl 200 křesel, sečtená legenda, rozpad po stranách s linií i
 * disciplínou klubu a hlasy sledovaného vzorku s proklikem do spisů.
 */

import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { RollCall } from "@/lib/civic/data";
import { MPS, PARTIES } from "@/lib/civic/data";
import { chamberSplit, partyDiscipline, partyLine } from "@/lib/civic/votes";
import SourceNote from "@/features/shared/components/SourceNote";
import VoteHemicycle from "../VoteHemicycle";

const SPLIT_META = [
  { key: "pro", label: "pro", cls: "bg-cobalt" },
  { key: "proti", label: "proti", cls: "bg-signal" },
  { key: "zdrzel", label: "zdržel se", cls: "bg-ochre" },
  { key: "omluven", label: "omluven", cls: "bg-hairline" },
] as const;

const VOTE_TEXT: Record<string, string> = {
  pro: "text-cobalt",
  proti: "text-signal",
  "zdržel se": "text-ochre",
  omluven: "text-steel",
};

export default function ChamberDetail({ rc }: { rc: RollCall }) {
  const reduceMotion = useReducedMotion();
  const split = chamberSplit(rc);

  return (
    <motion.div
      key={rc.id}
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="min-w-0"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b-2 border-ink pb-3">
        <h3 className="text-2xl font-black uppercase leading-tight tracking-tight">{rc.title}</h3>
        <span
          className={`font-mono text-lg font-black uppercase tracking-wider ${
            rc.result === "přijato" ? "text-cobalt" : "text-signal"
          }`}
        >
          {rc.result}
        </span>
      </div>

      <div className="mt-6">
        <VoteHemicycle rc={rc} />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-5">
        {SPLIT_META.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-wider">
            <span className={`inline-block h-3 w-3 ${s.cls}`} />
            <span className="font-bold tabular-nums">{split[s.key]}</span>
            <span className="text-steel">{s.label}</span>
          </span>
        ))}
      </div>

      {/* Rozpad po stranách — pruhy klubu + linie + disciplína */}
      <div className="mt-8 border-t-2 border-ink pt-4">
        <SourceNote>rozpad po stranách — podíl hlasů klubu · šipka = linie · číslo = disciplína</SourceNote>
        <div className="mt-4 space-y-3">
          {PARTIES.map((p) => {
            const pv = rc.byParty[p.code];
            const line = partyLine(pv);
            const disc = Math.round(partyDiscipline(pv) * 100);
            return (
              <div key={p.code} className="grid grid-cols-[6.5rem_1fr_6.5rem] items-center gap-3">
                <span className="flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-wider">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.color }} />
                  {p.name.split(" ")[0]}
                </span>
                <div className="flex h-4 w-full overflow-hidden bg-hairline">
                  {pv.pro > 0 && <span className="h-full bg-cobalt" style={{ width: `${(pv.pro / p.seats) * 100}%` }} />}
                  {pv.zdrzel > 0 && <span className="h-full bg-ochre" style={{ width: `${(pv.zdrzel / p.seats) * 100}%` }} />}
                  {pv.omluven > 0 && <span className="h-full bg-hairline" style={{ width: `${(pv.omluven / p.seats) * 100}%` }} />}
                  {pv.proti > 0 && <span className="h-full bg-signal" style={{ width: `${(pv.proti / p.seats) * 100}%` }} />}
                </div>
                <span className="text-right font-mono text-[11px] font-bold uppercase tabular-nums">
                  <span className={line === "pro" ? "text-cobalt" : "text-signal"}>
                    {line === "pro" ? "▲" : "▼"}
                  </span>{" "}
                  <span className="text-steel">{disc} %</span>
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Vzorek */}
      <div className="mt-8 border-t-2 border-ink pt-4">
        <SourceNote>hlasy sledovaného vzorku — štítek otevírá spis</SourceNote>
        <div className="mt-3 flex flex-wrap gap-2">
          {MPS.map((m) => {
            const vote = rc.perMP[m.id];
            const rebel = rc.rebels.includes(m.id);
            return (
              <Link
                key={m.id}
                href={`/poslanec/${m.id}`}
                className="group inline-flex items-center gap-2 border-2 border-hairline px-3 py-2 transition-colors hover:border-ink hover:bg-paper-strong"
              >
                <span className="text-sm font-bold">{m.name.split(" ").at(-1)}</span>
                <span className={`font-mono text-[11px] font-bold uppercase tracking-wider ${VOTE_TEXT[vote]}`}>
                  {vote}
                </span>
                {rebel && (
                  <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-signal">rebel</span>
                )}
                <ArrowUpRight className="h-3.5 w-3.5 text-signal opacity-0 transition-opacity group-hover:opacity-100" />
              </Link>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
