"use client";

/*
 * Newsroom Evidence Terminal — /rentgen (moonshot batch-7, 7C).
 *
 * Varianta C „Rentgen" (archiv kola 3, vítězem se stal Konstrukt) povýšená
 * z výtvarné reference na tiskový produkt: rentgen státu, který by si redakce
 * nechala na druhém monitoru. Grafitová tma, mono písmo, vlasové panely,
 * jantarová peněžní stopa — a POD tou řečí živý znalostní graf:
 *
 *   • graf peněžní stopy jede nad SKUTEČNÝMI ověřenými vazbami (verified-only
 *     disciplína vynucená v terminalModel.ts a testovaná),
 *   • „důkazní log — tail -f" je živý proud provenience (rozhodnutí lidské
 *     brány + change eventy grafu),
 *   • každý prvek je odkaz na svou citační plochu (/zdroj, /dukazy#z-…,
 *     /penize/<id>/paket, primární registry) — tiskové afordance všude.
 *
 * Labs je zóna s pevnou výtvarnou řečí — literální hexy povoleny, tokeny se
 * sem nezavádějí (výjimka v eslint.config.mjs trvá). Když není čitelná žádná
 * vrstva úložiště, plocha to PŘIZNÁ a ukáže archivní ilustrativní vzorek,
 * zřetelně označený — nikdy nevydává ilustraci za záznam.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Crosshair, FileText, ScanLine, ShieldCheck } from "lucide-react";
import { GRAPH_EDGES, GRAPH_NODES } from "@/lib/civic/data";
import { czechInt } from "@/lib/format";
import {
  czkCompact,
  type TailLine,
  type TailTone,
  type TerminalEdge,
  type TerminalNode,
  type TerminalViewData,
} from "./terminalModel";

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

const NODE_COLOR: Record<string, string> = {
  person: AMBER,
  company: TEXT,
  party: DIM,
  money: RED,
};

const TONE_COLOR: Record<TailTone, string> = { green: GREEN, amber: AMBER, red: RED };

// ── archivní ilustrativní vzorek (fallback bez úložiště, VŽDY označený) ─────

const SAMPLE_NODES: TerminalNode[] = GRAPH_NODES.map((n) => ({
  id: n.id,
  kind: n.kind as TerminalNode["kind"],
  label: n.label,
  sub: n.sub,
  x: n.x,
  y: n.y,
  href: null,
}));

const SAMPLE_EDGES: TerminalEdge[] = GRAPH_EDGES.map((e) => ({
  from: e.from,
  to: e.to,
  label: e.label,
  trail: Boolean(e.trail),
  href: null,
}));

const SAMPLE_TAIL: TailLine[] = [
  { id: "s1", at: "", atCs: "09:14:02", source: "registr smluv", text: "smlouva 4,2 mil. Kč — Silnice MSK a.s. ← Kraj MSK", flag: "vazba na poslance přes statutární orgán", tone: "red", href: null },
  { id: "s2", at: "", atCs: "09:14:02", source: "ares v3", text: "K. Hruška ve statutárním orgánu IČO 258 41 991", flag: "od 03/2019", tone: "amber", href: null },
  { id: "s3", at: "", atCs: "09:14:03", source: "psp.cz", text: "hlasování č. 412: poslanec hlasoval PRO krajskou infrastrukturu", flag: "možný střet zájmů", tone: "amber", href: null },
  { id: "s4", at: "", atCs: "09:14:05", source: "hlídač státu", text: "dar 350 tis. Kč → ANO 2011 od Agrofond s.r.o.", flag: "překryv vlastníků 38 %", tone: "red", href: null },
  { id: "s5", at: "", atCs: "09:14:08", source: "skóring", text: "pilíř integrity přepočten: 68 → 61, čeká na lidskou kontrolu", flag: "nezveřejněno do ověření", tone: "green", href: null },
];

// ── nástroje: skutečné plochy produktu (tiskové vstupy, ne mock moduly) ─────

const INSTRUMENTS = [
  { key: "graf", tag: "graf", name: "Znalostní graf", href: "/graf", description: "Osoba ⋈ firma ⋈ smlouva ⋈ zákon v jednom prohledávatelném plátně; každý pohled má trvalou citaci /graf/p/…." },
  { key: "penize", tag: "peníze", name: "Peněžní stopa", href: "/penize", description: "Vazby poslanec ↔ firma s dosažitelnými veřejnými penězi; u každého poslance kompilátor důkazního paketu." },
  { key: "dukazy", tag: "brána", name: "Deník důkazů", href: "/dukazy", description: "Veřejný věstník lidské brány: každé ověření či zamítnutí vazby jako datovaný, citovatelný záznam (RSS/JSON)." },
  { key: "denik", tag: "záznam", name: "Deník sněmovny", href: "/denik", description: "Chronologický záznam smluv, rolí, tisků a rozhodnutí — co se stalo a kdy to graf zaznamenal." },
  { key: "overeni", tag: "ověření", name: "Ověřovací brána", href: "/overeni", description: "Vložte citaci politicas (/zdroj/…, /graf/p/…) a server tvrzení deterministicky znovu odvodí." },
] as const;

// ── registr pramenů (doslovné primární registry, s odkazy) ──────────────────

const SOURCE_REGISTRY = [
  { name: "psp.cz", href: "https://www.psp.cz", what: "poslanci, tisky, hlasování", cadence: "denně", access: "otevřená data" },
  { name: "ares.gov.cz", href: "https://ares.gov.cz", what: "veřejný rejstřík, statutární orgány", cadence: "denně", access: "REST API" },
  { name: "smlouvy.gov.cz", href: "https://smlouvy.gov.cz", what: "registr smluv — veřejné zakázky", cadence: "denně", access: "otevřená data" },
  { name: "hlidacstatu.cz", href: "https://www.hlidacstatu.cz", what: "dotace, dary, osoby ve firmách", cadence: "denně", access: "API s klíčem" },
  { name: "e-sbirka.cz", href: "https://www.e-sbirka.cz", what: "sbírka zákonů, vyhlášení", cadence: "při vyhlášení", access: "otevřená data" },
] as const;

// ── graf peněžní stopy ──────────────────────────────────────────────────────

function GraphNodeShape({ node, lit, hovered }: { node: TerminalNode; lit: boolean; hovered: boolean }) {
  const c = NODE_COLOR[node.kind] ?? TEXT;
  return (
    <>
      {node.kind === "money" ? (
        <rect x={-7} y={-7} width={14} height={14} fill={lit ? c : "#26313d"} transform="rotate(45)" />
      ) : (
        <circle r={hovered ? 10 : 7} fill={lit ? c : "#26313d"} />
      )}
      <text y={-14} textAnchor="middle" fontSize={13} fontFamily="var(--font-plex)" fontWeight={600} fill={lit ? TEXT : DIM}>
        {node.label}
      </text>
      <text y={26} textAnchor="middle" fontSize={10.5} fontFamily="var(--font-plex)" fill={DIM}>
        {node.sub}
      </text>
    </>
  );
}

function MoneyGraph({
  nodes,
  edges,
  live,
  caption,
}: {
  nodes: TerminalNode[];
  edges: TerminalEdge[];
  live: boolean;
  caption: string;
}) {
  const [hover, setHover] = useState<string | null>(nodes[0]?.id ?? null);
  const connected = useMemo(() => {
    if (!hover) return new Set<string>();
    const s = new Set<string>([hover]);
    edges.forEach((e) => {
      if (e.from === hover) s.add(e.to);
      if (e.to === hover) s.add(e.from);
    });
    return s;
  }, [hover, edges]);

  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const node = hover ? byId.get(hover) : undefined;

  return (
    <div className="border" style={{ borderColor: HAIR, background: PANEL }}>
      <div
        className="flex items-center justify-between gap-3 border-b px-4 py-2 font-mono text-[11px] uppercase tracking-widest"
        style={{ borderColor: HAIR, color: DIM }}
      >
        <span className="flex items-center gap-2">
          <Crosshair className="h-3.5 w-3.5" style={{ color: AMBER }} aria-hidden />
          {caption}
        </span>
        <span className="hidden sm:inline">registr smluv ⋈ ares ⋈ hlídač — klíč: IČO</span>
      </div>
      <svg
        viewBox="0 0 640 400"
        className="w-full"
        role="img"
        aria-label="Graf peněžní stopy: poslanci, firmy a veřejné peníze; každý uzel odkazuje na svou citační plochu"
      >
        {Array.from({ length: 15 }, (_, i) => (
          <line key={`v${i}`} x1={i * 46} y1={0} x2={i * 46} y2={400} stroke={HAIR} strokeWidth={0.5} />
        ))}
        {Array.from({ length: 9 }, (_, i) => (
          <line key={`h${i}`} x1={0} y1={i * 50} x2={640} y2={i * 50} stroke={HAIR} strokeWidth={0.5} />
        ))}
        {edges.map((e) => {
          const a = byId.get(e.from);
          const b = byId.get(e.to);
          if (!a || !b) return null;
          const lit = hover !== null && (e.from === hover || e.to === hover);
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
                <text x={mx} y={my - 7} textAnchor="middle" fontSize={11} fontFamily="var(--font-plex)" fill={AMBER} className="uppercase">
                  {e.label}
                </text>
              )}
            </g>
          );
        })}
        {nodes.map((n) => {
          const lit = connected.has(n.id);
          const inner = <GraphNodeShape node={n} lit={lit} hovered={n.id === hover} />;
          return (
            <g
              key={n.id}
              transform={`translate(${px(n.x)} ${py(n.y)})`}
              onMouseEnter={() => setHover(n.id)}
              onFocus={() => setHover(n.id)}
            >
              {n.href ? (
                <a href={n.href} aria-label={`${n.label} — otevřít citační plochu`} style={{ cursor: "pointer" }}>
                  {inner}
                </a>
              ) : (
                // Bez adresy (ilustrativní vzorek) je uzel jen ohniskem stopy.
                <g tabIndex={0} style={{ outline: "none" }}>{inner}</g>
              )}
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
              — {node.sub} · {edges.filter((e) => e.from === node.id || e.to === node.id).length} hran v záznamu
              {node.href ? (
                <>
                  {" · "}
                  <a href={node.href} className="underline underline-offset-2 transition-colors hover:text-[#ffb224]">
                    {node.href.startsWith("/zdroj/") ? "účtenka /zdroj" : node.href.startsWith("/penize/") ? "spis poslance" : "primární registr"}
                  </a>
                </>
              ) : null}
            </span>
          </span>
        ) : (
          <span style={{ color: DIM }}>najeďte na uzel a stopa se rozsvítí</span>
        )}
        <span className="hidden shrink-0 sm:inline" style={{ color: live ? GREEN : RED }}>
          {live ? "● jen vazby ověřené lidskou bránou" : "● ilustrativní vzorek — není záznam"}
        </span>
      </div>
    </div>
  );
}

// ── terminál ────────────────────────────────────────────────────────────────

export default function VariantRentgen({ data }: { data: TerminalViewData | null }) {
  const reduceMotion = useReducedMotion();
  // Zúžení pro TS i pro čtenáře: `live` je celý model, JEN když je peněžní
  // vrstva čitelná; `tailData` jen když je čitelný aspoň jeden pramen logu.
  const live = data !== null && data.coverage.money ? data : null;
  const tailData = data !== null && (data.coverage.reviews || data.coverage.changes) ? data : null;

  const graphIsLive = live !== null && live.graph.shownTies > 0;
  const graphNodes = live !== null && graphIsLive ? live.graph.nodes : SAMPLE_NODES;
  const graphEdges = live !== null && graphIsLive ? live.graph.edges : SAMPLE_EDGES;
  const tailIsLive = tailData !== null && tailData.tail.length > 0;
  const tail = tailData !== null && tailIsLive ? tailData.tail : SAMPLE_TAIL;

  return (
    <main className="min-h-screen overflow-x-clip font-mono" style={{ background: BG, color: TEXT }}>
      {/* ── Stavová lišta ────────────────────────────────────── */}
      <header className="border-b" style={{ borderColor: HAIR }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3 text-xs uppercase tracking-widest">
          <span className="flex items-center gap-3 text-sm font-bold normal-case tracking-normal">
            <ScanLine className="h-4 w-4" style={{ color: AMBER }} aria-hidden />
            <span className="font-sans text-base font-black uppercase tracking-tight">
              Politicas<span style={{ color: AMBER }}>/rentgen</span>
            </span>
          </span>
          <nav className="hidden items-center gap-6 sm:flex" style={{ color: DIM }}>
            <a href="#r-press" className="transition-colors hover:text-[#ffb224]">pro novináře</a>
            <a href="#r-graph" className="transition-colors hover:text-[#ffb224]">trasování</a>
            <a href="#r-zebricek" className="transition-colors hover:text-[#ffb224]">ověřené vazby</a>
            <a href="#r-sources" className="transition-colors hover:text-[#ffb224]">prameny</a>
            <span className="flex items-center gap-1.5" style={{ color: live ? GREEN : RED }}>
              <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: live ? GREEN : RED }} />
              {live ? "záznam živě" : "ilustrativní režim"}
            </span>
          </nav>
        </div>
      </header>

      {/* ── Pro novináře ─────────────────────────────────────── */}
      <section id="r-press" className="border-b" style={{ borderColor: HAIR, background: PANEL }}>
        <div className="mx-auto grid max-w-6xl gap-6 px-6 py-6 lg:grid-cols-[1fr_auto]">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.3em]" style={{ color: AMBER }}>
              <FileText className="h-3.5 w-3.5" aria-hidden /> pro novináře
            </p>
            <p className="mt-2 max-w-3xl text-[13px] leading-relaxed" style={{ color: TEXT }}>
              Tenhle terminál je důkazní pohled na živý znalostní graf politicas: ukazuje{" "}
              <strong style={{ color: AMBER }}>výhradně vazby, které prošly lidskou bránou</strong>{" "}
              (verified), a každý prvek — uzel, hrana, řádek logu — odkazuje na svou citační plochu.
              Účtenku původu (/zdroj/…) i citaci pohledu na graf (/graf/p/…) můžete vložit do článku;
              čtenář i redakce si z ní tvrzení kdykoli znovu odvodí.
            </p>
          </div>
          <div className="flex flex-col justify-center gap-2 text-[12px]">
            <Link
              href="/overeni"
              className="inline-flex items-center gap-2 border px-4 py-2 uppercase tracking-wider transition-colors hover:border-[#ffb224] hover:text-[#ffb224]"
              style={{ borderColor: "#33404f", color: TEXT }}
            >
              <ShieldCheck className="h-4 w-4" style={{ color: GREEN }} aria-hidden />
              ověřovací brána /overeni
            </Link>
            <Link
              href="/penize"
              className="inline-flex items-center gap-2 border px-4 py-2 uppercase tracking-wider transition-colors hover:border-[#ffb224] hover:text-[#ffb224]"
              style={{ borderColor: "#33404f", color: TEXT }}
            >
              <ArrowRight className="h-4 w-4" style={{ color: AMBER }} aria-hidden />
              důkazní pakety /penize/…/paket
            </Link>
          </div>
        </div>
      </section>

      {/* ── Hero: hlavní zpráva + graf ───────────────────────── */}
      <section className="mx-auto grid max-w-6xl gap-10 px-6 py-14 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="min-w-0">
          <motion.p
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-xs uppercase tracking-[0.3em]"
            style={{ color: AMBER }}
          >
            důkazní terminál · forenzní pohled na veřejné peníze
          </motion.p>
          <motion.h1
            initial={reduceMotion ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06 }}
            className="mt-5 font-sans text-5xl font-black uppercase leading-[0.98] tracking-tight sm:text-6xl"
          >
            Prosviťte
            <br />
            stát<span style={{ color: AMBER }}>_</span>
          </motion.h1>
          <motion.p
            initial={reduceMotion ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.16 }}
            className="mt-6 max-w-md text-[15px] leading-relaxed"
            style={{ color: DIM }}
          >
            Každá koruna veřejných peněz dosažitelná přes firmy poslanců, spojená do jednoho
            prohledávatelného grafu. Každé tvrzení je záznam v auditním logu: datované, doložené,
            přezkoumatelné — a nic nevstoupí do obrazu, dokud to neověří člověk.
          </motion.p>
          {live !== null ? (
            <motion.dl
              initial={reduceMotion ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.22 }}
              className="mt-6 grid max-w-md grid-cols-3 gap-px border text-center"
              style={{ borderColor: HAIR, background: HAIR }}
            >
              <div className="p-3" style={{ background: PANEL }}>
                <dt className="text-[10px] uppercase tracking-widest" style={{ color: DIM }}>ověřené vazby</dt>
                <dd className="mt-1 text-lg font-bold tabular-nums" style={{ color: GREEN }}>{czechInt(live.graph.verifiedCount)}</dd>
              </div>
              <div className="p-3" style={{ background: PANEL }}>
                <dt className="text-[10px] uppercase tracking-widest" style={{ color: DIM }}>čeká na bránu</dt>
                <dd className="mt-1 text-lg font-bold tabular-nums" style={{ color: AMBER }}>{czechInt(live.graph.pendingCount)}</dd>
              </div>
              <div className="p-3" style={{ background: PANEL }}>
                <dt className="text-[10px] uppercase tracking-widest" style={{ color: DIM }}>dosažitelné (ověřené)</dt>
                <dd className="mt-1 text-lg font-bold tabular-nums" style={{ color: RED }}>{czkCompact(live.graph.verifiedCzk)}</dd>
              </div>
            </motion.dl>
          ) : (
            <p className="mt-6 max-w-md border px-4 py-3 text-[12px] leading-relaxed" style={{ borderColor: RED, color: DIM }}>
              <span style={{ color: RED }}>úložiště není čitelné</span> — čísla ani vazby se nevydávají;
              níže běží zřetelně označený ilustrativní vzorek archivního směru.
            </p>
          )}
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.26 }}
            className="mt-8 flex flex-wrap gap-3 text-sm"
          >
            <a
              href="#r-graph"
              className="inline-flex items-center gap-2 px-5 py-3 font-bold uppercase tracking-wider transition-colors hover:bg-[#ffc95c]"
              style={{ background: AMBER, color: BG }}
            >
              Spustit trasování <ArrowRight className="h-4 w-4" aria-hidden />
            </a>
            <a
              href="#r-sources"
              className="inline-flex items-center gap-2 border px-5 py-3 uppercase tracking-wider transition-colors hover:border-[#ffb224] hover:text-[#ffb224]"
              style={{ borderColor: "#33404f", color: TEXT }}
            >
              Prohlédnout prameny
            </a>
          </motion.div>

          {/* Ověřené vazby — auditní výpis s účtenkou a paketem na řádku */}
          <div id="r-zebricek" className="mt-12 border" style={{ borderColor: HAIR, background: PANEL }}>
            <div
              className="flex items-center justify-between border-b px-4 py-2 text-[11px] uppercase tracking-widest"
              style={{ borderColor: HAIR, color: DIM }}
            >
              <span>ověřené vazby · lidská brána</span>
              <span className="hidden sm:inline">{live !== null ? `průchod ${czechInt(live.pass)} · ${live.retrievedOn}` : "bez záznamu"}</span>
            </div>
            {live !== null && live.ledger.length > 0 ? (
              <>
                {live.ledger.map((r, i) => (
                  <motion.div
                    key={r.key}
                    initial={reduceMotion ? false : { opacity: 0, x: -8 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.1 + i * 0.05 }}
                    className="grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 border-b px-4 py-2.5 text-sm last:border-b-0 hover:bg-[#141b24]"
                    style={{ borderColor: HAIR }}
                  >
                    <span className="font-bold tabular-nums" style={{ color: i < 3 ? AMBER : DIM }}>
                      #{i + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate" style={{ color: TEXT }}>
                        {r.mpName} <span style={{ color: DIM }}>{r.club ? `· ${r.club} ` : ""}↔ {r.company}</span>
                      </span>
                      <span className="block truncate text-[11px]" style={{ color: DIM }}>
                        IČO {r.ico} · {r.tieClassCs} ·{" "}
                        <a href={r.receiptHref} className="underline underline-offset-2 transition-colors hover:text-[#ffb224]">
                          účtenka /zdroj
                        </a>
                        {r.paketHref ? (
                          <>
                            {" · "}
                            <Link href={r.paketHref} className="underline underline-offset-2 transition-colors hover:text-[#ffb224]">
                              důkazní paket
                            </Link>
                          </>
                        ) : null}
                      </span>
                    </span>
                    <span className="w-24 text-right font-bold tabular-nums" style={{ color: r.czk > 0 ? RED : DIM }}>
                      {r.czkCs}
                    </span>
                  </motion.div>
                ))}
                <div className="px-4 py-2 text-[11px] uppercase tracking-widest" style={{ color: DIM }}>
                  Σ smlouvy + dotace firmy, disciplína /penize · plný výpis:{" "}
                  <Link href="/penize" className="underline underline-offset-2 transition-colors hover:text-[#ffb224]">
                    /penize
                  </Link>
                </div>
              </>
            ) : (
              <div className="px-4 py-6 text-[13px] leading-relaxed" style={{ color: DIM }}>
                {live !== null
                  ? "Žádná vazba zatím neprošla lidskou bránou — terminál nemá co vypsat a nic nepředstírá. Frontu ověřování vede /penize/kontrola."
                  : "Úložiště není čitelné — výpis ověřených vazeb se nevydává."}
              </div>
            )}
          </div>
        </div>

        <div id="r-graph" className="min-w-0">
          <MoneyGraph
            nodes={graphNodes}
            edges={graphEdges}
            live={graphIsLive}
            caption={
              live !== null && graphIsLive
                ? `graf entit · ${czechInt(live.graph.shownTies)} z ${czechInt(live.graph.verifiedCount)} ověřených vazeb`
                : "graf entit · ilustrativní vzorek (archiv)"
            }
          />
          {/* důkazní log */}
          <div className="mt-4 border" style={{ borderColor: HAIR, background: PANEL }}>
            <div
              className="flex items-center justify-between gap-3 border-b px-4 py-2 text-[11px] uppercase tracking-widest"
              style={{ borderColor: HAIR, color: DIM }}
            >
              <span>důkazní log — tail -f</span>
              <span style={{ color: tailIsLive ? GREEN : RED }}>
                {tailData !== null && tailIsLive
                  ? `živý záznam · review_audit ${czechInt(tailData.auditRows)} řádků`
                  : "ilustrativní vzorek"}
              </span>
            </div>
            <div className="overflow-x-auto px-4 py-3 text-[12.5px] leading-relaxed">
              {tail.map((l, i) => (
                <motion.p
                  key={l.id}
                  initial={reduceMotion ? false : { opacity: 0, x: -8 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.15 + i * 0.06 }}
                  className="whitespace-nowrap"
                >
                  <span style={{ color: DIM }}>{l.atCs}</span>{" "}
                  <span style={{ color: AMBER }}>[{l.source}]</span>{" "}
                  {l.href ? (
                    l.href.startsWith("/dukazy") ? (
                      <Link href={l.href} className="underline decoration-[#33404f] underline-offset-2 transition-colors hover:text-[#ffb224]">
                        {l.text}
                      </Link>
                    ) : (
                      <a href={l.href} className="underline decoration-[#33404f] underline-offset-2 transition-colors hover:text-[#ffb224]">
                        {l.text}
                      </a>
                    )
                  ) : (
                    <span>{l.text}</span>
                  )}{" "}
                  <span style={{ color: TONE_COLOR[l.tone] }}>« {l.flag} »</span>
                </motion.p>
              ))}
            </div>
            <div className="border-t px-4 py-2 text-[11px] uppercase tracking-widest" style={{ borderColor: HAIR, color: DIM }}>
              každý řádek = citační plocha ·{" "}
              <Link href="/dukazy" className="underline underline-offset-2 transition-colors hover:text-[#ffb224]">
                /dukazy
              </Link>{" "}
              ·{" "}
              <Link href="/denik" className="underline underline-offset-2 transition-colors hover:text-[#ffb224]">
                /denik
              </Link>
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
            {INSTRUMENTS.map((m, i) => (
              <motion.div
                key={m.key}
                initial={reduceMotion ? false : { opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ delay: i * 0.06 }}
                className="group relative flex flex-col justify-between p-5 transition-colors hover:bg-[#141b24]"
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
                <p className="mt-4 text-sm font-bold" style={{ color: AMBER }}>
                  <Link href={m.href} className="after:absolute after:inset-0 after:content-['']">
                    {m.href} →
                  </Link>
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Registr pramenů ──────────────────────────────────── */}
      <section id="r-sources" className="border-t" style={{ borderColor: HAIR }}>
        <div className="mx-auto max-w-6xl px-6 py-14">
          <h2 className="font-sans text-3xl font-black uppercase tracking-tight">Registr pramenů</h2>
          <p className="mt-2 max-w-2xl text-sm" style={{ color: DIM }}>
            Žádná magie se scrapováním — ověřené veřejné registry se známou kadencí a licencí.
            Každé tvrzení terminálu se dá doložit přímo v prameni; když feed vypadne, plocha to
            řekne — místo předstírání.
          </p>
          <div className="mt-6 overflow-x-auto border" style={{ borderColor: HAIR }}>
            <table className="w-full min-w-[40rem] text-left text-[13px]">
              <thead>
                <tr className="border-b text-[11px] uppercase tracking-widest" style={{ borderColor: HAIR, color: DIM }}>
                  <th className="px-4 py-2.5 font-medium">registr</th>
                  <th className="px-4 py-2.5 font-medium">obsah</th>
                  <th className="px-4 py-2.5 font-medium">kadence</th>
                  <th className="px-4 py-2.5 font-medium">přístup</th>
                  <th className="px-4 py-2.5 font-medium">stav</th>
                </tr>
              </thead>
              <tbody>
                {SOURCE_REGISTRY.map((s) => (
                  <tr key={s.name} className="border-b transition-colors hover:bg-[#141b24]" style={{ borderColor: HAIR }}>
                    <td className="px-4 py-2.5 font-bold">
                      <a href={s.href} className="transition-colors hover:text-[#ffc95c]" style={{ color: AMBER }}>
                        {s.name}
                      </a>
                    </td>
                    <td className="px-4 py-2.5" style={{ color: TEXT }}>{s.what}</td>
                    <td className="px-4 py-2.5" style={{ color: DIM }}>{s.cadence}</td>
                    <td className="px-4 py-2.5" style={{ color: DIM }}>{s.access}</td>
                    <td className="px-4 py-2.5" style={{ color: GREEN }}>● primární registr</td>
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
              doložená fakta, nikdy obvinění — každá hrana nese provenienci + datum a odkaz na účtenku.
            </p>
          </div>
          <Link
            href="/overeni"
            className="inline-flex items-center gap-2 px-5 py-3 text-sm font-bold uppercase tracking-wider transition-colors hover:bg-[#ffc95c]"
            style={{ background: AMBER, color: BG }}
          >
            Ověřit citaci <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </footer>
    </main>
  );
}
