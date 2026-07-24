"use client";

/*
 * Spis poslance (/poslanec/[id]) — první plocha z roadmapy politicas.md
 * (§3: „skutečný produkt je profil osoby agregující všech pět modulů").
 * Vzniklo fúzí dashboardové varianty „Spis" po vítězství Velína: dossier
 * povýšený na plakátovou laťku — velká hlavička se skóre a trendem,
 * číslované oddíly 01 Pilíře / 02 Hlasování / 03 Peněžní vazby, citace
 * u každého čísla, vazby jako datovaná fakta — nikdy obvinění.
 */

import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Area, AreaChart, ResponsiveContainer, Tooltip, YAxis } from "recharts";
import type { MP, VoteChoice } from "@/lib/civic/data";
import { MONEY_TIES, MPS, PILLARS, ROLL_CALLS, TREND_QUARTERS } from "@/lib/civic/data";
import { useFormat } from "@/lib/i18n/useFormat";
import AnimatedScore from "@/features/shared/components/AnimatedScore";
import RankDelta from "@/features/shared/components/RankDelta";
import SectionHeading from "@/features/shared/components/SectionHeading";
import SourceNote from "@/features/shared/components/SourceNote";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { INK, PILLAR_FILL, SIGNAL, TOOLTIP_STYLE } from "@/features/landing/palette";

/** Hlas poslance jako plochý štítek — barvy drží řeč plakátu. */
function VoteChip({ vote }: { vote: VoteChoice }) {
  const tcom = useTranslations("common");
  const cls: Record<VoteChoice, string> = {
    pro: "bg-cobalt text-paper",
    proti: "bg-signal text-paper",
    "zdržel se": "bg-ochre text-ink",
    omluven: "border border-steel text-steel",
  };
  const labels: Record<VoteChoice, string> = {
    pro: tcom("voteChoice.for"),
    proti: tcom("voteChoice.against"),
    "zdržel se": tcom("voteChoice.abstained"),
    omluven: tcom("voteChoice.excused"),
  };
  return (
    <span className={`inline-block px-2.5 py-1 font-mono text-xs font-bold uppercase tracking-wider ${cls[vote]}`}>
      {labels[vote]}
    </span>
  );
}

