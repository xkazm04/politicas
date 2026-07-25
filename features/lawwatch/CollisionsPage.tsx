"use client";

/*
 * "Kolize tisků" (/zakony/kolize) — Case ③ drafting-collision surface.
 *
 * Two or more simultaneously-pending sněmovní tisky sometimes independently novelize the
 * SAME § of the SAME statute in incompatible or order-sensitive ways — a normal hazard of
 * a legislature where bills are drafted in parallel, not evidence of anything improper.
 * This page renders the case loop's 4-batch close-read findings, grouped by (statute, §)
 * rather than by bill-pair, since several are genuine N-way clusters.
 *
 * Framing discipline (law-verdict gate, non-negotiable): these are DRAFTING-COORDINATION
 * findings, never verdicts. "Confirmed" here means "grep-verified same-text or same-slot
 * clash", NOT "confirmed wrongdoing" — nobody did anything wrong by drafting a bill; the
 * finding is that the legislature has two incompatible drafts in flight on the same clause.
 * "Incidental" pairs (same §-number, different statute — a data artifact) are excluded
 * entirely; they are noise, not findings.
 */

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import SectionHeading from "@/features/shared/components/SectionHeading";
import SectionRule from "@/features/shared/components/SectionRule";
import SourceNote from "@/features/shared/components/SourceNote";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import type { CollisionClassification, CollisionClusterView, CollisionData, CollisionPairView } from "./getCollisionData";

const CLASS_CZ: Record<CollisionClassification, string> = {
  "confirmed-collision": "potvrzená kolize textu",
  "coordination-risk": "koordinační riziko",
};

/** confirmed = signal (nejsilnější příznak, stejně jako „možný střet“ jinde v appce);
 * coordination-risk = ochre (měkčí příznak, stejně jako §-diff blok). Žádné nové barvy. */
const CLASS_TONE: Record<CollisionClassification, { border: string; bg: string; text: string }> = {
  "confirmed-collision": { border: "border-signal", bg: "bg-signal/5", text: "text-signal" },
  "coordination-risk": { border: "border-ochre", bg: "bg-ochre/5", text: "text-ochre" },
};

/** psp.cz historie tisku (PSP10 = o=10) — jediný stabilní veřejný odkaz na tisk. */
const pspBillUrl = (cislo: number) => `https://www.psp.cz/sqw/historie.sqw?o=10&t=${cislo}`;

export default function CollisionsPage({ data }: { data: CollisionData | null }) {
  return (
    <main className="min-h-screen overflow-x-clip bg-paper font-sans text-ink">
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
            <span className="font-mono text-xs uppercase tracking-widest text-steel">/ kolize tisků</span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/zakony"
              className="inline-flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-cobalt transition-colors hover:text-signal"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> zpět na zákony
            </Link>
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6">
        <div className="py-10">
          <SourceNote tone="signal">case ③ · legislativní forenzika</SourceNote>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 text-5xl font-black uppercase leading-[0.95] tracking-tight sm:text-6xl"
          >
            Kolize tisků<span className="text-signal">.</span>
          </motion.h1>
          <div className="mt-4 max-w-xl">
            <SectionRule />
          </div>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-steel">
            {data
              ? "Dva nebo více souběžně projednávaných tisků někdy nezávisle novelizují stejný § téhož zákona neslučitelným nebo na pořadí citlivým způsobem. To je běžné riziko souběžně psaných zákonů, ne důkaz pochybení — jde o nález legislativního procesu, ne o etický nález."
              : "Data pro tuto sekci zatím nejsou k dispozici — buď graf, nebo výstupy close-readu case ③ nejsou dostupné."}
          </p>
        </div>

        {data ? <RealCollisions data={data} /> : <EmptyState />}
      </div>
    </main>
  );
}

function EmptyState() {
  return (
    <div className="mb-20 border-2 border-dashed border-hairline bg-paper-strong px-6 py-10 text-center">
      <p className="text-sm text-steel">
        Graf nebo výstupy close-readu (docs/data-analysis/case-law/payloads/collision-close-reads*.json)
        nejsou dostupné. Politicas nezobrazuje smyšlená data.
      </p>
    </div>
  );
}

