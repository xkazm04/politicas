"use client";

/*
 * Varianta C — „Rentgen".
 * Metafora: rentgen státu — investigativní důkazní terminál, který by si
 * redakce nechala na druhém monitoru. Grafitová tma, mono písmo, vlasové
 * panely, jantarové zvýraznění peněžní stopy a interaktivní graf
 * osoba→firma→smlouva jako hero: najeďte na uzel a veřejné peníze se
 * rozsvítí. Každý řádek se čte jako záznam auditního logu. Po fúzi
 * s Broadsheetem nese i hlavní zprávu a plný žebříček sněmovny.
 *
 * ARCHIV (kolo 3): vítězem se stal Konstrukt — tahle varianta zůstává
 * v features/labs/ jako živá reference investigativního směru (mount:
 * /rentgen). Labs je zóna s pevnou výtvarnou řečí — literální hexy povoleny,
 * tokeny se sem nezavádějí.
 */

import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Crosshair, ScanLine } from "lucide-react";
import { GRAPH_EDGES, GRAPH_NODES, MODULES, SOURCES, MPS } from "@/lib/civic/data";

const BG = "#0b0e13";
const PANEL = "#10151c";
const TEXT = "#cfd8e3";
const DIM = "#5f6d7d";
const HAIR = "#1e2833";
const AMBER = "#ffb224";
const RED = "#ff5a48";
const GREEN = "#3ad99b";

const px = (x: number) => x * 6.4;
const py = (y: number) => y * 4;

const czech = (n: number) => n.toFixed(1).replace(".", ",");

const NODE_COLOR: Record<string, string> = {
  person: AMBER,
  company: TEXT,
  party: DIM,
  money: RED,
};

function MoneyGraph() {
  const [hover, setHover] = useState<string | null>("mp");
  const connected = useMemo(() => {
    if (!hover) return new Set<string>();
    const s = new Set<string>([hover]);
    GRAPH_EDGES.forEach((e) => {
      if (e.from === hover) s.add(e.to);
      if (e.to === hover) s.add(e.from);
    });
    return s;
  }, [hover]);

  const node = GRAPH_NODES.find((n) => n.id === hover);

  return (
    <div className="border" style={{ borderColor: HAIR, background: PANEL }}>
      <div
        className="flex items-center justify-between border-b px-4 py-2 font-mono text-[11px] uppercase tracking-widest"
        style={{ borderColor: HAIR, color: DIM }}
      >
        <span className="flex items-center gap-2">
          <Crosshair className="h-3.5 w-3.5" style={{ color: AMBER }} />
          graf entit · vzorek MSK-047
        </span>
        <span className="hidden sm:inline">registr smluv ⋈ ares ⋈ hlídač — klíč: IČO</span>
      </div>
      <svg viewBox="0 0 640 400" className="w-full" role="img" aria-label="Graf peněžní stopy: poslanec, firmy, veřejné peníze">
        {Array.from({ length: 15 }, (_, i) => (
          <line key={`v${i}`} x1={i * 46} y1={0} x2={i * 46} y2={400} stroke={HAIR} strokeWidth={0.5} />
        ))}
        {Array.from({ length: 9 }, (_, i) => (
          <line key={`h${i}`} x1={0} y1={i * 50} x2={640} y2={i * 50} stroke={HAIR} strokeWidth={0.5} />
        ))}
        {GRAPH_EDGES.map((e) => {
          const a = GRAPH_NODES.find((n) => n.id === e.from)!;
          const b = GRAPH_NODES.find((n) => n.id === e.to)!;
          const lit = hover !== null && connected.has(e.from) && connected.has(e.to) && (e.from === hover || e.to === hover);
          const mx = (px(a.x) + px(b.x)) / 2;
          const my = (py(a.y) + py(b.y)) / 2;
          return (
            <g key={`${e.from}-${e.to}`}>
              <line
                x1={px(a.x)}
                y1={py(a.y)}
                x2={px(b.x)}
                y2={py(b.y)}
                stroke={lit ? AMBER : "#33404f"}
                strokeWidth={lit ? 2 : 1}
                strokeDasharray={e.trail ? undefined : "4 4"}
              />
              {lit && (
                <text
                  x={mx}
                  y={my - 7}
                  textAnchor="middle"
                  fontSize={11}
                  fontFamily="var(--font-plex)"
                  fill={AMBER}
                  className="uppercase"
                >
                  {e.label}
                </text>
              )}
            </g>
          );
        })}
        {GRAPH_NODES.map((n) => {
          const lit = connected.has(n.id);
          const c = NODE_COLOR[n.kind];
          return (
            <g
              key={n.id}
              transform={`translate(${px(n.x)} ${py(n.y)})`}
              onMouseEnter={() => setHover(n.id)}
              onFocus={() => setHover(n.id)}
              tabIndex={0}
              style={{ cursor: "pointer", outline: "none" }}
            >
              {n.kind === "money" ? (
                <rect x={-7} y={-7} width={14} height={14} fill={lit ? c : "#26313d"} transform="rotate(45)" />
              ) : (
                <circle r={n.id === hover ? 10 : 7} fill={lit ? c : "#26313d"} />
              )}
              <text
                y={-14}
                textAnchor="middle"
                fontSize={13}
                fontFamily="var(--font-plex)"
                fontWeight={600}
                fill={lit ? TEXT : DIM}
              >
                {n.label}
              </text>
              <text y={26} textAnchor="middle" fontSize={10.5} fontFamily="var(--font-plex)" fill={DIM}>
                {n.sub}
              </text>
            </g>
          );
        })}
      </svg>
      <div
        className="flex min-h-[3.25rem] items-center justify-between gap-4 border-t px-4 py-2.5 font-mono text-xs"
        style={{ borderColor: HAIR }}
      >
        {node ? (
          <span style={{ color: TEXT }}>
            <span style={{ color: AMBER }}>▸ {node.label}</span>{" "}
            <span style={{ color: DIM }}>
              — {node.sub} · {GRAPH_EDGES.filter((e) => e.from === node.id || e.to === node.id).length} hran v záznamu
            </span>
          </span>
        ) : (
          <span style={{ color: DIM }}>najeďte na uzel a stopa se rozsvítí</span>
        )}
        <span className="hidden shrink-0 sm:inline" style={{ color: GREEN }}>
          ● všechny hrany datované + doložené
        </span>
      </div>
    </div>
  );
}

