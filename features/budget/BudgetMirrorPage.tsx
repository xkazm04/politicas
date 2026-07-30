"use client";

/*
 * BudgetMirror — zrcadlo rozpočtů (/rozpocty, moonshot 4A „Every Town's Mirror").
 *
 * Z 10řádkového mocku národní plocha: rejstřík všech 6 254 obcí ČR (MONITOR /
 * Státní pokladna, 14 krajů), rozpočtové ukazatele stažené dávky (obce
 * ≥ 10 000 obyvatel, roky 2021–2025, konsolidované FIN 2-12 M) a POČÍTANÁ
 * vrstevnická skupina (populační pásmo × kraj, pravidlo vytištěné na ploše —
 * features/budget/peerGroups.ts). Pokrytí se přiznává jako prvek první třídy
 * („132 z 6 254 obcí v záznamu"), obec bez čísel dostane poctivý stav, nikdy
 * dopočtený graf. Každá obec má trvalou adresu /rozpocty/[ico].
 *
 * Česká copy inline (messages/*.json mimo plochu — precedens lawwatchLabels).
 * Čísla výhradně přes useFormat (lib/format chokepoint).
 */

import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useFormat } from "@/lib/i18n/useFormat";
import SectionHeading from "@/features/shared/components/SectionHeading";
import SectionRule from "@/features/shared/components/SectionRule";
import SourceNote from "@/features/shared/components/SourceNote";
import { HAIRLINE, INK, SIGNAL, STEEL, TOOLTIP_STYLE } from "@/features/landing/palette";
import {
  coverageStats,
  getBudgetSeries,
  getMunicipality,
  getRegistry,
  latestMetrics,
  type Municipality,
} from "./mirrorData";
import { peerGroupFor, peerMedians, MIN_PEERS } from "./peerGroups";
import { SNAPSHOT_YEARS, SNAPSHOT_FLOOR_POPULATION } from "./data/budgetSnapshots.generated";
import TownPicker from "./TownPicker";
import MoneyTrailSection from "./MoneyTrailSection";
import type { SupplierTiesResult } from "./getSupplierTies";

/** Výchozí obec bez zvolené adresy: hlavní město — zrcadlo, které zná každý. */
const DEFAULT_IC = "00064581";

const SOURCE_LINE =
  "zdroj: MONITOR / Státní pokladna (monitor.statnipokladna.gov.cz) — FIN 2-12 M, konsolidované hodnoty · staženo 30. 7. 2026";

const CHART_TICK = { fill: STEEL, fontSize: 12, fontFamily: "var(--font-plex)" } as const;

/** Dvojice pruhů obec vs. medián vrstevníků — jedna metrika správcovství.
 *  null = MONITOR hodnotu nevykázal; kreslí se pomlčka, nikdy nula. */