export default function ProfilePage({ mp }: { mp: MP }) {
  const reduceMotion = useReducedMotion();
  const t = useTranslations("profile");
  const tc = useTranslations("content");
  const tcom = useTranslations("common");
  const f = useFormat();
  const ties = MONEY_TIES.map((tie, i) => ({ ...tie, i })).filter((tie) => tie.mpId === mp.id);
  const trendData = mp.trend.map((v, i) => ({ q: TREND_QUARTERS[i], skóre: v }));
  const idx = MPS.findIndex((m) => m.id === mp.id);
  const prev = MPS[(idx - 1 + MPS.length) % MPS.length];
  const next = MPS[(idx + 1) % MPS.length];

  return (
    <main className="min-h-screen overflow-x-clip bg-paper font-sans text-ink">
      {/* ── Lišta ───────────────────────────────────────────── */}
      <header className="border-b-4 border-ink">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-3 transition-colors hover:text-signal">
              <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden>
                <rect width="32" height="32" className="fill-signal" />
                <circle cx="16" cy="16" r="9" className="fill-paper" />
                <rect x="14.5" y="4" width="3" height="24" className="fill-ink" />
              </svg>
              <span className="text-xl font-black uppercase tracking-tight">Politicas</span>
            </Link>
            <span className="font-mono text-xs uppercase tracking-widest text-steel">/ {t("breadcrumb")}</span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-cobalt transition-colors hover:text-signal"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> {t("backToDashboard")}
            </Link>
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6">
        {/* ── Hlavička spisu ────────────────────────────────── */}
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="border-b border-hairline py-12"
        >
          <SourceNote tone="signal">
            {t("fileNumber", { rank: mp.rank, party: mp.party, region: tc(`regions.${mp.region}`) })}
          </SourceNote>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-8">
            <h1 className="text-6xl font-black uppercase leading-[0.92] tracking-tight sm:text-7xl">
              {mp.name.split(" ")[0]}
              <br />
              <span className="text-signal">{mp.name.split(" ").slice(1).join(" ")}</span>
            </h1>
            <div className="flex items-end gap-6">
              <div className="text-right">
                <AnimatedScore
                  value={mp.score}
                  format={f.dec}
                  className="text-[7rem] font-black leading-[0.85] tracking-tighter sm:text-[8rem]"
                />
                <div className="mt-2 flex items-center justify-end gap-3">
                  <RankDelta delta={mp.delta} />
                  <span className="font-mono text-xs uppercase tracking-widest text-steel">
                    {tcom("of100")} · {TREND_QUARTERS.at(-1)}
                  </span>
                </div>
              </div>
              <div>
                <div className="w-36 overflow-hidden" style={{ aspectRatio: "2 / 1" }}>
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                    <AreaChart data={trendData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                      <YAxis hide domain={["dataMin - 2", "dataMax + 2"]} />
                      <Tooltip
                        cursor={false}
                        contentStyle={TOOLTIP_STYLE}
                        formatter={(value) => [f.dec(Number(value)), t("trendTooltip")]}
                        labelFormatter={(_, payload) => payload?.[0]?.payload?.q ?? ""}
                      />
                      <Area
                        type="linear"
                        dataKey="skóre"
                        stroke={SIGNAL}
                        strokeWidth={2.5}
                        fill={SIGNAL}
                        fillOpacity={0.12}
                        dot={false}
                        activeDot={{ r: 3.5, fill: INK }}
                        isAnimationActive={!reduceMotion}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <SourceNote className="mt-1 !text-[10px]">
                  {t("trendMeta", { count: TREND_QUARTERS.length })}
                </SourceNote>
              </div>
            </div>
          </div>
          <p className="mt-6 max-w-2xl border-l-4 border-signal pl-4 text-base italic leading-relaxed text-steel">
            {tc(`mpHeadlines.${mp.id}`)}
          </p>
        </motion.div>

        {/* ── 01 Pilíře ─────────────────────────────────────── */}
        <section className="pt-12">
          <SectionHeading
            index={1}
            title={t("pillarsHeading")}
            aside={<SourceNote>{t("pillarsAside")}</SourceNote>}
          />
          <div className="mt-8 grid gap-px border border-ink bg-ink sm:grid-cols-2 lg:grid-cols-4">
            {PILLARS.map((p) => (
              <div key={p.key} className="bg-paper p-6">
                <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-steel">
                  {tc(`pillars.${p.key}.label`)} × {p.weight}
                </p>
                <p className="mt-3 text-5xl font-black tabular-nums">{f.int(mp.pillars[p.key])}</p>
                <div className="mt-3 h-2 w-full bg-hairline">
                  <motion.div
                    className="h-full"
                    style={{ background: PILLAR_FILL[p.key] }}
                    initial={{ width: 0 }}
                    whileInView={{ width: `${mp.pillars[p.key]}%` }}
                    viewport={{ once: true }}
                    transition={reduceMotion ? { duration: 0 } : { duration: 0.6 }}
                  />
                </div>
                <p className="mt-3 text-sm leading-snug text-steel">{tc(`pillars.${p.key}.question`)}</p>
                <SourceNote className="mt-3 !text-[10px]">
                  {tcom("sourcePrefix")} {tc(`pillars.${p.key}.source`)}
                </SourceNote>
              </div>
            ))}
          </div>
        </section>

        {/* ── 02 Hlasování ──────────────────────────────────── */}
        <section className="mt-16 border-t-4 border-ink pt-10">
          <SectionHeading
            index={2}
            title={t("votesHeading")}
            aside={<SourceNote>{t("votesAside")}</SourceNote>}
          />
          <div className="mt-8 overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left">
              <thead>
                <tr className="border-b-2 border-ink font-mono text-[11px] uppercase tracking-widest text-steel">
                  <th className="py-3 pr-4 font-bold">{t("dateHeader")}</th>
                  <th className="py-3 pr-4 font-bold">{t("motionHeader")}</th>
                  <th className="py-3 pr-4 font-bold">{t("resultHeader")}</th>
                  <th className="py-3 font-bold">{t("choiceHeader")}</th>
                </tr>
              </thead>
              <tbody>
                {ROLL_CALLS.map((rc) => {
                  const vote = rc.perMP[mp.id];
                  const rebel = rc.rebels.includes(mp.id);
                  return (
                    <tr key={rc.id} className="border-b border-hairline align-top transition-colors hover:bg-paper-strong">
                      <td className="whitespace-nowrap py-4 pr-4 font-mono text-xs text-steel">
                        {f.date(rc.date)}
                      </td>
                      <td className="py-4 pr-4">
                        <span className="text-[15px] font-medium leading-snug">{tc(`rollCalls.${rc.id}.title`)}</span>
                        <span className="mt-0.5 block font-mono text-[11px] uppercase tracking-wider text-steel">
                          {tc(`rollCalls.${rc.id}.tisk`)} · {f.int(rc.pro)}:{f.int(rc.proti)}
                        </span>
                      </td>
                      <td className="py-4 pr-4">
                        <span
                          className={`font-mono text-xs font-bold uppercase tracking-wider ${
                            rc.result === "přijato" ? "text-cobalt" : "text-signal"
                          }`}
                        >
                          {tcom(rc.result === "přijato" ? "voteResult.accepted" : "voteResult.rejected")}
                        </span>
                      </td>
                      <td className="whitespace-nowrap py-4">
                        <VoteChip vote={vote} />
                        {rebel && (
                          <span className="ml-2 font-mono text-[11px] font-bold uppercase tracking-wider text-signal">
                            {t("rebelTag")}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── 03 Peněžní vazby ──────────────────────────────── */}
        <section className="mt-16 border-t-4 border-ink pt-10 pb-8">
          <SectionHeading
            index={3}
            title={t("moneyHeading")}
            aside={
              <span className="flex flex-wrap items-baseline gap-4">
                <SourceNote>{t("moneyAside")}</SourceNote>
                <Link
                  href="/penize"
                  className="font-mono text-xs font-bold uppercase tracking-wider text-cobalt transition-colors hover:text-signal"
                >
                  {t("moneyLink")}
                </Link>
              </span>
            }
          />
          {ties.length === 0 ? (
            <div className="mt-8 border-2 border-dashed border-hairline p-8">
              <p className="text-base font-black uppercase tracking-wide">
                {t("moneyEmptyTitle")}
              </p>
              <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-steel">
                {t("moneyEmptyBody")}
              </p>
            </div>
          ) : (
            <div className="mt-8 border-t-2 border-ink">
              {ties.map((tie) => (
                <div
                  key={`${tie.mpId}-${tie.company}`}
                  className="grid gap-3 border-b border-hairline px-2 py-5 sm:grid-cols-[1.2fr_1fr_auto]"
                >
                  <span>
                    <span className="block text-lg font-black uppercase tracking-tight">
                      {tc(`moneyTies.${tie.i}.company`)}
                    </span>
                    <span className="mt-0.5 block font-mono text-[11px] uppercase tracking-wider text-steel">
                      IČO {tie.ico} · {tc(`moneyTies.${tie.i}.kind`)}
                    </span>
                  </span>
                  <span className="text-[15px] leading-relaxed text-steel">{tc(`moneyTies.${tie.i}.note`)}</span>
                  <span className="text-right">
                    <span className={`block text-2xl font-black tabular-nums ${tie.amount === "—" ? "text-steel" : "text-signal"}`}>
                      {tc(`moneyTies.${tie.i}.amount`)}
                    </span>
                    <span className="mt-0.5 block font-mono text-[11px] uppercase tracking-wider text-steel">
                      {tie.year} · {tc(`moneyTies.${tie.i}.source`)}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          )}
          <p className="mt-4 max-w-3xl text-sm italic leading-relaxed text-steel">
            {t("moneyDisclaimer")}
          </p>
        </section>

        {/* ── Listování spisy ───────────────────────────────── */}
        <nav className="mb-20 grid gap-px border border-ink bg-ink sm:grid-cols-2">
          {[
            { mp: prev, dir: "prev" as const, label: t("prevFile"), Icon: ArrowLeft, align: "text-left" },
            { mp: next, dir: "next" as const, label: t("nextFile"), Icon: ArrowRight, align: "text-right sm:justify-items-end" },
          ].map(({ mp: target, dir, label, Icon, align }) => (
            <Link
              key={dir}
              href={`/poslanec/${target.id}`}
              className={`grid gap-1 bg-paper p-5 transition-colors hover:bg-paper-strong ${align}`}
            >
              <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-widest text-steel">
                {dir === "prev" && <Icon className="h-3.5 w-3.5" />}
                {label}
                {dir === "next" && <Icon className="h-3.5 w-3.5" />}
              </span>
              <span className="text-lg font-black uppercase tracking-tight">
                {target.name} <span className="font-mono text-sm font-bold text-steel">· {f.dec(target.score)}</span>
              </span>
            </Link>
          ))}
        </nav>
      </div>
    </main>
  );
}