function RealCollisions({ data }: { data: CollisionData }) {
  return (
    <>
      {/* Statistický pás */}
      <div className="grid grid-cols-2 gap-px border-2 border-ink bg-ink sm:grid-cols-4">
        {[
          { v: data.confirmedPairCount, l: "potvrzených dvojic" },
          { v: data.coordinationRiskPairCount, l: "koordinačních rizik" },
          { v: data.clusterCount, l: "shluků podle § " },
          { v: data.nWayClusterCount, l: "shluků 3+ tisků" },
        ].map((s) => (
          <div key={s.l} className="bg-paper px-4 py-4">
            <div className="text-3xl font-black tabular-nums">{s.v}</div>
            <div className="mt-0.5 font-mono text-[11px] uppercase tracking-wider text-steel">{s.l}</div>
          </div>
        ))}
      </div>
      <div className="mt-2">
        <SourceNote>
          {data.batchesRun} dávky close-readu · deterministická § — partitioned pre-check (v2) + LLM close-read,
          potvrzené dvojice ověřeny grepem v cached textu z psp.cz (P49) · „nahodilé&rdquo; dvojice (stejné číslo §,
          jiný zákon) vyřazeny — nejsou zde zobrazeny
        </SourceNote>
      </div>
      {data.postRegenPendingCount > 0 && (
        <div className="mt-2 border-2 border-dashed border-ochre bg-ochre/5 px-4 py-3">
          <p className="font-mono text-[11px] uppercase tracking-wider text-ochre">
            {data.postRegenPendingCount}× nález z dávky 5 pochází z přeregenerované topologie (150 → 567 hran „amends&rdquo;), kterou
            orchestrátor zatím neschválil pro živý graf — viz{" "}
            <span className="font-bold">docs/data-analysis/case-law/handoff.md</span>. Označeno „dávka 5&rdquo; u
            každé takové dvojice níže; nic zde citované není smyšlené, jde jen o to, ŽE byla dvojice nalezena přes
            kandidátní univerzum, které live graf ještě nemá.
          </p>
        </div>
      )}

      <section className="mt-12 pb-20">
        <SectionHeading
          index={1}
          title="Shluky podle zákona a §"
          aside={
            <SourceNote>
              {data.clusterCount} shluků · {data.confirmedPairCount + data.coordinationRiskPairCount} dvojic tisků
            </SourceNote>
          }
        />
        <div className="mt-8 space-y-8">
          {data.clusters.map((c) => (
            <ClusterCard key={c.key} cluster={c} />
          ))}
        </div>
        <p className="mt-10 max-w-3xl border-t-2 border-ink pt-4 text-sm italic leading-relaxed text-steel">
          Shluk = jeden § jednoho zákona, ne dvojice tisků — několik nálezů je skutečně vícecestných (např. §35c
          zákona 586/1992 nyní spojuje 4 tisky). Klasifikace je odvozený nález (gate „law-verdict&rdquo;, metoda:
          deterministická partitioned předfiltrace + LLM close-read s grep ověřením), nikdy prokázané pochybení —
          jde o riziko legislativní koordinace mezi souběžně podanými návrhy, ne o etický nález.
        </p>
      </section>
    </>
  );
}

