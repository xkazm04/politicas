"use client";

/**
 * Souboj — dva poslanci vedle sebe, složka po složce (REÁLNÁ DATA). Zrcadlené
 * pruhy se potkávají uprostřed; vítěz složky nese signální hodnotu. Rozdíl
 * kompozitu (indexu přispění) v titulku, váhy složek u popisků. Pruh = body
 * složky / její váha; číslo = získané body.
 */

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowUpRight } from "lucide-react";
import type { LeaderboardData, LeaderboardListEntry } from "../getLeaderboardData";
import { componentWinner, duelOutcome } from "../duel";
import { useFormat } from "@/lib/i18n/useFormat";
import AnimatedScore from "@/features/shared/components/AnimatedScore";
import SourceNote from "@/features/shared/components/SourceNote";

function Fighter({ row, align, custom }: { row: LeaderboardListEntry; align: "left" | "right"; custom: boolean }) {
  const t = useTranslations("civicscore");
  const f = useFormat();
  const right = align === "right";
  return (
    <div className={right ? "text-right" : "text-left"}>
      <div className={`flex items-center gap-2 ${right ? "justify-end" : ""}`}>
        <Link
          href={`/poslanec/${row.pspId}`}
          className="inline-flex items-center gap-1.5 text-2xl font-black uppercase tracking-tight hover:text-signal sm:text-3xl"
        >
          {row.name}
          <ArrowUpRight className="h-5 w-5 text-signal" />
        </Link>
      </div>
      <div className={`mt-0.5 flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-steel ${right ? "justify-end" : ""}`}>
        <span className="inline-block h-2 w-2 rounded-full" style={{ background: row.clubColor }} />
        {row.clubName.split(" ")[0]} ·{" "}
        {row.tiedCount > 1 ? t("rankShared", { rank: f.int(row.rank) }) : t("rank", { rank: f.int(row.rank) })}
      </div>
      {/* Kobaltová číslice = vaše číslo, ne zveřejněné (konvence z landing LiveSpecimen). */}
      <AnimatedScore
        value={row.score}
        format={f.dec}
        className={`mt-2 block text-6xl font-black leading-none tracking-tighter sm:text-7xl ${custom ? "text-cobalt" : ""}`}
      />
    </div>
  );
}

export default function HeadToHead({
  pair,
  components,
  custom = false,
}: {
  pair: [LeaderboardListEntry, LeaderboardListEntry] | null;
  components: LeaderboardData["components"];
  /** True = položky i váhy jsou čtenářova čočka (otevřený index) — obě pravidla
   *  z ../duel.ts jsou čisté funkce a běží nad libovolnými vahami beze změny;
   *  jen citace musí říct, čí čísla to jsou. Česká kopie inline (messages/*.json
   *  je ve fleet režimu mimo hranici — týž precedens jako LeaderboardTable). */
  custom?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const t = useTranslations("civicscore");
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
  // Nula není náskok. Dřív `diff >= 0 ? a : b` vyhlásilo vítěze i při shodě a
  // vypsalo „vede o 0,0 b" (36 z 21 321 dvojic má shodné skóre). Pravidlo je
  // čistá funkce s testy — viz ../duel.ts.
  const outcome = duelOutcome(a, b);
  const diffLabel = `${f.dec(outcome.diff)} ${tcom("pts")}`;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={`${a.pspId}-${b.pspId}`}
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduceMotion ? undefined : { opacity: 0 }}
        transition={{ duration: 0.25 }}
      >
        <div className="grid grid-cols-2 items-end gap-6">
          <Fighter row={a} align="left" custom={custom} />
          <Fighter row={b} align="right" custom={custom} />
        </div>
        <p className="mt-3 border-y-2 border-ink py-2 text-center font-mono text-xs font-bold uppercase tracking-widest">
          {outcome.tied
            ? t("tieLine")
            : t.rich("leadLine", {
                name: outcome.leader.name.split(" ").at(-1) ?? outcome.leader.name,
                diffLabel,
                diff: (chunks) => <span className="text-signal">{chunks}</span>,
              })}
        </p>

        <div className="mt-6 space-y-4">
          {components.map((c) => {
            const pa = a.components[c.key];
            const pb = b.components[c.key];
            // Číslo se tiskne na stejné desetině, na jaké složku počítá index, a
            // signální barvu dostane jen skutečně vyšší hodnota. Dřív se tisklo
            // celé číslo (Math.round), ale barvilo se podle nezaokrouhlené — 672
            // ze 127 926 buněk tak ukázalo dvě stejná čísla s jedním „vítězem".
            const va = f.dec(pa);
            const vb = f.dec(pb);
            const winner = componentWinner(pa, pb);
            // Pruh = podíl získaných bodů na max. váze složky. Čtenářova čočka
            // může složku vynulovat — váha 0 pak znamená prázdný pruh, ne NaN.
            const wa = c.weight > 0 ? (pa / c.weight) * 100 : 0;
            const wb = c.weight > 0 ? (pb / c.weight) * 100 : 0;
            // Efektivní váhy čočky jsou na desetiny; zveřejněné jsou celé.
            const weightLabel = Number.isInteger(c.weight) ? f.int(c.weight) : f.dec(c.weight);
            return (
              <div key={c.key} className="grid grid-cols-[3.5rem_1fr_auto_1fr_3.5rem] items-center gap-3">
                <span className={`text-right text-lg font-black tabular-nums ${winner === "a" ? "text-signal" : "text-ink"}`}>
                  {va}
                </span>
                <div className="flex justify-end bg-hairline">
                  <motion.span
                    className="block h-4 bg-ink"
                    initial={false}
                    animate={{ width: `${wa}%` }}
                    transition={reduceMotion ? { duration: 0 } : { duration: 0.4 }}
                  />
                </div>
                <span className={`min-w-[7.5rem] text-center font-mono text-[11px] font-bold uppercase tracking-wider ${custom ? "text-cobalt" : "text-steel"}`}>
                  {c.label} × {weightLabel}
                </span>
                <div className="flex justify-start bg-hairline">
                  <motion.span
                    className="block h-4 bg-ink"
                    initial={false}
                    animate={{ width: `${wb}%` }}
                    transition={reduceMotion ? { duration: 0 } : { duration: 0.4 }}
                  />
                </div>
                <span className={`text-lg font-black tabular-nums ${winner === "b" ? "text-signal" : "text-ink"}`}>
                  {vb}
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-4">
          {custom ? (
            <SourceNote>
              souboj pod vaším indexem — skóre i složky přepočteny podle vašich vah (pravidlo
              čočky viz /01); nejde o zveřejněnou metodiku
            </SourceNote>
          ) : (
            <SourceNote>
              {t("footnote")}
            </SourceNote>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
