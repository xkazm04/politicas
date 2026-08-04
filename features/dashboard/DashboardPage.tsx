"use client";

/*
 * Velín republiky — přehledová plocha aplikace. Vítěz 2. kola prototypu
 * (2026-07-26, dřív varianta „Konzole"), konsolidováno.
 *
 * Mentální model: PŘÍSTROJOVÝ PANEL. Graf státu je hlavní přístroj a hned
 * vedle něj běží pás provozu jako jeho telemetrie z TÉHOŽ datasetu: uzel
 * v grafu profiltruje provoz, zaměřovač v provozu připne uzel v grafu.
 * Ten výběr je JEDEN stav, drží ho URL (`?uzel=…`) a čte ho obojí — viz
 * ./useGraphSelection.ts. Náhled myší si plátno drží samo a ven ho nepouští.
 * Žebříček je pod tím jako odečet — účetní kniha sněmovny; její řádky vedou
 * do spisů, velín je rozcestník, spis je produkt.
 *
 * Pohled je celosněmovní a evidence-first: nejdřív „co se v grafu stalo",
 * teprve pak „kdo je kde v pořadí". Levou navigaci kreslí layout
 * (features/shell) — tahle plocha si vlastní chrome nedělá.
 */

import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, ArrowUpRight, Stamp } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { CHAMBER_STATS, CHAMBER_TREND, EVENTS, MPS, PILLARS, TREND_QUARTERS } from "@/lib/civic/data";
import { buildStateGraph, nodesForRefs } from "@/lib/civic/stateGraph";
import { useFormat } from "@/lib/i18n/useFormat";
import RankDelta from "@/features/shared/components/RankDelta";
import SectionHeading from "@/features/shared/components/SectionHeading";
import SectionRule from "@/features/shared/components/SectionRule";
import SourceNote from "@/features/shared/components/SourceNote";
import LiveDataNotice from "@/features/shared/components/LiveDataNotice";
import StatTile from "@/features/shared/components/StatTile";
import { compactCzk } from "@/features/money/moneyTypes";
import type { ReviewSummary } from "@/features/money/reviewSummary";
import { PILLAR_BG } from "@/features/landing/palette";
import type { DashboardData } from "./getDashboardData";
import ChamberChart from "./components/ChamberChart";
import GraphFeedPanel from "./components/GraphFeedPanel";
import StateGraphCanvas from "./components/StateGraphCanvas";
import { sliceExhibitId } from "./exhibit";
import { primaryNodeForEvent } from "./feedRelevance";
import { DASHBOARD_REVALIDATE_HOURS } from "./freshness";
import { useGraphText } from "./graphText";
import { useGraphSelection } from "./useGraphSelection";

/**
 * Dlaždice ze vzorku `lib/civic` — vykreslí se jen tehdy, když příslušná vrstva
 * grafu není k dispozici. Nese ILUSTRATIVNÍ variantu, takže se od spočítaného
 * čísla liší plochou a barvou číselníku, ne pouze textem pod ním.
 */
function MockStatTile({ statKey }: { statKey: string }) {
  const t = useTranslations("dashboard");
  const tc = useTranslations("content");
  return (
    <StatTile
      variant="illustrative"
      illustrativeTag={t("mockTag")}
      label={tc(`chamberStats.${statKey}.label`)}
      value={tc(`chamberStats.${statKey}.value`)}
      // Bez `sub`: štítek nahoře a citace dole už to říkají dvakrát, potřetí
      // by z upozornění byl šum.
      source={tc(`chamberStats.${statKey}.source`)}
    />
  );
}

