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
import dynamic from "next/dynamic";
import Link from "next/link";
import { CHAMBER_TREND, TREND_QUARTERS } from "@/lib/civic/data";
import { buildStateGraph } from "@/lib/civic/stateGraph";
import { useFormat } from "@/lib/i18n/useFormat";
import SectionHeading from "@/features/shared/components/SectionHeading";
import SectionRule from "@/features/shared/components/SectionRule";
import SourceNote from "@/features/shared/components/SourceNote";
import LiveDataNotice from "@/features/shared/components/LiveDataNotice";
import StatTile from "@/features/shared/components/StatTile";
import { compactCzk } from "@/features/money/moneyTypes";
import type { ReviewSummary } from "@/features/money/reviewSummary";
import LowScoreReasonChip from "@/features/civicscore/components/LowScoreReasonChip";
import RapporteurBadge from "@/features/civicscore/components/RapporteurBadge";
import WorkhorseBadge from "@/features/civicscore/components/WorkhorseBadge";
import type { DashboardWire } from "./publicWire";
import ChamberChart from "./components/ChamberChart";
import GraphFeedPanel from "./components/GraphFeedPanel";
import StateGraphCanvas from "./components/StateGraphCanvas";
import { sliceExhibitId } from "./exhibit";
import { DASHBOARD_REVALIDATE_HOURS } from "./freshness";
import { useGraphText } from "./graphText";
import { useGraphSelection } from "./useGraphSelection";

/*
 * VZOREK SE NAČÍTÁ, AŽ KDYŽ SE KRESLÍ (vzor /penize, round 4).
 *
 * Tyhle čtyři rendery existují pro výpadek grafu — na šťastné cestě z nich
 * nevznikne ani jeden pixel, a přesto se vozily v balíku a jejich vstupy se
 * počítaly při každém renderu. `next/dynamic` BEZ `ssr:false`: fallback se
 * pořád vykresluje na serveru, jen se nedostane do parse cesty šťastného
 * případu. (Poctivá mez: sdílený chunk `lib/civic/data` zůstává eager tak jako
 * tak — `features/shell/sidebarParts.tsx` z něj čte `MODULES` na každé routě.)
 */
const MockStatTile = dynamic(() => import("./components/MockStatTile"));
const MockStatTiles = dynamic(() => import("./components/MockStatTiles"));
const MockRankingLedger = dynamic(() => import("./components/MockRankingLedger"));
const MockGraphFeedPanel = dynamic(() => import("./components/MockGraphFeedPanel"));