const LOG_LINES = [
  { t: "09:14:02", src: "registr smluv", line: "smlouva 4,2 mil. Kč — Silnice MSK a.s. ← Kraj MSK", flag: "vazba na poslance přes statutární orgán", color: RED },
  { t: "09:14:02", src: "ares v3", line: "K. Hruška ve statutárním orgánu IČO 258 41 991", flag: "od 03/2019", color: AMBER },
  { t: "09:14:03", src: "psp.cz", line: "hlasování č. 412: poslanec hlasoval PRO krajskou infrastrukturu", flag: "možný střet zájmů", color: AMBER },
  { t: "09:14:05", src: "hlídač státu", line: "dar 350 tis. Kč → ANO 2011 od Agrofond s.r.o.", flag: "překryv vlastníků 38 %", color: RED },
  { t: "09:14:08", src: "skóring", line: "pilíř integrity přepočten: 68 → 61, čeká na lidskou kontrolu", flag: "nezveřejněno do ověření", color: GREEN },
];

export default function VariantRentgen() {
  const reduceMotion = useReducedMotion();

  return (
    <main className="min-h-screen overflow-x-clip font-mono" style={{ background: BG, color: TEXT }}>
      {/* ── Stavová lišta ────────────────────────────────────── */}
      <header className="border-b" style={{ borderColor: HAIR }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3 text-xs uppercase tracking-widest">
          <span className="flex items-center gap-3 text-sm font-bold normal-case tracking-normal">
            <ScanLine className="h-4 w-4" style={{ color: AMBER }} />
            <span className="font-sans text-base font-black uppercase tracking-tight">
              Politicas<span style={{ color: AMBER }}>/rentgen</span>
            </span>
          </span>
          <nav className="hidden items-center gap-6 sm:flex" style={{ color: DIM }}>
            <a href="#r-graph" className="transition-colors hover:text-[#ffb224]">trasování</a>
            <a href="#r-zebricek" className="transition-colors hover:text-[#ffb224]">žebříček</a>
            <a href="#r-instruments" className="transition-colors hover:text-[#ffb224]">nástroje</a>
            <a href="#r-sources" className="transition-colors hover:text-[#ffb224]">zdroje</a>
            <span className="flex items-center gap-1.5" style={{ color: GREEN }}>
              <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: GREEN }} />
              feedy živě
            </span>
          </nav>
        </div>
      </header>

      {/* ── Hero: hlavní zpráva + graf ───────────────────────── */}
      <section className="mx-auto grid max-w-6xl gap-10 px-6 py-14 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="min-w-0">
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-xs uppercase tracking-[0.3em]"
            style={{ color: AMBER }}
          >
            hlavní zpráva · forenzní analýza veřejných peněz
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06 }}
            className="mt-5 font-sans text-5xl font-black uppercase leading-[0.98] tracking-tight sm:text-6xl"
          >
            Prosviťte
            <br />
            stát<span style={{ color: AMBER }}>_</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.16 }}
            className="mt-6 max-w-md text-[15px] leading-relaxed"
            style={{ color: DIM }}
          >
            Každý odevzdaný hlas, každá koruna veřejných peněz, každý změněný paragraf
            zákona — spojené do jednoho prohledávatelného grafu a jednoho skóre pro
            každého politika. Každé tvrzení je záznam v auditním logu: datované,
            doložené, přezkoumatelné.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.26 }}
            className="mt-8 flex flex-wrap gap-3 text-sm"
          >
            <a
              href="#r-graph"
              className="inline-flex items-center gap-2 px-5 py-3 font-bold uppercase tracking-wider transition-colors hover:bg-[#ffc95c]"
              style={{ background: AMBER, color: BG }}
            >
              Spustit trasování <ArrowRight className="h-4 w-4" />
            </a>
            <a
              href="#r-sources"
              className="inline-flex items-center gap-2 border px-5 py-3 uppercase tracking-wider transition-colors hover:border-[#ffb224] hover:text-[#ffb224]"
              style={{ borderColor: "#33404f", color: TEXT }}
            >
              Prohlédnout zdroje
            </a>
          </motion.div>

          {/* Žebříček — převzatý z Broadsheetu, přepsaný do terminálu */}
          <div id="r-zebricek" className="mt-12 border" style={{ borderColor: HAIR, background: PANEL }}>
            <div
              className="flex items-center justify-between border-b px-4 py-2 text-[11px] uppercase tracking-widest"
              style={{ borderColor: HAIR, color: DIM }}
            >
              <span>žebříček sněmovny · kompozit civicscore</span>
              <span className="hidden sm:inline">Σ pilíř × váha · v1.4</span>
            </div>
            {MPS.map((m, i) => (
              <motion.div
                key={m.id}
                initial={reduceMotion ? false : { opacity: 0, x: -8 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 + i * 0.06 }}
                className="grid grid-cols-[2.5rem_1fr_auto_auto] items-center gap-3 border-b px-4 py-2.5 text-sm last:border-b-0 hover:bg-[#141b24]"
                style={{ borderColor: HAIR }}
              >
                <span className="font-bold tabular-nums" style={{ color: m.rank <= 3 ? AMBER : DIM }}>
                  #{m.rank}
                </span>
                <span className="min-w-0">
                  <span className="block truncate" style={{ color: TEXT }}>
                    {m.name} <span style={{ color: DIM }}>· {m.party}</span>
                  </span>
                </span>
                <span className="hidden h-1 w-24 overflow-hidden sm:block" style={{ background: HAIR }}>
                  <span
                    className="block h-full"
                    style={{ width: `${m.score}%`, background: m.score > 60 ? GREEN : m.score > 45 ? AMBER : RED }}
                  />
                </span>
                <span className="flex items-center gap-2">
                  <span className="w-11 text-right font-bold tabular-nums" style={{ color: m.score > 60 ? GREEN : m.score > 45 ? AMBER : RED }}>
                    {czech(m.score)}
                  </span>
                  <span className="w-8 text-right text-[11px]" style={{ color: m.delta > 0 ? GREEN : m.delta < 0 ? RED : DIM }}>
                    {m.delta > 0 ? `▲${m.delta}` : m.delta < 0 ? `▼${Math.abs(m.delta)}` : "—"}
                  </span>
                </span>
              </motion.div>
            ))}
            <div className="px-4 py-2 text-[11px] uppercase tracking-widest" style={{ color: DIM }}>
              plný výpis: 200 poslanců · přepočet každé čtvrtletí
            </div>
          </div>
        </div>

        <div id="r-graph" className="min-w-0">
          <MoneyGraph />
          {/* důkazní log */}
          <div className="mt-4 border" style={{ borderColor: HAIR, background: PANEL }}>
            <div className="border-b px-4 py-2 text-[11px] uppercase tracking-widest" style={{ borderColor: HAIR, color: DIM }}>
              důkazní log — tail -f
            </div>
            <div className="overflow-x-auto px-4 py-3 text-[12.5px] leading-relaxed">
              {LOG_LINES.map((l, i) => (
                <motion.p
                  key={i}
                  initial={reduceMotion ? false : { opacity: 0, x: -8 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.15 + i * 0.12 }}
                  className="whitespace-nowrap"
                >
                  <span style={{ color: DIM }}>{l.t}</span>{" "}
                  <span style={{ color: AMBER }}>[{l.src}]</span>{" "}
                  <span>{l.line}</span>{" "}
                  <span style={{ color: l.color }}>« {l.flag} »</span>
                </motion.p>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Nástroje ─────────────────────────────────────────── */}
      <section id="r-instruments" className="border-t" style={{ borderColor: HAIR }}>
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="font-sans text-3xl font-black uppercase tracking-tight sm:text-4xl">
              Pět nástrojů<span style={{ color: AMBER }}>.</span> Jeden graf<span style={{ color: AMBER }}>.</span>
            </h2>
            <p className="text-xs uppercase tracking-[0.25em]" style={{ color: DIM }}>
              osoba ⋈ strana ⋈ firma ⋈ peníze ⋈ hlasování ⋈ zákon
            </p>
          </div>
          <div className="mt-8 grid gap-px border sm:grid-cols-2 lg:grid-cols-5" style={{ borderColor: HAIR, background: HAIR }}>
            {MODULES.map((m, i) => (
              <motion.div
                key={m.key}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ delay: i * 0.06 }}
                className="group flex flex-col justify-between p-5 transition-colors hover:bg-[#141b24]"
                style={{ background: PANEL, minHeight: "13rem" }}
              >
                <div>
                  <p className="text-[11px] uppercase tracking-widest" style={{ color: DIM }}>
                    /{String(i + 1).padStart(2, "0")} · {m.tag}
                  </p>
                  <p className="mt-2 font-sans text-xl font-black uppercase tracking-tight" style={{ color: TEXT }}>
                    {m.name}
                  </p>
                  <p className="mt-2 text-xs leading-relaxed" style={{ color: DIM }}>
                    {m.description}
                  </p>
                </div>
                <p className="mt-4 text-lg font-bold tabular-nums" style={{ color: AMBER }}>
                  {m.metric.value}
                  <span className="ml-1.5 text-[10px] font-normal uppercase tracking-wider" style={{ color: DIM }}>
                    {m.metric.label}
                  </span>
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Registr zdrojů ───────────────────────────────────── */}
      <section id="r-sources" className="border-t" style={{ borderColor: HAIR }}>
        <div className="mx-auto max-w-6xl px-6 py-14">
          <h2 className="font-sans text-3xl font-black uppercase tracking-tight">Registr zdrojů</h2>
          <p className="mt-2 max-w-2xl text-sm" style={{ color: DIM }}>
            Žádná magie se scrapováním — ověřené veřejné endpointy se známou kadencí a
            licencí. Když feed vypadne, pilíř, který sytí, to řekne — místo předstírání.
          </p>
          <div className="mt-6 overflow-x-auto border" style={{ borderColor: HAIR }}>
            <table className="w-full min-w-[40rem] text-left text-[13px]">
              <thead>
                <tr className="border-b text-[11px] uppercase tracking-widest" style={{ borderColor: HAIR, color: DIM }}>
                  <th className="px-4 py-2.5 font-medium">endpoint</th>
                  <th className="px-4 py-2.5 font-medium">obsah</th>
                  <th className="px-4 py-2.5 font-medium">kadence</th>
                  <th className="px-4 py-2.5 font-medium">přístup</th>
                  <th className="px-4 py-2.5 font-medium">stav</th>
                </tr>
              </thead>
              <tbody>
                {SOURCES.map((s) => (
                  <tr key={s.name} className="border-b transition-colors hover:bg-[#141b24]" style={{ borderColor: HAIR }}>
                    <td className="px-4 py-2.5 font-bold" style={{ color: AMBER }}>{s.name}</td>
                    <td className="px-4 py-2.5" style={{ color: TEXT }}>{s.what}</td>
                    <td className="px-4 py-2.5" style={{ color: DIM }}>{s.cadence}</td>
                    <td className="px-4 py-2.5" style={{ color: DIM }}>{s.access}</td>
                    <td className="px-4 py-2.5" style={{ color: GREEN }}>● ověřeno</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── Patička ──────────────────────────────────────────── */}
      <footer className="border-t" style={{ borderColor: HAIR }}>
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6 px-6 py-10">
          <div>
            <p className="font-sans text-2xl font-black uppercase tracking-tight">
              Politicas<span style={{ color: AMBER }}>/rentgen</span>
            </p>
            <p className="mt-1 text-xs" style={{ color: DIM }}>
              doložená fakta, nikdy obvinění — každá hrana nese provenienci + datum.
            </p>
          </div>
          <a
            href="#r-graph"
            className="inline-flex items-center gap-2 px-5 py-3 text-sm font-bold uppercase tracking-wider transition-colors hover:bg-[#ffc95c]"
            style={{ background: AMBER, color: BG }}
          >
            Trasuj svého poslance <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </footer>
    </main>
  );
}
