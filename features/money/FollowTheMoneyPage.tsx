"use client";

/*
 * FollowTheMoney — modul sítě peněz (/penize). Produkční domov archivního
 * rentgenového grafu entit, přeloženého do řeči Konstrukt: agregátní
 * dlaždice, interaktivní peněžní stopa, kniha doložených vazeb po
 * poslancích a metodika stopy (IČO join + lidská kontrola). Sytí pilíř
 * Integrita × 0.3 — a je to plocha, kam CivicScore odkazuje jako na
 * „ukaž mi důkazy" (politicas.md §3).
 */

import { motion } from "framer-motion";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { MODULES, MONEY_TIES } from "@/lib/civic/data";
import { useFormat } from "@/lib/i18n/useFormat";
import SectionHeading from "@/features/shared/components/SectionHeading";
import SectionRule from "@/features/shared/components/SectionRule";
import SourceNote from "@/features/shared/components/SourceNote";
import MoneyGraph from "./MoneyGraph";
import TiesLedger from "./components/TiesLedger";
import TrailMethod from "./components/TrailMethod";
import { compactCzk, type MoneyData } from "./moneyTypes";
import { reviewSummary } from "./reviewSummary";

const MODULE = MODULES.find((m) => m.key === "follow-the-money")!;
const PENDING = MONEY_TIES.filter((tie) => !tie.verified).length;

