"use client";

/**
 * Souboj — dva poslanci vedle sebe, pilíř po pilíři. Zrcadlené pruhy se
 * potkávají uprostřed; vítěz pilíře nese signální hodnotu. Rozdíl kompozitu
 * v titulku, váhy pilířů u popisků — metodika zůstává na očích.
 */

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowUpRight } from "lucide-react";
import { PILLARS } from "@/lib/civic/data";
import type { LeaderboardRow } from "@/lib/civic/leaderboard";
import { useFormat } from "@/lib/i18n/useFormat";
import AnimatedScore from "@/features/shared/components/AnimatedScore";
import SourceNote from "@/features/shared/components/SourceNote";

function Fighter({ row, align }: { row: LeaderboardRow; align: "left" | "right" }) {
  const t = useTranslations("civicscore");
  const f = useFormat();
  const right = align === "right";
  return (
    <div className={right ? "text-right" : "text-left"}>
      <div className={`flex items-center gap-2 ${right ? "justify-end" : ""}`}>
        {row.sample ? (
          <Link
            href={`/poslanec/${row.id}`}
            className="inline-flex items-center gap-1.5 text-2xl font-black uppercase tracking-tight hover:text-signal sm:text-3xl"
          >
            {row.name}
            <ArrowUpRight className="h-5 w-5 text-signal" />
          </Link>
        ) : (
          <span className="text-2xl font-black uppercase tracking-tight sm:text-3xl">{row.name}</span>
        )}
      </div>
      <div className={`mt-0.5 flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-steel ${right ? "justify-end" : ""}`}>
        <span className="inline-block h-2 w-2 rounded-full" style={{ background: row.partyColor }} />
        {row.party.split(" ")[0]} · {t("rank", { rank: row.rank })}
      </div>
      <AnimatedScore
        value={row.score}
        format={f.dec}
        className="mt-2 block text-6xl font-black leading-none tracking-tighter sm:text-7xl"
      />
    </div>
  );
}

export default function HeadToHead({ pair }: { pair: [LeaderboardRow, LeaderboardRow] | null }) {
  const reduceMotion = useReducedMotion();
  const t = useTranslations("civicscore");
  const tc = useTranslations("content");
  const tcom = useTranslations("common");
  const f = useFormat();

  if (!pair) {
    return (
      <div className="border-2 border-dashed border-hairline p-8">
        <p className="text-base font-black uppercase tracking-wide">{t("emptyTitle")}</p>
        <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-steel">
          {t("emptyBody")}
        </p>
      </div>
    );
  }

  const [a, b] = pair;
  const diff = Math.round((a.score - b.score) * 10) / 10;
  const leader = diff >= 0 ? a : b;
  const diffLabel = `${f.dec(Math.abs(diff))} ${tcom("pts")}`;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={`${a.id}-${b.id}`}
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduceMotion ? undefined : { opacity: 0 }}
        transition={{ duration: 0.25 }}
      >
        <div className="grid grid-cols-2 items-end gap-6">
          <Fighter row={a} align="left" />
          <Fighter row={b} align="right" />
        </div>
        <p className="mt-3 border-y-2 border-ink py-2 text-center font-mono text-xs font-bold uppercase tracking-widest">
          {t.rich("leadLine", {
            name: leader.name.split(" ").at(-1) ?? leader.name,
            diffLabel,
            diff: (chunks) => <span className="text-signal">{chunks}</span>,
          })}
        </p>

        <div className="mt-6 space-y-4">
          {PILLARS.map((p) => {
            const va = Math.round(a.pillars[p.key]);
            const vb = Math.round(b.pillars[p.key]);
            return (
              <div key={p.key} className="grid grid-cols-[3rem_1fr_auto_1fr_3rem] items-center gap-3">
                <span className={`text-right text-lg font-black tabular-nums ${va > vb ? "text-signal" : "text-ink"}`}>
                  {va}
                </span>
                <div className="flex justify-end bg-hairline">
                  <motion.span
                    className="block h-4 bg-ink"
                    initial={false}
                    animate={{ width: `${va}%` }}
                    transition={reduceMotion ? { duration: 0 } : { duration: 0.4 }}
                  />
                </div>
                <span className="min-w-[7.5rem] text-center font-mono text-[11px] font-bold uppercase tracking-wider text-steel">
                  {tc(`pillars.${p.key}.label`)} × {p.weight}
                </span>
                <div className="flex justify-start bg-hairline">
                  <motion.span
                    className="block h-4 bg-ink"
                    initial={false}
                    animate={{ width: `${vb}%` }}
                    transition={reduceMotion ? { duration: 0 } : { duration: 0.4 }}
                  />
                </div>
                <span className={`text-lg font-black tabular-nums ${vb > va ? "text-signal" : "text-ink"}`}>
                  {vb}
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-4">
          <SourceNote>
            {t("footnote")}
          </SourceNote>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