export default function DashboardPage({ data }: { data: DashboardWire | null }) {
  const t = useTranslations("dashboard");
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

  const selectedNode = selected ? graph.nodes.find((n) => n.id === selected) : undefined;
  const selectedLabel = selectedNode ? text.node(selectedNode).label : null;

  // Adresa exponátu REÁLNÉHO výřezu (content-hash, viz ./exhibit.ts). Jen pro
  // reálná data — vzorkový graf citovatelný být nesmí, byl by to podepsaný mock.
  const exhibitHref = useMemo(
    () => (slice ? `/dashboard/exponat/${sliceExhibitId(slice)}` : null),
    [slice],
  );

  // Mock fallback trend — only rendered when the real store is unavailable, and
  // since 2026-08-05 only COMPUTED then: `null` on the happy path, where the
  // histogram below wins and this array was built for nobody.
  const chamberTrendData = useMemo(
    () => (data ? null : CHAMBER_TREND.map((v, i) => ({ q: TREND_QUARTERS[i], avg: v }))),
    [data],
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
   *
   * ČTVRTÝ KANÁL: smluvní vrstva knihy faktů. Ta se nedegraduje na null — kniha
   * se složí i bez ní, jen z rejstříkových rolí a kroků tisků, a vypadá zdravě.
   * Proto se čte STAV ČTENÍ (`factContracts.state`), ne přítomnost dat: „žádná
   * smlouva" a „smlouvy se nepodařilo přečíst" jsou dvě různá tvrzení a jenom
   * jedno z nich je o výřezu.
   */
  const darkLayers = data
    ? ([
        data.money === null ? "money" : null,
        data.laws === null ? "laws" : null,
        data.slice === null ? "slice" : null,
        data.factContracts?.state === "failed" ? "contracts" : null,
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
        {/* Na úzké ploše se hlavička SKLÁDÁ POD SEBE, nemizí. Provenience,
            rozpor vzorce i mez čerstvosti tu dřív visely na `hidden sm:block`,
            takže čtenář na telefonu viděl číslo bez data platnosti a bez věty
            o tom, čím bylo spočítané. Žádná informace nesmí být jen pro desktop. */}
        <div className="flex flex-col gap-2 px-6 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <span className="font-mono text-xs uppercase tracking-widest text-steel">
            politicas / {t("headerTag")}
          </span>
          {/* Datum přepočtu je provenience z grafu (`contribution_provenance`),
              ne literál v překladech. Když ho uzly nenesou, řekneme to —
              vymyšlené datum je vymyšlené číslo. */}
          <div className="min-w-0 sm:text-right">
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
              {/* DOCHÁZKA JE OMLUVY, ne jmenovitá hlasování. Číslo je
                  1 − `absence_rate`, a `absence_rate` = omluvené dny / jednací dny
                  (lib/analysis/contribution.ts) — týž vstup, jaký boduje složka
                  „Docházka" v indexu, a proto i táž citace jako v componentDefs.
                  Poslanec bez údaje do průměru NEVSTUPUJE; kolik jich průměr
                  nese, se tiskne, jakmile je jich míň než celá sněmovna. */}
              <StatTile
                label={t("realStats.attendanceLabel")}
                value={
                  data.attendance.avgPct === null
                    ? "—"
                    : `${f.dec(data.attendance.avgPct)} %`
                }
                sub={
                  data.attendance.avgPct === null
                    ? t("realStats.attendanceNone", { total: f.int(data.attendance.total) })
                    : data.attendance.counted < data.attendance.total
                      ? t("realStats.attendanceSubPartial", {
                          counted: f.int(data.attendance.counted),
                          total: f.int(data.attendance.total),
                        })
                      : t("realStats.attendanceSub", { count: f.int(data.attendance.counted) })
                }
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
                      {moneyReviewNote(data.money.review)} ·{" "}
                      {/* Dlaždice shrnuje modul, který má vlastní plochu —
                          bez dveří byla shrnutím bez pokračování (vzor: odkaz
                          na /metodika u indexové dlaždice vedle). */}
                      <Link
                        href="/penize"
                        className="font-bold text-cobalt underline decoration-hairline underline-offset-2 transition-colors hover:text-signal"
                      >
                        {t("realStats.moneyLink")}
                      </Link>
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
                  sub={
                    <>
                      {t("realStats.lawsSub", {
                        bills: f.int(data.laws.bills),
                        laws: f.int(data.laws.laws),
                      })}
                      {/* FORENZNÍ VRSTVA — produkt 4. kola, který titulní strana
                          neukazovala vůbec: tiskla jen instalatérské počty hran.
                          Všechna čísla už `getLawData()` počítá na tomtéž čtení,
                          takže je to nula nových dotazů do grafu. */}
                      <span className="mt-1 block">
                        {t("realStats.lawsForensic", {
                          flagged: f.int(data.laws.flagged),
                          forensic: f.int(data.laws.forensic),
                          diffs: f.int(data.laws.paragraphDiffs),
                          summaries: f.int(data.laws.summaries),
                        })}
                      </span>
                    </>
                  }
                  source={
                    <>
                      {tcom("sourcePrefix")}{" "}
                      {t("realStats.lawsSource", {
                        pass: data.laws.pass ?? "—",
                        undercount: f.int(data.laws.censusUndercount),
                      })}
                      {/* Zadržený řetězec se přizná, nezmizí — táž zásada, s jakou
                          se přiznává nemožné datum v knize faktů. */}
                      {data.laws.forensicWithheld > 0 && (
                        <>
                          {" · "}
                          {t("realStats.lawsWithheld", {
                            count: f.int(data.laws.forensicWithheld),
                          })}
                        </>
                      )}
                      {" · "}
                      <Link
                        href="/zakony"
                        className="font-bold text-cobalt underline decoration-hairline underline-offset-2 transition-colors hover:text-signal"
                      >
                        {t("realStats.lawsLink")}
                      </Link>
                    </>
                  }
                />
              ) : (
                <MockStatTile statKey="laws" />
              )}
            </>
          ) : (
            <MockStatTiles />
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
                {/* Exponát jen pro reálný výřez — vzorek se citovat nesmí. */}
                {exhibitHref && (
                  <Link
                    href={exhibitHref}
                    title={t("graph.exhibitLink")}
                    className="inline-flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-cobalt transition-colors hover:text-signal"
                  >
                    <Stamp className="h-3.5 w-3.5" aria-hidden /> {t("graph.exhibitLabel")}
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
              {slice && <SourceNote className="mt-2">{t("graph.exhibitNote")}</SourceNote>}
            </div>
            <div id="provoz" className="min-w-0 xl:col-span-5">
              {/* Reálná kniha faktů, nebo OZNAČENÝ vzorek — dva moduly, jeden
                  rám (components/FeedPanelShell.tsx). Vzorkový se načte, až
                  když graf není k dispozici. */}
              {data?.feed ? (
                <GraphFeedPanel
                  ledger={data.feed}
                  // Stav čtení smluvní vrstvy patří pod knihu, kterou složil —
                  // vedle věty o vyhozených nemožných datech, ne do samostatné
                  // hlášky někde jinde na ploše.
                  contracts={data.factContracts}
                  selected={selected}
                  selectedLabel={selectedLabel}
                  onPick={select}
                  onClear={clear}
                />
              ) : (
                <MockGraphFeedPanel
                  graph={graph}
                  selected={selected}
                  selectedLabel={selectedLabel}
                  onPick={select}
                  onClear={clear}
                />
              )}
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
                <>
                  {/* Real top-5 by contribution_score, from the same materialized
                      graph as /zebricek — real pspId links, no dead ends. */}
                  {data.top.map((m) => (
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
                        {/* Pořadí je SOUTĚŽNÍ (1, 2, 2, 4) a 55 z 207 poslanců ho
                            s někým sdílí — „1." v červené barvě nad shodou vyrábí
                            vítěze, kterého data nenesou. Řeklo se to, nepřeřadilo. */}
                        {m.tiedCount > 1 && (
                          <span className="text-ochre">
                            · {t("realRanking.tiedRank", { count: f.int(m.tiedCount) })}
                          </span>
                        )}
                      </span>
                      {/* Kvalifikace řádku — TYTÉŽ komponenty, které je kreslí na
                          /zebricek a ve spisu; velín si je nepřepisuje. Každá nese
                          své datum (`effort_provenance.computedAt`) i číslo, o které
                          se opírá, a chybějící údaj se nevykreslí jako nula. */}
                      {(m.effortLowScoreReason || m.effortWorkhorse || m.effortRapporteurLoad > 0) && (
                        <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <LowScoreReasonChip
                            reason={m.effortLowScoreReason}
                            recordedAt={m.effortRecordedAt}
                            dateLabel={m.effortRecordedAt ? f.date(m.effortRecordedAt) : null}
                          />
                          {m.effortWorkhorse && (
                            <WorkhorseBadge
                              flavour={m.effortWorkhorseFlavour}
                              speechTurns={m.speechTurns}
                              recordedAt={m.effortRecordedAt}
                              compact
                            />
                          )}
                          <RapporteurBadge
                            load={m.effortRapporteurLoad}
                            recordedAt={m.effortRecordedAt}
                            compact
                          />
                        </span>
                      )}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="text-xl font-black tabular-nums">{f.dec(m.score)}</span>
                      <ArrowUpRight className="h-4 w-4 text-signal transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </span>
                  </Link>
                  ))}
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
                    <SourceNote>
                      {t("realRanking.footnote", { count: data.summary.count })}
                    </SourceNote>
                    {/* Štítky na řádku jsou TVRZENÍ enrichmentu — mají vlastní
                        citaci, ne jen datum schované v titulku. */}
                    <SourceNote>{t("realRanking.badgeSource")}</SourceNote>
                    <Link
                      href="/metodika"
                      className="font-mono text-[11px] font-bold uppercase tracking-wider text-cobalt transition-colors hover:text-signal"
                    >
                      {t("realStats.methodologyLink")}
                    </Link>
                  </div>
                </>
              ) : (
                <MockRankingLedger />
              )}
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