export default function DashboardPage({ data }: { data: DashboardData | null }) {
  const t = useTranslations("dashboard");
  const tc = useTranslations("content");
  const tcom = useTranslations("common");
  const f = useFormat();
  const locale = useLocale();
  const reduceMotion = useReducedMotion();
  const text = useGraphText();

  // Reálný výřez z grafu, když je dostupný; jinak vzorek — tvar je týž, takže
  // renderer o rozdílu neví a `rule` níž říká ploše, kterou popisku sázet.
  const slice = data?.slice ?? null;
  const graph = useMemo(() => slice?.graph ?? buildStateGraph(), [slice]);

  // Výběr uzlu — jediný sdílený stav plochy, zrcadlený do URL. Ověřuje se proti
  // tomu, co plátno kreslí, takže sdílený odkaz na uzel z jiného výřezu
  // nevyrobí fantomový filtr.
  const drawnIds = useMemo(() => new Set(graph.nodes.map((n) => n.id)), [graph]);
  const { selected, select, clear } = useGraphSelection(drawnIds);

  // event.id → uzly, které řádek rozsvítí. Počítá se jednou; provoz i graf
  // pak čtou tutéž mapu, takže se filtr nemůže rozejít s obrázkem.
  const nodesByEvent = useMemo(
    () => new Map(EVENTS.map((e) => [e.id, nodesForRefs(e.refs, graph)])),
    [graph],
  );
  // event.id → uzel, o KTERÉM řádek je (pravidlo relevance, ne pořadí v poli).
  const primaryByEvent = useMemo(
    () => new Map(EVENTS.map((e) => [e.id, primaryNodeForEvent(e, graph)])),
    [graph],
  );

  const selectedNode = selected ? graph.nodes.find((n) => n.id === selected) : undefined;
  const selectedLabel = selectedNode ? text.node(selectedNode).label : null;

  // Adresa exponátu REÁLNÉHO výřezu (content-hash, viz ./exhibit.ts). Jen pro
  // reálná data — vzorkový graf citovatelný být nesmí, byl by to podepsaný mock.
  const exhibitHref = useMemo(
    () => (slice ? `/dashboard/exponat/${sliceExhibitId(slice)}` : null),
    [slice],
  );

  // Mock fallback trend — only rendered when the real store is unavailable.
  const chamberTrendData = useMemo(
    () => CHAMBER_TREND.map((v, i) => ({ q: TREND_QUARTERS[i], avg: v })),
    [],
  );
  // Real score-distribution histogram (207 real MPs) — replaces the fake
  // quarter-over-quarter trend, which has no real analog (contribution_score
  // is a single-term snapshot, not a time series).
  // null (ne prázdné pole) = graf není k dispozici → ChamberChart sáhne po
  // OZNAČENÉM vzorku. Prázdný histogram by se nakreslil jako „sněmovna bez
  // skóre", což je tvrzení, a navíc nepravdivé.
  const histogramData = useMemo(
    () => (data ? data.histogram.map((h) => ({ band: h.label, count: h.count })) : null),
    [data],
  );

  /*
   * Hlavička říká, CO O SOBĚ DATA TVRDÍ — ne jedno sebejisté číslo průchodu.
   * Dřív se tiskl `provenancePass` a datum z prvního uzlu, na který loader narazil;
   * `mixed` sněmovna (rozepsaný přepočet) i sněmovna zcela bez provenience se tak
   * obě vydávaly za jeden hotový průchod. Každý ze čtyř stavů má vlastní větu.
   */
  const p = data?.provenance ?? null;
  const provenanceNote = !data
    ? t("headerNoteUnavailable")
    : p === null || p.state === "absent"
      ? t("headerNoteAbsent")
      : p.state === "mixed"
        ? t("headerNoteMixed", {
            variants: f.int(p.distinctCount),
            covered: f.int(p.covered),
            total: f.int(p.total),
          })
        : p.computedAt
          ? t("headerNoteReal", { date: f.date(p.computedAt), pass: p.pass ?? "—" })
          : t("headerNoteNoDate", { pass: p.pass ?? "—" });

  /*
   * ČÁSTEČNÝ VÝPADEK SE ŘEKNE NAHLAS. Vrstvy degradují nezávisle (viz loader), ale
   * `LiveDataNotice` se dřív vykreslil jen při úplném selhání — a když spadla jen
   * peněžní vrstva, jediným signálem byl štítek u dlaždice, který se čte jako
   * redakční volba, ne jako výpadek databáze. Seznam se skládá z toho, co je
   * skutečně null; nic se nedopočítává.
   */
  const darkLayers = data
    ? ([
        data.money === null ? "money" : null,
        data.laws === null ? "laws" : null,
        data.slice === null ? "slice" : null,
      ].filter(Boolean) as string[])
    : [];

  /*
   * CO LIDSKÁ BRÁNA SKUTEČNĚ ROZHODLA. Věta pod peněžní dlaždicí byla LITERÁL
   * („všech {pending} z {total} vazeb čeká na kontrolu") — pravdivý jen dokud
   * konzole neuměla zapisovat. Fázi odvozuje TÁŽ čistá funkce, kterou publikuje
   * /penize (`features/money/reviewSummary.ts`), takže se titulní strana nemůže
   * s modulem rozejít. Populace záměrně není `totalTies`; viz hlavička toho modulu.
   */
  const REVIEW_KEY = {
    "all-pending": "allPending",
    mixed: "mixed",
    "all-decided": "allDecided",
    empty: "empty",
  } as const;
  const moneyReviewNote = (r: ReviewSummary) =>
    t(`realStats.moneyReview.${REVIEW_KEY[r.phase]}`, {
      total: f.int(r.total),
      decided: f.int(r.decided),
      verified: f.int(r.verified),
      rejected: f.int(r.rejected),
      pending: f.int(r.pending),
    });

  return (
    <main className="min-h-screen bg-paper font-sans text-ink">
      <header className="border-b-4 border-ink">
        <div className="flex items-center justify-between gap-4 px-6 py-3.5">
          <span className="font-mono text-xs uppercase tracking-widest text-steel">
            politicas / {t("headerTag")}
          </span>
          {/* Datum přepočtu je provenience z grafu (`contribution_provenance`),
              ne literál v překladech. Když ho uzly nenesou, řekneme to —
              vymyšlené datum je vymyšlené číslo. */}
          <div className="hidden sm:block sm:text-right">
            <SourceNote>{provenanceNote}</SourceNote>
            {/* Data a kód se rozešly ve VZORCI — to není chyba stránky, ale fakt o
                žebříčku, který se musí říct nahlas (přesně případ 2026-07-29 → 08-04).
                Netiskne se, když provenience chybí: prázdno netvrdí nic. */}
            {data && !data.provenance.formulaMatch && data.provenance.state !== "absent" && (
              <SourceNote tone="signal" className="mt-0.5">
                {t("headerNoteFormulaMismatch", {
                  stored: data.provenance.storedRef,
                  declared: data.provenance.declaredRef,
                })}
              </SourceNote>
            )}
            {/* Kdy tenhle výtisk vznikl a jak zastaralý smí být. Bez toho je
                staticky předgenerovaná stránka číslo bez data platnosti — a to
                je stejný problém jako číslo bez citace. */}
            {data && (
              <SourceNote className="mt-0.5">
                {t("freshness", {
                  built: f.date(data.builtOn),
                  hours: f.int(DASHBOARD_REVALIDATE_HOURS),
                })}
              </SourceNote>
            )}
          </div>
        </div>
      </header>

      <div className="px-6 pb-16">
        <div className="py-8">
          <motion.h1
            initial={reduceMotion ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl font-black uppercase leading-[0.95] tracking-tight sm:text-5xl"
          >
            {t("title")}
            <span className="text-signal">.</span>
          </motion.h1>
          <div className="mt-3 max-w-md">
            <SectionRule />
          </div>
          <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-steel">{t("lead")}</p>
        </div>

        {/* Když graf není k dispozici, plocha to řekne nahlas a jednou —
            samotný štítek „ilustrativní ukázka" u dlaždice čte jako redakční
            volba, ne jako výpadek databáze. */}
        {!data && (
          <div className="mb-6">
            <LiveDataNotice
              title={t("unavailable.title")}
              body={t("unavailable.body")}
              source={t("unavailable.source")}
            />
          </div>
        )}

        {/* Živý graf JE, ale některá vrstva z něj ne — pojmenuje se která. */}
        {data && darkLayers.length > 0 && (
          <div className="mb-6">
            <LiveDataNotice
              title={t("partial.title")}
              body={t("partial.body", {
                layers: darkLayers.map((k) => t(`partial.layers.${k}`)).join(" · "),
              })}
              source={t("partial.source")}
            />
          </div>
        )}

        {/* Odečty sněmovny — pás nad přístrojem, ne samostatná sekce.
            Všechna čtyři čísla mají reálný protějšek v grafu a berou se z
            loaderu, který je vlastní (kontribuční index, /penize, /zakony) —
            velín je nepočítá znovu, takže se s modulem nemůže rozejít. Vrstva,
            která zrovna není k dispozici, spadne na ILUSTRATIVNÍ dlaždici a ta
            je jiná už na první pohled (okrová hrana, jiná plocha, šedý číselník),
            ne jenom textem pod číslem. */}
        <div className="grid gap-px border border-ink bg-ink sm:grid-cols-2 xl:grid-cols-4">
          {data ? (
            <>
              <StatTile
                label={t("realStats.avgLabel")}
                value={f.dec(data.summary.avg)}
                sub={t("realStats.avgSub", {
                  median: f.dec(data.summary.median),
                  sigma: f.dec(data.summary.sigma),
                  count: data.summary.count,
                })}
                source={
                  <>
                    {tcom("sourcePrefix")} {t("realStats.avgSource")} ·{" "}
                    {/* Index je odvozené číslo a jeho vzorec je veřejný — /metodika
                        ho tiskne z importů, ne z literálů. Bez tohohle odkazu bylo
                        nejvýraznější číslo titulní strany bez metodiky na dosah. */}
                    <Link
                      href="/metodika"
                      className="font-bold text-cobalt underline decoration-hairline underline-offset-2 transition-colors hover:text-signal"
                    >
                      {t("realStats.methodologyLink")}
                    </Link>
                  </>
                }
              />
              <StatTile
                label={t("realStats.attendanceLabel")}
                value={`${f.dec(data.attendanceAvgPct)} %`}
                sub={t("realStats.attendanceSub", { count: f.int(data.summary.count) })}
                source={`${tcom("sourcePrefix")} ${t("realStats.attendanceSource")}`}
              />
              {data.money ? (
                <StatTile
                  label={t("realStats.moneyLabel")}
                  // Strop v ingesci znamená DOLNÍ MEZ — /penize to říká „nejméně" a
                  // velín tiskl totéž číslo holé, tedy s vyšší jistotou než modul,
                  // ze kterého ho bere.
                  value={
                    data.money.isFloor
                      ? t("realStats.moneyValueFloor", {
                          czk: compactCzk(data.money.attributableCzk, locale),
                        })
                      : compactCzk(data.money.attributableCzk, locale)
                  }
                  sub={
                    <>
                      {t("realStats.moneySub", {
                        steward: compactCzk(data.money.stewardCzk, locale),
                      })}
                      {data.money.isFloor && (
                        <span className="mt-1 block">
                          {t("realStats.moneyFloorNote", {
                            cap: f.int(data.money.perCompanyCap ?? 0),
                            companies: f.int(data.money.companiesAtCap),
                          })}
                        </span>
                      )}
                    </>
                  }
                  source={
                    <>
                      {tcom("sourcePrefix")}{" "}
                      {t("realStats.moneySource", { pass: data.money.pass })} ·{" "}
                      {moneyReviewNote(data.money.review)}
                    </>
                  }
                />
              ) : (
                <MockStatTile statKey="money" />
              )}
              {data.laws ? (
                <StatTile
                  label={t("realStats.lawsLabel")}
                  value={f.int(data.laws.amends)}
                  sub={t("realStats.lawsSub", {
                    bills: f.int(data.laws.bills),
                    laws: f.int(data.laws.laws),
                  })}
                  source={`${tcom("sourcePrefix")} ${t("realStats.lawsSource", {
                    pass: data.laws.pass ?? "—",
                    undercount: f.int(data.laws.censusUndercount),
                  })}`}
                />
              ) : (
                <MockStatTile statKey="laws" />
              )}
            </>
          ) : (
            CHAMBER_STATS.map((s) => <MockStatTile key={s.key} statKey={s.key} />)
          )}
        </div>

        {/* ── /01 Graf + provoz ─────────────────────────────────── */}
        <section id="graf" className="mt-12">
          <SectionHeading
            index={1}
            title={t("graph.title")}
            aside={
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <SourceNote>{slice ? t("graph.realCaption") : t("graph.caption")}</SourceNote>
                {/* Velín ukazuje výřez; celý graf se prochází na vlastní ploše. */}
                <Link
                  href="/graf"
                  className="inline-flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-cobalt transition-colors hover:text-signal"
                >
                  {t("graph.openPlayground")} <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
                {/* Exponát jen pro reálný výřez — vzorek se citovat nesmí.
                    Copy česky přímo tady (vzor DataUnavailable): messages/*.json
                    je sdílený soubor a tahle plocha do něj nezapisuje. */}
                {exhibitHref && (
                  <Link
                    href={exhibitHref}
                    title="Exponát — citovatelný otisk tohoto výřezu"
                    className="inline-flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-cobalt transition-colors hover:text-signal"
                  >
                    <Stamp className="h-3.5 w-3.5" aria-hidden /> Exponát
                  </Link>
                )}
              </div>
            }
          />
          {/* Výřez je reálný, provoz zatím ne — a řekne se to zvlášť za každý
              z nich, ne jednou za celou sekci. */}
          {!slice && (
            <SourceNote tone="signal" className="mt-3">
              {t("mockBadge")}
            </SourceNote>
          )}
          <div className="mt-6 grid items-stretch gap-6 xl:grid-cols-12">
            <div className="min-w-0 xl:col-span-7">
              <StateGraphCanvas
                graph={graph}
                rule={slice?.rule ?? null}
                selected={selected}
                onSelect={select}
              />
              {!slice && <SourceNote className="mt-2">{t("graph.sliceNote")}</SourceNote>}
              {/* Jednořádkové vysvětlení afordance „Exponát" — nástroj, který
                  nikdo nenajde, je nefunkční nástroj. */}
              {slice && (
                <SourceNote className="mt-2">
                  exponát = trvalý citovatelný otisk tohoto výřezu — adresa nese content-hash,
                  obsah se z registrů odvozuje znovu; otisk má i každý řádek provozu (razítko u
                  řádku)
                </SourceNote>
              )}
            </div>
            <div id="provoz" className="min-w-0 xl:col-span-5">
              <GraphFeedPanel
                events={EVENTS}
                nodesByEvent={nodesByEvent}
                primaryByEvent={primaryByEvent}
                ledger={data?.feed ?? null}
                selected={selected}
                selectedLabel={selectedLabel}
                onPick={select}
                onClear={clear}
              />
            </div>
          </div>
        </section>

        {/* ── /02 Žebříček ──────────────────────────────────────── */}
        <section id="zebricek" className="mt-14 border-t-4 border-ink pt-8">
          <SectionHeading
            index={2}
            title={data ? t("realRanking.title") : t("rankingSectionTitle")}
            aside={
              <Link
                href="/zebricek"
                className="inline-flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-cobalt transition-colors hover:text-signal"
              >
                {data ? t("allMpsLink", { count: data.summary.count }) : t("allMpsLinkFallback")}{" "}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            }
          />
          <div className="mt-6 grid gap-10 lg:grid-cols-12">
            <div className="min-w-0 border-t-2 border-ink lg:col-span-8">
              {data ? (
                // Real top-5 by contribution_score, from the same materialized
                // graph as /zebricek — real pspId links, no dead ends.
                data.top.map((m) => (
                  <Link
                    key={m.pspId}
                    href={`/poslanec/${m.pspId}`}
                    className="group grid grid-cols-[2.5rem_1fr_auto] items-center gap-4 border-b border-hairline px-2 py-3.5 transition-colors hover:bg-paper-strong"
                  >
                    <span className={`font-mono text-xl font-bold ${m.rank <= 3 ? "text-signal" : "text-steel"}`}>
                      {m.rank}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-base font-black uppercase tracking-tight">
                        {m.name}
                      </span>
                      <span className="mt-0.5 flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-steel">
                        <span className="inline-block h-2 w-2 rounded-full" style={{ background: m.clubColor }} />
                        {m.clubName} {m.region ? `· ${m.region}` : ""}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="text-xl font-black tabular-nums">{f.dec(m.score)}</span>
                      <ArrowUpRight className="h-4 w-4 text-signal transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </span>
                  </Link>
                ))
              ) : (
                MPS.map((m) => (
                  <Link
                    key={m.id}
                    href="/zebricek"
                    className="group grid grid-cols-[2.5rem_1fr_auto_auto_auto] items-center gap-4 border-b border-hairline px-2 py-3.5 transition-colors hover:bg-paper-strong"
                  >
                    <span className={`font-mono text-xl font-bold ${m.rank <= 3 ? "text-signal" : "text-steel"}`}>
                      {m.rank}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-base font-black uppercase tracking-tight">
                        {m.name}
                      </span>
                      <span className="mt-0.5 flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-steel">
                        <span
                          className="inline-block h-2 w-2 rounded-full"
                          style={{ background: m.partyColor }}
                        />
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
                ))
              )}
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
                {data ? (
                  <>
                    <SourceNote>
                      {t("realRanking.footnote", { count: data.summary.count })}
                    </SourceNote>
                    <Link
                      href="/metodika"
                      className="font-mono text-[11px] font-bold uppercase tracking-wider text-cobalt transition-colors hover:text-signal"
                    >
                      {t("realStats.methodologyLink")}
                    </Link>
                  </>
                ) : (
                  <>
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
                  </>
                )}
              </div>
            </div>

            <div className="min-w-0 lg:col-span-4">
              {/* Memoizovaný podstrom — viz components/ChamberChart.tsx. */}
              <ChamberChart
                histogram={histogramData}
                mockTrend={chamberTrendData}
                count={data?.summary.count ?? 0}
                reduceMotion={Boolean(reduceMotion)}
              />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