function ClusterCard({ cluster }: { cluster: CollisionClusterView }) {
  const reduceMotion = useReducedMotion();
  const tone = CLASS_TONE[cluster.classification];
  const nWay = cluster.bills.length >= 3;

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.25 }}
      className={`border-2 ${tone.border}`}
    >
      <div className={`flex flex-wrap items-center justify-between gap-3 border-b-2 ${tone.border} ${tone.bg} px-4 py-3`}>
        <div className="flex flex-wrap items-baseline gap-3">
          <span className="font-mono text-sm font-bold text-signal">č. {cluster.lawRef} Sb.</span>
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-ink">§ {cluster.paragraph}</span>
          {nWay && (
            <span className="border border-ink bg-ink px-1.5 py-0.5 font-mono text-[10px] font-black uppercase tracking-wider text-paper">
              {cluster.bills.length}× tisk
            </span>
          )}
        </div>
        <SourceNote tone="steel" className={`!${tone.text}`}>
          {CLASS_CZ[cluster.classification]}
        </SourceNote>
      </div>

      <div className="px-4 py-4">
        {cluster.lawTitle && <p className="text-sm leading-snug text-steel">{cluster.lawTitle}</p>}

        {/* dotčené tisky — dosje na /zakony/[cislo] (restrukturalizace), historie na psp.cz */}
        <div className="mt-2 flex flex-wrap gap-2">
          {cluster.bills.map((b) => (
            <span
              key={b.cislo}
              className="group inline-flex max-w-full items-center gap-1.5 border-2 border-hairline px-3 py-1.5 transition-colors hover:border-ink hover:bg-paper-strong"
              title={b.title ?? undefined}
            >
              <Link href={`/zakony/${b.cislo}`} className="whitespace-nowrap font-mono text-xs font-bold text-signal hover:text-cobalt">
                sn. tisk {b.cislo}
              </Link>
              {b.title && <span className="truncate text-[13px] font-medium">{b.title}</span>}
              <a
                href={pspBillUrl(b.cislo)}
                target="_blank"
                rel="noreferrer"
                title="historie na psp.cz"
                className="shrink-0 text-steel opacity-0 transition-opacity group-hover:opacity-100 hover:text-signal"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            </span>
          ))}
        </div>

        {/* dvojice v rámci shluku */}
        <div className="mt-5 space-y-3">
          {cluster.pairs.map((p) => (
            <PairCard key={p.pairId} pair={p} />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function billLabel(id: number) {
  return `tisk ${id}`;
}

function PairCard({ pair }: { pair: CollisionPairView }) {
  const [open, setOpen] = useState(false);
  const tone = CLASS_TONE[pair.classification];
  const hasEvidence = pair.evidence.billAExcerpt || pair.evidence.billBExcerpt;

  return (
    <div className={`border-l-4 ${tone.border} bg-paper-strong/60 pl-3`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2 py-2">
        <span className="text-sm font-bold">
          {billLabel(pair.billA)} × {billLabel(pair.billB)}
          <span className="ml-2 font-mono text-[11px] font-normal uppercase tracking-wider text-steel">
            § {pair.sharedParagraph}
          </span>
        </span>
        <span className="flex items-center gap-2">
          {pair.postRegenTopology && (
            <span
              className="border border-ochre px-1 py-0.5 font-mono text-[9px] font-black uppercase tracking-wider text-ochre"
              title="Nalezeno přes přeregenerovanou topologii, ještě neschválenou orchestrátorem pro živý graf"
            >
              dávka 5 · post-regen
            </span>
          )}
          <span className={`font-mono text-[10px] font-black uppercase tracking-wider ${tone.text}`}>
            {CLASS_CZ[pair.classification]}
          </span>
        </span>
      </div>

      {pair.reasoning && (
        <p className={`pb-2 text-[13px] leading-relaxed text-steel ${open ? "" : "line-clamp-2"}`}>{pair.reasoning}</p>
      )}

      {open && hasEvidence && (
        <div className="mb-3 grid gap-2 sm:grid-cols-2">
          {pair.evidence.billAExcerpt && (
            <div className="border-l-4 border-hairline bg-paper p-3">
              <SourceNote className="!text-[10px]">tisk {pair.billA} — doslovná citace</SourceNote>
              <p className="mt-1.5 text-[12px] leading-relaxed text-steel">{pair.evidence.billAExcerpt}</p>
            </div>
          )}
          {pair.evidence.billBExcerpt && (
            <div className="border-l-4 border-hairline bg-paper p-3">
              <SourceNote className="!text-[10px]">tisk {pair.billB} — doslovná citace</SourceNote>
              <p className="mt-1.5 text-[12px] leading-relaxed text-steel">{pair.evidence.billBExcerpt}</p>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 pb-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="font-mono text-[11px] font-bold uppercase tracking-wider text-cobalt transition-colors hover:text-signal"
        >
          {open ? "méně —" : hasEvidence ? "citace a plné odůvodnění +" : "plné odůvodnění +"}
        </button>
        <SourceNote className="!text-[10px]">
          dávka {pair.sourceBatch} · {pair.sourceMethod}
        </SourceNote>
      </div>
    </div>
  );
}