export default function FollowTheMoneyPage({ data }: { data?: MoneyData | null }) {
  const t = useTranslations("money");
  const tc = useTranslations("content");
  const tcom = useTranslations("common");
  const f = useFormat();
  const locale = useLocale();
  // Derived once and handed to every surface that speaks about the gate, so the lede
  // banner and the graph footer cannot disagree about the same 211 ties.
  const review = reviewSummary({
    verified: data?.stats.verifiedTies ?? 0,
    pending: data?.stats.pendingTies ?? 0,
    rejected: data?.stats.rejectedTies ?? 0,
  });

  // Real store data (kg money layer) when present; otherwise the labelled mock.
  // Headline tile is the number that IS a finding — how many MPs own/run a firm
  // that supplies the state (owner-operator = the real FollowTheMoney tie).
  // `contractCzkReachable` is demoted to an ordinary column: it is dominated by
  // stewards' own institutions (hospitals, waterworks) and the page's own
  // TieClassExplainer says that money must never be read as MP enrichment —
  // it must not be the number a reader sees first (UX audit 2026-07-27, #3).
  /** `note` is the second, qualifying line a tile may need — today only the lower-bound
   *  explainer, which must not be optional-by-omission again. */
  const STATS: Array<{ label: string; value: string; sub: string; source: string; note?: string | null }> = data
    ? [
        {
          // The count mixes two kinds of evidence: a class a person or an analysis pass
          // RECORDED on the edge, and one `classifyTie` guessed from a company name. Only
          // the first is an ARES fact, so the tile states the split instead of letting a
          // partly-guessed number sit under a bare registry citation.
          label: t("real.stats.ownerLabel"),
          value: f.int(data.stats.ownerOperatorMps),
          sub: t("real.stats.ownerSubSplit", {
            stored: f.int(data.stats.ownerOperatorMpsStoredClass),
            derived: f.int(data.stats.ownerOperatorMps - data.stats.ownerOperatorMpsStoredClass),
          }),
          source: t("real.stats.ownerSourceSplit"),
        },
        {
          label: t("real.stats.mpsLabel"),
          value: f.int(data.stats.mpsWithTies),
          sub: t("real.stats.mpsSub"),
          source: t("real.stats.mpsSource"),
        },
        {
          label: t("real.stats.companiesLabel"),
          value: f.int(data.stats.companiesLinked),
          sub: t("real.stats.companiesSub"),
          source: t("real.stats.companiesSource"),
        },
        {
          // The headline counts ONLY money the case's attribution rule permits reading as
          // reaching the politician's own firms (owner-operator + manager ties). Steward
          // money — contracts of public bodies where an MP holds a board seat — is the
          // institution's own activity and is shown separately, never folded in. Before
          // the batch-012 re-ingest the two were merged and the distinction was cosmetic;
          // on the full corpus stewards are ~91 % of the raw total, so merging them would
          // have made the tile say something false at nine times the volume.
          // Reads THE shared definition directly (reachableMoney.ts) — the
          // `contractCzk*` fields beside it are named views kept only for /dashboard.
          label: t("real.stats.reachableLabel"),
          value: data.stats.money.coverage.isFloor
            ? t("real.stats.reachableAtLeast", { value: compactCzk(data.stats.money.attributable.contractCzk, locale) })
            : compactCzk(data.stats.money.attributable.contractCzk, locale),
          sub: t("real.stats.reachableSubSplit", {
            steward: compactCzk(data.stats.money.steward.contractCzk, locale),
          }),
          // The "nejméně" prefix rendered while the string that EXPLAINS why it is a
          // floor sat unused in both catalogs — the reader saw a hedge with no reason.
          // (Measured on the live store the corpus is NOT capped, isFloor === false, so
          // this renders only if a future re-ingest reintroduces a per-company ceiling.)
          note: data.stats.money.coverage.isFloor
            ? t("real.stats.reachableSubCapped", {
                cap: data.stats.money.coverage.perCompanyCap ?? 0,
                companies: data.stats.money.coverage.companiesAtCap,
              })
            : null,
          source: data.stats.money.coverage.isFloor
            ? t("real.stats.reachableSourceCapped", { cap: data.stats.money.coverage.perCompanyCap ?? 0 })
            : t("real.stats.reachableSource"),
        },
      ]
    : [
        {
          label: tc(`modules.${MODULE.key}.metricLabel`),
          value: tc(`modules.${MODULE.key}.metricValue`),
          sub: t("stats.contracted.sub"),
          source: t("stats.contracted.source"),
        },
        {
          label: t("stats.sampleTies.label"),
          value: f.int(MONEY_TIES.length),
          sub: t("stats.sampleTies.sub"),
          source: t("stats.sampleTies.source"),
        },
        {
          label: t("stats.pendingReview.label"),
          value: f.int(PENDING),
          sub: t("stats.pendingReview.sub"),
          source: t("stats.pendingReview.source"),
        },
        {
          label: t("stats.joinKey.label"),
          value: "IČO",
          sub: t("stats.joinKey.sub"),
          source: t("stats.joinKey.source"),
        },
      ];

  return (
    <main className="min-h-screen overflow-x-clip bg-paper font-sans text-ink">
      {/* ── Lišta ───────────────────────────────────────────── */}
      <header className="border-b-4 border-ink">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs uppercase tracking-widest text-steel">/ followthemoney</span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/penize/kauzy"
              className="inline-flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-signal transition-colors hover:text-ink"
            >
              kauzy
            </Link>
            {/* One hop to the two surfaces that answer the questions this page raises:
                where a tie meets a vote (/penize/strety) and what the human gate has
                actually ruled (/dukazy). /penize used to link only kauzy + kontrola —
                the console being the one link a reader could not use. */}
            <Link
              href="/penize/strety"
              className="inline-flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-cobalt transition-colors hover:text-signal"
            >
              {t("real.links.conflicts")}
            </Link>
            <Link
              href="/dukazy"
              className="inline-flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-cobalt transition-colors hover:text-signal"
            >
              {t("real.links.gateLog")}
            </Link>
            <Link
              href="/penize/kontrola"
              className="inline-flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-cobalt transition-colors hover:text-signal"
            >
              kontrola vazeb
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6">
        {/* ── Titulní pás ───────────────────────────────────── */}
        <div className="py-10">
          <SourceNote tone="signal">{data ? t("real.eyebrow", { pass: data.pass }) : t("eyebrow")}</SourceNote>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 text-5xl font-black uppercase leading-[0.95] tracking-tight sm:text-6xl"
          >
            {t("title")}<span className="text-signal">.</span>
          </motion.h1>
          <div className="mt-4 max-w-xl">
            <SectionRule />
          </div>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-steel">
            {t("intro")}
          </p>
          {/* WHAT THE GATE HAS DECIDED, derived. This used to be one hard-coded sentence
              claiming every tie was still pending — false from the first confirmation the
              console records, on the page whose whole promise is that it never says more
              than the data does. */}
          {data && review.phase !== "empty" && (
            <div
              className={`mt-6 max-w-2xl border-l-4 px-4 py-3 ${review.pending > 0 ? "border-ochre bg-ochre/10" : "border-cobalt bg-cobalt/10"}`}
            >
              <p className="text-sm leading-relaxed text-ink">
                {review.phase === "all-pending"
                  ? t("real.review.allPending", { total: f.int(review.total) })
                  : review.phase === "all-decided"
                    ? t("real.review.allDecided", {
                        verified: f.int(review.verified),
                        rejected: f.int(review.rejected),
                        total: f.int(review.total),
                      })
                    : t("real.review.mixed", {
                        decided: f.int(review.decided),
                        verified: f.int(review.verified),
                        pending: f.int(review.pending),
                        total: f.int(review.total),
                      })}
              </p>
              <SourceNote className="mt-2 !text-[10px]">
                {tcom("sourcePrefix")} {t("real.review.source")}
              </SourceNote>
            </div>
          )}
        </div>

        {/* ── Agregátní dlaždice ────────────────────────────── */}
        <div className="grid gap-px border border-ink bg-ink sm:grid-cols-2 lg:grid-cols-4">
          {STATS.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="bg-paper p-6"
            >
              <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-steel">{s.label}</p>
              <p className="mt-3 text-4xl font-black tabular-nums tracking-tight">{s.value}</p>
              <p className="mt-2 text-sm text-steel">{s.sub}</p>
              {s.note ? <p className="mt-2 border-l-2 border-ochre pl-2 text-sm text-steel">{s.note}</p> : null}
              <SourceNote className="mt-3 !text-[10px]">{tcom("sourcePrefix")} {s.source}</SourceNote>
            </motion.div>
          ))}
        </div>

        {/* ── 01 Graf entit ─────────────────────────────────── */}
        <section id="graf" className="mt-16">
          <SectionHeading
            index={1}
            title={t("sections.graph.title")}
            aside={<SourceNote>{t("sections.graph.aside")}</SourceNote>}
          />
          <div className="mt-8">
            <MoneyGraph data={data?.graph ?? null} review={review} />
          </div>
          {/* The picture crowns ONE MP, so the caption states the rule that picked them —
              attributable reach only. Under the old key it was the raw contracts+subsidies
              sum across all classes, which most often nominated whoever sat on the board
              of the biggest hospital. */}
          <div className="mt-3">
            <SourceNote>
              {data?.graph
                ? t("real.graphSelection", {
                    name: data.graph.mp.name,
                    value: compactCzk(data.graph.selectedByCzk, locale),
                  })
                : t("graphCaption")}
            </SourceNote>
          </div>
        </section>

        {/* ── 02 Kniha vazeb ────────────────────────────────── */}
        <section id="kniha" className="mt-16 border-t-4 border-ink pt-10">
          <SectionHeading
            index={2}
            title={t("sections.ledger.title")}
            aside={<SourceNote>{t("sections.ledger.aside")}</SourceNote>}
          />
          <div className="mt-8">
            <TiesLedger data={data ?? null} />
          </div>
          <Link
            href="/penize/kauzy"
            className="group mt-8 flex items-center justify-between gap-4 border-l-4 border-signal bg-signal/5 px-5 py-4 transition-colors hover:bg-signal/10"
          >
            <span>
              <span className="block font-mono text-[11px] font-bold uppercase tracking-widest text-signal">
                {locale === "en" ? "kauzy / open leads" : "kauzy / rozpracované podněty"}
              </span>
              <span className="mt-1 block text-sm text-steel">
                {locale === "en"
                  ? "Two hand-researched dossiers, cited claim by claim — what the sources sustain and what they don't."
                  : "Dva ručně dořešené spisy, tvrzení po tvrzení citované — co zdroje dokládají a co ne."}
              </span>
            </span>
            <span className="shrink-0 font-mono text-xs font-bold uppercase tracking-wider text-signal">→</span>
          </Link>
        </section>

        {/* ── 03 Jak stopa vzniká ───────────────────────────── */}
        <section id="metodika" className="mt-16 border-t-4 border-ink pt-10 pb-20">
          <SectionHeading
            index={3}
            title={t("sections.method.title")}
            aside={<SourceNote>{t("sections.method.aside")}</SourceNote>}
          />
          <div className="mt-8">
            <TrailMethod />
          </div>
        </section>
      </div>
    </main>
  );
}
