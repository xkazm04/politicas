"use client";

/*
 * Spis poslance (/poslanec/<pspId>) — REÁLNÁ DATA ze znalostního grafu.
 * Hlavička se skóre indexu přispění a pořadím z 207; číslované oddíly
 * 01 Složky přispění (šest vážených složek) / 02 Nejbližší spojenci (co-votes)
 * / 03 Rebelie proti klubu (rebels-against) / 04 Výbory a komise
 * (influential-in). Citace u každého čísla. Žádná čtvrtletní řada / delta / trend
 * (jedno období, bez reálného podloží) — místo nich čestné „jedno období".
 */

import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ProfileData } from "./getProfileData";
import { useFormat } from "@/lib/i18n/useFormat";
import AnimatedScore from "@/features/shared/components/AnimatedScore";
import SectionHeading from "@/features/shared/components/SectionHeading";
import SourceNote from "@/features/shared/components/SourceNote";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { COMPONENT_FILL } from "@/features/civicscore/components/LeaderboardTable";

export default function ProfilePage({ data }: { data: ProfileData }) {
  const reduceMotion = useReducedMotion();
  const t = useTranslations("profile");
  const tcom = useTranslations("common");
  const f = useFormat();

  const { person, total, components, coVoters, rebellions, committees } = data;
  const [first, ...rest] = person.name.split(" ");
  const lastName = rest.join(" ");

  // Čestný „headline" z reálných props: vlajka nepřítomného manažera, jinak
  // nejsilnější složka. Nikdy vymyšlené číslo.
  const topComponent = [...components].sort(
    (x, y) => person.components[y.key] / y.weight - person.components[x.key] / x.weight,
  )[0];

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
              href="/zebricek"
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
            {t("rankOf", { rank: person.rank, total })} · {person.clubName}
            {person.region ? ` · ${person.region}` : ""}
          </SourceNote>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-8">
            <h1 className="text-6xl font-black uppercase leading-[0.92] tracking-tight sm:text-7xl">
              {first}
              <br />
              <span className="text-signal">{lastName}</span>
            </h1>
            <div className="text-right">
              <AnimatedScore
                value={person.score}
                format={f.dec}
                className="text-[7rem] font-black leading-[0.85] tracking-tighter sm:text-[8rem]"
              />
              <div className="mt-2 flex items-center justify-end gap-3">
                <span className="inline-flex items-center gap-1.5 font-mono text-sm font-bold">
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: person.clubColor }} />
                  {person.clubName}
                </span>
                <span className="font-mono text-xs uppercase tracking-widest text-steel">
                  {tcom("of100")}
                </span>
              </div>
              <SourceNote className="mt-1 !text-[10px]">{t("periodNote")}</SourceNote>
            </div>
          </div>
          <p className="mt-6 max-w-2xl border-l-4 border-signal pl-4 text-base italic leading-relaxed text-steel">
            {person.absenteeManagerLead ? t("absenteeFlag") : topComponent.label}
          </p>
        </motion.div>

        {/* ── 01 Složky přispění ────────────────────────────── */}
        <section className="pt-12">
          <SectionHeading
            index={1}
            title={t("componentsHeading")}
            aside={<SourceNote>{t("componentsAside")}</SourceNote>}
          />
          <div className="mt-8 grid gap-px border border-ink bg-ink sm:grid-cols-2 lg:grid-cols-3">
            {components.map((c) => {
              const fill = COMPONENT_FILL[c.key] ?? { color: undefined };
              const pts = person.components[c.key];
              return (
                <div key={c.key} className="bg-paper p-6">
                  <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-steel">
                    {c.label} × {c.weight}
                  </p>
                  <p className="mt-3 text-5xl font-black tabular-nums">
                    {f.dec(pts)}
                    <span className="ml-1 align-top text-lg font-bold text-steel">/{c.weight}</span>
                  </p>
                  <div className="mt-3 h-2 w-full bg-hairline">
                    <motion.div
                      className="h-full"
                      style={{ background: fill.color, opacity: fill.opacity }}
                      initial={{ width: 0 }}
                      whileInView={{ width: `${Math.min(100, (pts / c.weight) * 100)}%` }}
                      viewport={{ once: true }}
                      transition={reduceMotion ? { duration: 0 } : { duration: 0.6 }}
                    />
                  </div>
                  <SourceNote className="mt-3 !text-[10px]">
                    {tcom("sourcePrefix")} {c.source}
                  </SourceNote>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── 02 Nejbližší spojenci ─────────────────────────── */}
        <section className="mt-16 border-t-4 border-ink pt-10">
          <SectionHeading
            index={2}
            title={t("alliesHeading")}
            aside={<SourceNote>{t("alliesAside")}</SourceNote>}
          />
          <div className="mt-8 border-t-2 border-ink">
            {coVoters.map((cv) => (
              <div
                key={cv.pspId}
                className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b border-hairline px-2 py-3 transition-colors hover:bg-paper-strong"
              >
                <Link
                  href={`/poslanec/${cv.pspId}`}
                  className="group inline-flex min-w-0 items-center gap-1.5 text-[15px] font-black uppercase tracking-tight hover:text-signal"
                >
                  <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: cv.clubColor }} />
                  <span className="truncate">{cv.name}</span>
                  <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-steel">· {cv.clubAbbrev}</span>
                </Link>
                <span className="font-mono text-[11px] uppercase tracking-wider text-steel">
                  {t("sharedBallots", { count: cv.shared })}
                </span>
                <span className="w-16 text-right text-lg font-black tabular-nums text-signal">
                  {f.dec(cv.agreement * 100)}%
                </span>
              </div>
            ))}
          </div>
          <SourceNote className="mt-3 !text-[10px]">
            {t("agreementLabel")} · psp.cz · co_votes_with
          </SourceNote>
        </section>

        {/* ── 03 Rebelie proti klubu ────────────────────────── */}
        <section className="mt-16 border-t-4 border-ink pt-10">
          <SectionHeading
            index={3}
            title={t("rebellionsHeading")}
            aside={<SourceNote>{t("rebellionsAside")}</SourceNote>}
          />
          {rebellions.length === 0 ? (
            <div className="mt-8 border-2 border-dashed border-hairline p-8">
              <p className="text-[15px] leading-relaxed text-steel">{t("noRebellions")}</p>
            </div>
          ) : (
            <div className="mt-8 border-t-2 border-ink">
              {rebellions.map((r) => (
                <div
                  key={r.club}
                  className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b border-hairline px-2 py-4"
                >
                  <span className="text-lg font-black uppercase tracking-tight">{r.club}</span>
                  <span className="font-mono text-[11px] uppercase tracking-wider text-steel">
                    {f.int(r.rebelVotes)} / {f.int(r.eligibleVotes)}
                  </span>
                  <span className="w-16 text-right text-lg font-black tabular-nums text-signal">
                    {f.dec(r.rate * 100)}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── 04 Výbory a komise ────────────────────────────── */}
        <section className="mt-16 border-t-4 border-ink pt-10 pb-8">
          <SectionHeading
            index={4}
            title={t("committeesHeading")}
            aside={<SourceNote>{t("committeesAside")}</SourceNote>}
          />
          {committees.length === 0 ? (
            <div className="mt-8 border-2 border-dashed border-hairline p-8">
              <p className="text-[15px] leading-relaxed text-steel">{t("noCommittees")}</p>
            </div>
          ) : (
            <div className="mt-8 flex flex-wrap gap-3">
              {committees.map((cm) => (
                <div key={cm.abbrev} className="border-2 border-hairline px-4 py-3">
                  <p className="text-lg font-black uppercase tracking-tight">{cm.abbrev}</p>
                  <p className="mt-0.5 font-mono text-[11px] uppercase tracking-wider text-steel">
                    {cm.organType ?? "—"} · {cm.role}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Listování spisy ───────────────────────────────── */}
        <nav className="mb-20 grid gap-px border border-ink bg-ink sm:grid-cols-2">
          {[
            { pspId: data.prevPspId, dir: "prev" as const, label: t("prevFile"), Icon: ArrowLeft, align: "text-left" },
            { pspId: data.nextPspId, dir: "next" as const, label: t("nextFile"), Icon: ArrowRight, align: "text-right sm:justify-items-end" },
          ].map(({ pspId, dir, label, Icon, align }) => (
            <Link
              key={dir}
              href={`/poslanec/${pspId}`}
              className={`grid gap-1 bg-paper p-5 transition-colors hover:bg-paper-strong ${align}`}
            >
              <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-widest text-steel">
                {dir === "prev" && <Icon className="h-3.5 w-3.5" />}
                {label}
                {dir === "next" && <Icon className="h-3.5 w-3.5" />}
              </span>
            </Link>
          ))}
        </nav>
      </div>
    </main>
  );
}