function MetricDuo({
  label,
  kind,
  town,
  peer,
  max,
  lowerIsBetter,
}: {
  label: string;
  /** czk = f.czk · pct = f.dec + statické „%". */
  kind: "czk" | "pct";
  town: number | null;
  peer: number | null;
  max: number;
  lowerIsBetter: boolean;
}) {
  const f = useFormat();
  const formatPlain = (n: number) => (kind === "czk" ? f.czk(n) : `${f.dec(n)} %`);
  const better = town !== null && peer !== null && (lowerIsBetter ? town <= peer : town >= peer);
  const width = (v: number) => `${Math.min(100, Math.max(2, (Math.abs(v) / max) * 100))}%`;
  return (
    <div className="bg-paper p-5">
      <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-steel-aa">{label}</p>
      <p className={`mt-2 text-3xl font-black tabular-nums ${better || town === null ? "text-ink" : "text-signal-deep"}`}>
        {town === null ? (
          "—"
        ) : kind === "czk" ? (
          f.czk(town)
        ) : (
          <>
            {f.dec(town)}
            <span className="ml-1 text-base font-bold text-steel-aa">%</span>
          </>
        )}
      </p>
      <div className="mt-3 space-y-1.5">
        <div className="flex items-center gap-2">
          {/* width() bere Math.abs(v) kvůli záporným saldům — znaménko nese
              barva: schodek (záporná hodnota) je signální, nikdy k nerozeznání
              od přebytku stejné velikosti. */}
          {town === null ? (
            <span className="font-mono text-[10px] uppercase tracking-wider text-steel-aa">nevykázáno</span>
          ) : (
            <>
              <span className={`h-3 ${town < 0 ? "bg-signal" : "bg-ink"}`} style={{ width: width(town) }} />
              <span className="font-mono text-[10px] uppercase tracking-wider text-steel-aa">obec</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {peer === null ? (
            <span className="font-mono text-[10px] uppercase tracking-wider text-steel-aa">medián · bez vzorku</span>
          ) : (
            <>
              <span className="h-3 bg-hairline" style={{ width: width(peer) }}>
                <span className="block h-full w-full border border-steel/40" />
              </span>
              <span className="font-mono text-[10px] uppercase tracking-wider text-steel-aa">
                medián · {formatPlain(peer)}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function BudgetMirrorPage({
  initialIco,
  supplierTies = null,
}: {
  initialIco?: string;
  /** Živá vrstva vazeb protistran na poslance (server ji předá; null = bez ní). */
  supplierTies?: SupplierTiesResult | null;
}) {
  const reduceMotion = useReducedMotion();
  const f = useFormat();

  // Statická data — parsují se jednou na modul, useMemo tu drží jen identitu.
  const registry = useMemo(() => getRegistry(), []);
  const series = useMemo(() => getBudgetSeries(), []);
  const covered = useMemo(() => new Set(series.keys()), [series]);
  const coverage = useMemo(() => coverageStats(), []);

  const [selectedIc, setSelectedIc] = useState(
    initialIco && getMunicipality(initialIco) ? initialIco : DEFAULT_IC,
  );
  const town: Municipality = getMunicipality(selectedIc) ?? registry[0];

  const select = (ic: string) => {
    setSelectedIc(ic);
    // Trvalá adresa bez server round-tripu — data jsou celá na klientu.
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `/rozpocty/${ic}`);
    }
  };

  const townSeries = series.get(town.ic);
  const latest = latestMetrics(townSeries);
  const group = useMemo(() => peerGroupFor(town, registry, covered), [town, registry, covered]);
  const medians = useMemo(
    () => peerMedians(group.peers, series, SNAPSHOT_YEARS.length),
    [group, series],
  );

  /** Stropy pruhů z vybrané skupiny + obce (×1,1) — ne z celé ČR: celostátní
   *  extrém by každou skupinu slisoval do nečitelných proužků. */
  const metricMax = useMemo(() => {
    const pool = [...group.peers.map((p) => series.get(p.ic)), townSeries];
    const maxOf = (pick: (s: NonNullable<(typeof pool)[number]>) => (number | null)[]) => {
      let max = 0;
      for (const s of pool) {
        if (!s) continue;
        const arr = pick(s);
        const v = arr[arr.length - 1];
        if (v !== null && Math.abs(v) > max) max = Math.abs(v);
      }
      return max > 0 ? max * 1.1 : 1;
    };
    return {
      debt: maxOf((s) => s.debtPerCapita),
      capex: maxOf((s) => s.capexRatio),
      saldo: maxOf((s) => s.saldoPerCapita),
    };
  }, [group, series, townSeries]);

  const trendData = useMemo(
    () =>
      SNAPSHOT_YEARS.map((year, i) => ({
        year: String(year),
        town: townSeries?.debtPerCapita[i] ?? null,
        peer: medians.debtTrend[i],
      })),
    [townSeries, medians],
  );

  /** Řádky tabulky: vrstevníci + vybraná obec, řazeno podle dluhu vzestupně. */
  const tableRows = useMemo(() => {
    const rows = [town, ...group.peers]
      .map((m) => ({ m, latest: latestMetrics(series.get(m.ic)) }))
      .filter((r): r is { m: Municipality; latest: NonNullable<ReturnType<typeof latestMetrics>> } => r.latest !== null);
    return rows.sort(
      (a, b) => (a.latest.debtPerCapita ?? Number.POSITIVE_INFINITY) - (b.latest.debtPerCapita ?? Number.POSITIVE_INFINITY),
    );
  }, [town, group, series]);

  const scopeLabel = group.scope === "kraj" ? `kraj ${town.krajName}` : "celá ČR";

  return (
    <main className="min-h-screen overflow-x-clip bg-paper font-sans text-ink">
      {/* ── Lišta ───────────────────────────────────────────── */}
      <header className="border-b-4 border-ink">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <span className="font-mono text-xs uppercase tracking-widest text-steel-aa">/ budgetmirror</span>
          <span className="font-mono text-xs tabular-nums text-steel-aa">
            {f.int(coverage.covered)} z {f.int(coverage.registryTotal)} obcí v záznamu
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6">
        {/* ── Titulní pás ───────────────────────────────────── */}
        <div className="py-10">
          <SourceNote tone="signal">rozpočty obcí · MONITOR / Státní pokladna</SourceNote>
          <motion.h1
            initial={reduceMotion ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 text-5xl font-black uppercase leading-[0.95] tracking-tight sm:text-6xl"
          >
            Zrcadlo rozpočtů
            <span className="text-signal">.</span>
          </motion.h1>
          <div className="mt-4 max-w-xl">
            <SectionRule />
          </div>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-steel-aa">
            Hospodaření kterékoli obce České republiky proti obcím podobné velikosti: dluh na
            obyvatele, podíl investic a saldo rozpočtu z výkazů FIN 2-12 M Státní pokladny.
            Vrstevnická skupina je počítaná, ne ručně vybraná — pravidlo je vytištěné níže.
          </p>

          {/* Pokrytí — prvek první třídy, ne poznámka pod čarou. */}
          <div className="mt-6 max-w-2xl border-2 border-ink bg-paper-strong px-5 py-4">
            <p className="font-mono text-sm font-bold tabular-nums">
              {f.int(coverage.covered)} z {f.int(coverage.registryTotal)} obcí má napojenou rozpočtovou řadu
            </p>
            <p className="mt-1 text-sm leading-relaxed text-steel-aa">
              Rejstřík a vyhledávání nesou všech {f.int(coverage.registryTotal)} obcí ČR. Čísla této
              dávky pokrývají obce s {f.int(SNAPSHOT_FLOOR_POPULATION)} a více obyvateli, roky{" "}
              {SNAPSHOT_YEARS[0]}–{SNAPSHOT_YEARS[SNAPSHOT_YEARS.length - 1]}; menší obce se doplňují
              dalšími dávkami z téhož zdroje. Obec bez čísel to na ploše přizná — nikdy se nedopočítává.
            </p>
          </div>
        </div>

        {/* ── 01 Obec vs. vrstevníci ────────────────────────── */}
        <section id="zrcadlo">
          <SectionHeading
            index={1}
            title="Obec vs. vrstevníci"
            aside={<SourceNote>{SOURCE_LINE}</SourceNote>}
          />
          <div className="mt-6">
            <TownPicker registry={registry} covered={covered} selectedIc={town.ic} onSelect={select} />
          </div>

          <motion.div
            key={town.ic}
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="mt-8"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-3 border-b-2 border-ink pb-3">
              <h3 className="text-2xl font-black uppercase tracking-tight">
                {town.name}
                <span className="ml-3 font-mono text-xs font-normal normal-case tracking-normal text-steel-aa">
                  okr. {town.county} · {town.krajName} · {f.int(town.population)} obyvatel · IČO {town.ic}
                </span>
              </h3>
            </div>

            {latest ? (
              <>
                <div className="mt-6 grid gap-px border border-ink bg-ink sm:grid-cols-3">
                  <MetricDuo
                    label={`dluh na obyvatele (${latest.year})`}
                    kind="czk"
                    town={latest.debtPerCapita}
                    peer={medians.debtPerCapita}
                    max={metricMax.debt}
                    lowerIsBetter
                  />
                  <MetricDuo
                    label={`podíl investic na výdajích (${latest.year})`}
                    kind="pct"
                    town={latest.capexRatio}
                    peer={medians.capexRatio}
                    max={metricMax.capex}
                    lowerIsBetter={false}
                  />
                  <MetricDuo
                    label={`saldo na obyvatele (${latest.year})`}
                    kind="czk"
                    town={latest.saldoPerCapita}
                    peer={medians.saldoPerCapita}
                    max={metricMax.saldo}
                    lowerIsBetter={false}
                  />
                </div>
                {/* Zveřejněné pravidlo vrstevnické skupiny — počítá se, netvrdí. */}
                <p className="mt-3 font-mono text-xs leading-relaxed text-steel-aa">
                  vrstevníci = obce pásma {group.bandLabel} · {scopeLabel} · medián z{" "}
                  {f.int(medians.sampleSize)} obcí v záznamu
                  {group.scope === "celostátní"
                    ? ` (v kraji je jich v záznamu méně než ${MIN_PEERS}, skupina rozšířena celostátně)`
                    : ""}
                </p>
              </>
            ) : (
              <div className="mt-6 border-2 border-hairline bg-paper-strong px-5 py-6">
                <p className="font-mono text-xs font-bold uppercase tracking-widest text-signal-deep">
                  obec zatím bez napojených čísel
                </p>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-steel-aa">
                  {town.name} je v rejstříku ({f.int(town.population)} obyvatel, pásmo{" "}
                  {group.bandLabel}), ale rozpočtová řada této dávky ji nepokrývá — dávka nese obce s{" "}
                  {f.int(SNAPSHOT_FLOOR_POPULATION)} a více obyvateli. Výkazy obce jsou v MONITORu
                  Státní pokladny; do zrcadla přitečou další dávkou. Žádné číslo se tu nedopočítává
                  ani neodhaduje.
                </p>
              </div>
            )}
          </motion.div>
        </section>

        {/* ── 02 Vývoj dluhu ────────────────────────────────── */}
        {latest && (
          <section id="dluh" className="mt-14 border-t-4 border-ink pt-10">
            <SectionHeading
              index={2}
              title="Vývoj dluhu"
              aside={<SourceNote>{`Kč na obyvatele · plná čára = ${town.name} · čárkovaná = medián vrstevníků`}</SourceNote>}
            />
            <div className="mt-8 w-full overflow-hidden" style={{ aspectRatio: "5 / 2", minHeight: 220 }}>
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <LineChart data={trendData} margin={{ top: 8, right: 8, left: -4, bottom: 0 }}>
                  <CartesianGrid stroke={HAIRLINE} vertical={false} />
                  <XAxis dataKey="year" tick={CHART_TICK} tickLine={false} axisLine={{ stroke: INK, strokeWidth: 2 }} />
                  <YAxis
                    tick={CHART_TICK}
                    tickFormatter={(v: number) => f.int(v)}
                    tickLine={false}
                    axisLine={false}
                    width={64}
                  />
                  <Tooltip
                    cursor={{ stroke: INK, strokeDasharray: "4 4" }}
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(value, name) => [f.czk(Number(value)), String(name)]}
                  />
                  <Line
                    type="linear"
                    dataKey="town"
                    name={town.name}
                    stroke={SIGNAL}
                    strokeWidth={3}
                    dot={{ r: 3.5, fill: SIGNAL, strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: INK }}
                    isAnimationActive={!reduceMotion}
                  />
                  <Line
                    type="linear"
                    dataKey="peer"
                    name="medián vrstevníků"
                    stroke={STEEL}
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    dot={false}
                    isAnimationActive={!reduceMotion}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2">
              <SourceNote>{SOURCE_LINE}</SourceNote>
            </div>
          </section>
        )}

        {/* ── 03 Vrstevnická skupina ────────────────────────── */}
        <section id="skupina" className="mt-14 border-t-4 border-ink pt-10">
          <SectionHeading
            index={3}
            title="Vrstevnická skupina"
            aside={<SourceNote>{`pásmo ${group.bandLabel} · ${scopeLabel} · řazeno podle dluhu na obyvatele`}</SourceNote>}
          />
          {tableRows.length > 0 ? (
            <div className="mt-8 overflow-x-auto">
              <table className="w-full min-w-[40rem] text-left">
                <thead>
                  <tr className="border-b-2 border-ink font-mono text-[11px] uppercase tracking-widest text-steel-aa">
                    <th className="py-3 pr-4 font-bold">obec</th>
                    <th className="py-3 pr-4 text-right font-bold">obyvatel</th>
                    <th className="py-3 pr-4 font-bold">dluh / obyv.</th>
                    <th className="py-3 pr-4 text-right font-bold">investice %</th>
                    <th className="py-3 text-right font-bold">saldo / obyv.</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map(({ m, latest: l }) => (
                    <tr
                      key={m.ic}
                      className={`border-b border-hairline transition-colors hover:bg-paper-strong ${
                        m.ic === town.ic ? "bg-paper-strong" : ""
                      }`}
                    >
                      <td className="py-3.5 pr-4">
                        <button
                          type="button"
                          onClick={() => select(m.ic)}
                          className="text-left text-[15px] font-black uppercase tracking-tight hover:text-signal-deep"
                        >
                          {m.name}
                        </button>
                        <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-steel-aa">
                          {m.krajName}
                        </span>
                      </td>
                      <td className="py-3.5 pr-4 text-right font-mono text-sm tabular-nums text-steel-aa">
                        {f.int(m.population)}
                      </td>
                      <td className="py-3.5 pr-4">
                        <span className="flex items-center gap-3">
                          <span className="h-3 w-40 bg-hairline">
                            {l.debtPerCapita !== null && (
                              <span
                                className={`block h-full ${
                                  medians.debtPerCapita !== null && l.debtPerCapita > medians.debtPerCapita
                                    ? "bg-signal"
                                    : "bg-ink"
                                }`}
                                style={{ width: `${Math.min(100, (l.debtPerCapita / metricMax.debt) * 100)}%` }}
                              />
                            )}
                          </span>
                          <span className="font-mono text-sm font-bold tabular-nums">
                            {l.debtPerCapita === null ? "—" : f.czk(l.debtPerCapita)}
                          </span>
                        </span>
                      </td>
                      <td className="py-3.5 pr-4 text-right font-mono text-sm tabular-nums">
                        {l.capexRatio === null ? "—" : <>{f.dec(l.capexRatio)} %</>}
                      </td>
                      <td
                        className={`py-3.5 text-right font-mono text-sm font-bold tabular-nums ${
                          l.saldoPerCapita !== null && l.saldoPerCapita < 0 ? "text-signal-deep" : "text-ink"
                        }`}
                      >
                        {l.saldoPerCapita === null ? (
                          "—"
                        ) : (
                          <>
                            {l.saldoPerCapita > 0 ? "+" : ""}
                            {f.czk(l.saldoPerCapita)}
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-8 max-w-2xl text-sm leading-relaxed text-steel-aa">
              V pásmu {group.bandLabel} zatím není v záznamu žádná obec s rozpočtovou řadou — tabulka
              se objeví s další dávkou dat.
            </p>
          )}
          <p className="mt-4 max-w-3xl text-sm italic leading-relaxed text-steel-aa">
            Správcovství se do CivicScore propisuje jen politikům v exekutivních rolích (starostové,
            hejtmani) — poslanec neztrácí body za cizí obecní rozpočet. Hodnoty na této ploše jsou
            konsolidované výkazy FIN 2-12 M ze systému MONITOR; obec, kterou dávka nepokrývá, žádná
            čísla nedostane, dokud nepřitečou ze zdroje.
          </p>
        </section>

        {/* ── 04 Peněžní stopa obce (moonshot 4D) ───────────── */}
        <div className="pb-20">
          <MoneyTrailSection town={town} ties={supplierTies} />
        </div>
      </div>
    </main>
  );
}
