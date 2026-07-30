"use client";

/*
 * TRVALÁ CITACE POHLEDU NA GRAF — /graf/p/[ref].
 *
 * Citační infrastruktura pro novinařinu: stránka je STATICKÁ SAZBA pohledu
 * (žádné plátno, žádná interakce s grafem) + CITAČNÍ LIŠTA s otiskem obsahu,
 * datem znovuodvození, prameny a blokem „citovat" k vložení do článku.
 * Obsah přichází ze serveru už znovuodvozený (./getPermalinkData.ts); tahle
 * komponenta jen sází a drží jedinou interakci: kopírování s potvrzením
 * (vzor CopyExhibitLink, features/dashboard/ExhibitPage.tsx).
 *
 * DVĚ DOKTRÍNY, KTERÉ TU DRŽÍ CELÝ SLIB:
 *  - zastaralost se říká NAD obsahem (pravidlo Exponátu) — čtenář citace ji
 *    musí potkat dřív než důkazy;
 *  - stav lidské kontroly každé hrany (pending_review) přežívá do KAŽDÉHO
 *    formátu citace — sazby, JSON-LD i OG obrazu. Čárkovaná čára nesmí
 *    zmizet exportem.
 *
 * Copy je záměrně česky přímo v komponentě (vzor ExhibitPage): messages/*.json
 * je sdílený soubor napříč paralelně stavěnými plochami.
 */

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, Check, Copy, FileJson, Link2, Quote } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { compactCzk } from "@/features/money/moneyTypes";
import SectionRule from "@/features/shared/components/SectionRule";
import SourceNote from "@/features/shared/components/SourceNote";
import { useFormat } from "@/lib/i18n/useFormat";
import { formatSteps } from "./components/TrailFinder";
import { glyphPath, KIND_STYLE } from "./kindStyle";
import {
  citationLine,
  GRAPH_SOURCE_LINKS,
  HASH_ALGORITHM,
  permalinkPath,
  type PermalinkSourceLink,
  type PermalinkView,
} from "./permalink";
import type { GraphNode, NodeDetail, Trail } from "./graphTypes";

// ── Drobné stavební kameny ──────────────────────────────────────────────────

function NodeGlyph({ node, className = "h-3 w-3" }: { node: GraphNode; className?: string }) {
  const style = KIND_STYLE[node.kind];
  return (
    <svg viewBox="-12 -12 24 24" className={`${className} shrink-0`} aria-hidden>
      <path d={glyphPath(style.shape, 9)} fill={style.fill} />
    </svg>
  );
}

function PendingBadge() {
  const tcom = useTranslations("common");
  return (
    <span className="shrink-0 border border-dashed border-steel px-1 py-px font-mono text-[11px] lowercase tracking-wider text-steel-aa">
      {tcom("pendingReview")}
    </span>
  );
}

/** Kopírovací tlačítko s potvrzením — text přichází hotový, adresa se skládá
 *  až při kliknutí z window.location.origin (SSR nikdy nesází neznámý origin). */
function CopyButton({
  label,
  icon: Icon,
  makeText,
}: {
  label: string;
  icon: typeof Copy;
  makeText: () => string;
}) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(makeText());
      setState("copied");
    } catch (err) {
      // Schránka může být zakázaná (permissions, http) — text je vypsaný
      // hned vedle, takže selhání jen pojmenujeme a necháme ruční cestu.
      console.error("trvalá citace: kopírování selhalo", err);
      setState("failed");
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 2600);
  };

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={copy}
        className="inline-flex items-center gap-1.5 border border-ink px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-wider text-ink transition-colors hover:bg-paper-strong hover:text-signal focus-visible:outline focus-visible:outline-2 focus-visible:outline-cobalt"
      >
        <Icon className="h-3.5 w-3.5" aria-hidden /> {label}
      </button>
      <span role="status" aria-live="polite" className="min-h-[1rem]">
        {state === "copied" && (
          <span className="inline-flex items-center gap-1 font-mono text-xs font-bold uppercase tracking-wider text-cobalt">
            <Check className="h-3.5 w-3.5" aria-hidden /> zkopírováno
          </span>
        )}
        {state === "failed" && (
          <span className="font-mono text-xs uppercase tracking-wider text-signal-deep">
            nezdařilo se — vyberte text ručně
          </span>
        )}
      </span>
    </span>
  );
}

// ── Sazba obsahu podle druhu pohledu ────────────────────────────────────────

/** Spočítaná cesta „Spoj dva body" jako statická účetní kniha. */
function CestaExhibit({
  view,
}: {
  view: Extract<PermalinkView, { kind: "cesta" }>;
}) {
  const t = useTranslations("graph");
  const f = useFormat();
  const locale = useLocale();
  const trail = view.trail;

  return (
    <div className="border-2 border-ink bg-paper">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b-2 border-ink px-5 py-3">
        <span className="flex min-w-0 items-center gap-2">
          <NodeGlyph node={view.from} />
          <span className="truncate text-sm font-black uppercase tracking-tight">{view.from.label}</span>
        </span>
        <span className="font-mono text-[11px] uppercase tracking-widest text-steel-aa">→</span>
        <span className="flex min-w-0 items-center gap-2">
          <NodeGlyph node={view.to} />
          <span className="truncate text-sm font-black uppercase tracking-tight">{view.to.label}</span>
        </span>
      </div>

      {trail === null ? (
        <div className="px-5 py-8">
          <p className="max-w-2xl text-xl font-black leading-snug tracking-tight">
            Dnešní graf už tuto cestu nedokládá<span className="text-signal">.</span>
          </p>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-steel-aa">
            Citace odkazovala na spočítanou důkazní cestu; podkladová data se od vydání změnila a
            stejně krátká cesta pod tímto pořadím dnes neexistuje. Nic podobného se nedosazuje —
            citace buď odpovídá vydanému otisku, nebo to řekne.
          </p>
        </div>
      ) : (
        <>
          <p className="border-b border-hairline px-5 py-2 font-mono text-[11px] uppercase tracking-widest text-steel-aa">
            {formatSteps(trail.hops, f.int(trail.hops))} ·{" "}
            {trail.pendingCount === 0
              ? "vše ověřeno"
              : trail.pendingCount === 1
                ? "1 hrana čeká na kontrolu"
                : `${f.int(trail.pendingCount)} hran čeká na kontrolu`}
            {trail.moneyCzk > 0 && (
              <span className="block text-cobalt">doloženo {compactCzk(trail.moneyCzk, locale)} ve smlouvách</span>
            )}
          </p>
          <ol>
            <li className="flex items-center gap-2 border-b border-hairline px-5 py-2.5">
              <span className="w-9 shrink-0 font-mono text-[11px] uppercase tracking-wider text-steel-aa">/0</span>
              <NodeGlyph node={view.from} />
              <span className="min-w-0 flex-1 truncate text-sm font-bold">{view.from.label}</span>
            </li>
            {trail.ledger.map((row) => (
              <li key={row.step} className="border-b border-hairline px-5 py-2.5">
                <span className="flex items-center gap-2">
                  <span className="w-9 shrink-0 font-mono text-[11px] uppercase tracking-wider text-steel-aa">
                    /{f.int(row.step)}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-mono text-[11px] lowercase tracking-wider text-signal-deep">
                    → {t(`rels.${row.rel}`)}
                  </span>
                  {row.moneyCzk !== null && (
                    <span className="shrink-0 font-mono text-[11px] tabular-nums text-cobalt">
                      {compactCzk(row.moneyCzk, locale)}
                    </span>
                  )}
                  {row.pending && <PendingBadge />}
                </span>
                <span className="mt-0.5 flex items-center gap-2 pl-11">
                  <NodeGlyph node={row.to} />
                  <span className="min-w-0 flex-1 truncate text-sm font-bold">{row.to.label}</span>
                  <span className="shrink-0 font-mono text-[11px] uppercase tracking-wider text-steel-aa">
                    {t(`kinds.${row.to.kind}`)}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </>
      )}

      {/* Otištěné pravidlo — bez něj by generovaná cesta byla obvinění. */}
      <div className="px-5 py-2.5">
        <SourceNote>
          Pravidlo řazení: nejkratší cesta důkazními hranami (společné hlasování se nepoužívá),
          nejvýše {formatSteps(view.maxCost, f.int(view.maxCost))}; uzel s {f.int(view.hubDegree)} a
          více hranami se počítá za dva kroky. Při shodě vyhrává méně neověřených hran, pak vyšší
          smluvní částka, pak abeceda.{" "}
          {view.totalFound === 1
            ? "Nalezena 1 nejkratší cesta."
            : `Nalezeno ${f.int(view.totalFound)}${view.capped ? " a více" : ""} stejně krátkých cest.`}
        </SourceNote>
      </div>
    </div>
  );
}

/** Kurátorská trasa ve sloupcové sazbě (statická obdoba VariantTrasy). */
function TrasaExhibit({ trail }: { trail: Trail }) {
  const t = useTranslations("graph");
  const tt = useTranslations("graph.trasy");
  const f = useFormat();
  const locale = useLocale();

  const pendingEdges = trail.edges.filter((e) => e.pending).length;
  const columns = trail.columns.map((kind, i) => ({
    kind,
    nodes: trail.nodes.filter((n) => n.column === i).sort((a, b) => a.order - b.order),
  }));

  return (
    <div className="border-2 border-ink bg-paper">
      <div className="border-b-2 border-ink px-5 py-3">
        <p className="text-lg font-black uppercase leading-tight tracking-tight">
          {tt(`trails.${trail.key}.title`)}
        </p>
        <p className="mt-1 text-[13px] leading-snug text-steel">{tt(`trails.${trail.key}.lead`)}</p>
      </div>
      <p className="border-b border-hairline px-5 py-2 font-mono text-[11px] uppercase tracking-widest text-steel-aa">
        {t("counts", { nodes: f.int(trail.nodes.length), edges: f.int(trail.edges.length) })}
        {pendingEdges > 0 && (
          <span className="block">
            {pendingEdges === 1 ? "1 hrana čeká na kontrolu" : `${f.int(pendingEdges)} hran čeká na kontrolu`}
          </span>
        )}
      </p>
      <div className="grid gap-px bg-hairline sm:grid-cols-2 lg:grid-cols-3">
        {columns.map((col, i) => (
          <div key={i} className="bg-paper px-5 py-3">
            <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-steel-aa">
              {t(`kinds.${col.kind}`)}
            </p>
            <ul className="mt-2 space-y-1.5">
              {col.nodes.map((n) => (
                <li key={n.id} className="flex items-baseline gap-2">
                  <NodeGlyph node={n} className="h-2.5 w-2.5 translate-y-px" />
                  <span className="min-w-0 flex-1 truncate text-sm font-bold">{n.label}</span>
                  {n.moneyCzk !== undefined && (
                    <span className="shrink-0 font-mono text-[11px] tabular-nums text-cobalt">
                      {compactCzk(n.moneyCzk, locale)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-hairline px-5 py-2.5">
        <SourceNote>{tt(`trails.${trail.key}.source`)}</SourceNote>
      </div>
    </div>
  );
}

/** Jeden uzel grafu — statický štítek s fakty, registry a proveniencí. */
function UzelExhibit({ detail }: { detail: NodeDetail }) {
  const t = useTranslations("graph");
  const f = useFormat();
  const { node, provenance, links, facts, citableId, degree } = detail;

  return (
    <div className="border-2 border-ink bg-paper">
      <div className="border-b-2 border-ink px-5 py-4">
        <p className="flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-widest text-steel">
          <NodeGlyph node={node} />
          {t(`kinds.${node.kind}`)}
        </p>
        <p className="mt-1 text-2xl font-black uppercase leading-tight tracking-tight">{node.label}</p>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 border-b border-hairline px-5 py-2.5 font-mono text-[11px] uppercase tracking-widest text-steel">
        <span>
          {t("inspector.degree")}: <span className="font-bold text-ink">{f.int(degree)}</span>
        </span>
        {citableId && (
          <span>
            {t("inspector.identifier")}: <span className="font-bold text-ink">{citableId}</span>
          </span>
        )}
      </div>
      {facts.length > 0 && (
        <dl className="border-b border-hairline px-5 py-3">
          {facts.map((fact) => (
            <div key={fact.label} className="flex items-baseline justify-between gap-4 py-1">
              <dt className="font-mono text-[11px] uppercase tracking-wider text-steel">{fact.label}</dt>
              <dd className="text-right text-sm font-bold tabular-nums">{fact.value}</dd>
            </div>
          ))}
        </dl>
      )}
      <div className="border-b border-hairline px-5 py-3">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-signal">
          {t("inspector.registries")}
        </p>
        {links.length === 0 ? (
          <p className="mt-2 text-sm leading-relaxed text-steel">{t(`inspector.noSource.${node.kind}`)}</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {links.map((l) => (
              <li key={l.url}>
                <a
                  href={l.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="flex items-baseline justify-between gap-2 text-sm transition-colors hover:text-signal"
                >
                  <span className="min-w-0 truncate font-medium underline decoration-hairline underline-offset-2">
                    {l.registry}
                  </span>
                  <span className="shrink-0 font-mono text-[11px] uppercase tracking-wider text-steel">
                    {t(`inspector.tier.${l.tier}`)}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="px-5 py-3">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-steel">
          {t("inspector.provenance")}
        </p>
        <div className="mt-2 space-y-1 font-mono text-[11px] uppercase tracking-wider text-steel">
          {provenance.method && (
            <p>
              {t("inspector.method")}:{" "}
              <span className={provenance.method === "deterministic" ? "font-bold text-cobalt" : "font-bold text-ochre"}>
                {t(`inspector.methodValue.${provenance.method === "deterministic" ? "deterministic" : "verdict"}`)}
              </span>
            </p>
          )}
          {provenance.pass !== null && <p>pass {provenance.pass}</p>}
          {provenance.ref && <p className="break-all normal-case">{provenance.ref}</p>}
          {provenance.computedAt && <p>{f.date(provenance.computedAt.slice(0, 10))}</p>}
          {!provenance.method && !provenance.ref && <p>{t("inspector.noProvenance")}</p>}
        </div>
      </div>
    </div>
  );
}

// ── Citační lišta ───────────────────────────────────────────────────────────

function CitationRail({ view }: { view: PermalinkView }) {
  const f = useFormat();
  const path = permalinkPath(view.ref);
  const sources: PermalinkSourceLink[] =
    view.kind === "uzel" && view.detail.links.length > 0
      ? view.detail.links.map((l) => ({ label: l.registry, href: l.url }))
      : GRAPH_SOURCE_LINKS;

  const makeUrl = () => new URL(path, window.location.origin).toString();
  const makeCitation = () =>
    citationLine({
      title: view.title,
      retrievedOn: f.date(view.retrievedOn),
      url: makeUrl(),
      hash: view.currentHash,
    });

  return (
    <aside aria-label="citace" className="border-2 border-ink bg-paper">
      <p className="border-b-2 border-ink px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.25em] text-signal">
        citace
      </p>

      <div className="border-b border-hairline px-4 py-3">
        <p className="font-mono text-xs font-bold uppercase tracking-widest text-ink">otisk obsahu</p>
        <p className="mt-1.5 font-mono text-xs text-steel-aa">
          {HASH_ALGORITHM} <span className="font-bold text-ink">{view.currentHash}</span>
          {!view.fresh && <> · v adrese: {view.urlHash}</>}
        </p>
        <p className="mt-1 font-mono text-xs text-steel-aa">data získána {f.date(view.retrievedOn)}</p>
      </div>

      <div className="border-b border-hairline px-4 py-3">
        <p className="font-mono text-xs font-bold uppercase tracking-widest text-ink">prameny</p>
        <ul className="mt-1.5 space-y-1">
          {sources.map((s) => (
            <li key={s.href}>
              <a
                href={s.href}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-xs text-cobalt underline decoration-hairline underline-offset-2 transition-colors hover:text-signal"
              >
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </div>

      <div className="border-b border-hairline px-4 py-3">
        <p className="flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-widest text-ink">
          <Quote className="h-3.5 w-3.5 text-signal" aria-hidden /> citovat
        </p>
        <p className="mt-2 border border-hairline bg-paper-strong px-3 py-2 text-[13px] leading-relaxed">
          „{view.title}“ — politicas, znalostní graf české politiky. Získáno {f.date(view.retrievedOn)}
          . <span className="break-all font-mono text-xs">{path}</span> · otisk {HASH_ALGORITHM}{" "}
          <span className="font-mono text-xs">{view.currentHash}</span>.
        </p>
        <div className="mt-2 flex flex-col items-start gap-2">
          <CopyButton label="kopírovat citaci" icon={Copy} makeText={makeCitation} />
          <CopyButton label="kopírovat odkaz" icon={Link2} makeText={makeUrl} />
        </div>
      </div>

      <div className="px-4 py-3">
        <a
          href={`${path}/bundle`}
          className="inline-flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-cobalt transition-colors hover:text-signal"
        >
          <FileJson className="h-3.5 w-3.5" aria-hidden /> balíček důkazů (JSON-LD)
        </a>
        <p className="mt-1 text-[11px] leading-snug text-steel-aa">
          strojově čitelný výpis tvrzení se stavem lidské kontroly každé hrany
        </p>
      </div>
    </aside>
  );
}

// ── Stránky ─────────────────────────────────────────────────────────────────

export default function PermalinkPage({ view }: { view: PermalinkView }) {
  const f = useFormat();
  const reduceMotion = useReducedMotion();

  return (
    <main className="min-h-screen bg-paper font-sans text-ink">
      <header className="border-b-4 border-ink">
        <div className="flex items-center justify-between gap-4 px-6 py-3.5">
          <span className="font-mono text-xs uppercase tracking-widest text-steel-aa">
            <Link href="/graf" className="transition-colors hover:text-signal">
              politicas / graf
            </Link>{" "}
            / trvalá citace
          </span>
          <SourceNote className="hidden sm:block">
            znovuodvozeno ze znalostního grafu · {f.date(view.retrievedOn)}
          </SourceNote>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 pb-16">
        <div className="py-10">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.25em] text-signal">
            trvalá citace <span className="text-steel-aa">č. {view.currentHash}</span>
          </p>
          <motion.h1
            initial={reduceMotion ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-2 max-w-4xl text-3xl font-black uppercase leading-[0.95] tracking-tight sm:text-5xl"
          >
            {view.title}
            <span className="text-signal">.</span>
          </motion.h1>
          <div className="mt-3 max-w-md">
            <SectionRule />
          </div>
          <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-steel-aa">
            Citovatelný pohled na znalostní graf: adresa nese celý stav pohledu i otisk důkazů v
            okamžiku vydání — stránka obsah při každém zobrazení deterministicky odvodí znovu z
            registrů a případný rozdíl proti citované verzi přizná.
          </p>
        </div>

        {/* Zastaralost se říká NAD obsahem — čtenář citace ji musí potkat
            dřív než důkazy (pravidlo Exponátu). */}
        {!view.fresh && (
          <div className="mb-6 border-2 border-signal bg-paper-strong px-4 py-3">
            <SourceNote tone="signal">
              obsah se od vydání tohoto odkazu změnil — otisk v adrese {view.urlHash} ≠ dnešní otisk{" "}
              {view.currentHash}; zobrazeno je dnešní znovuodvození, ne to citované
            </SourceNote>
          </div>
        )}

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="min-w-0">
            {view.kind === "cesta" && <CestaExhibit view={view} />}
            {view.kind === "trasa" && <TrasaExhibit trail={view.trail} />}
            {view.kind === "uzel" && <UzelExhibit detail={view.detail} />}
          </div>
          <CitationRail view={view} />
        </div>

        <div className="mt-10">
          <Link
            href="/graf"
            className="inline-flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-cobalt transition-colors hover:text-signal"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> otevřít plátno grafu
          </Link>
        </div>
      </div>
    </main>
  );
}

/** Čitelná adresa, kterou dnešní graf už nedokládá — poctivé přiznání
 *  (vzor ReceiptGonePage, features/shared/provenance/ReceiptPage.tsx). */
export function PermalinkGonePage({ urlHash, retrievedOn }: { urlHash: string; retrievedOn: string }) {
  const f = useFormat();
  return (
    <main className="min-h-screen bg-paper font-sans text-ink">
      <header className="border-b-4 border-ink">
        <div className="flex items-center justify-between gap-4 px-6 py-3.5">
          <span className="font-mono text-xs uppercase tracking-widest text-steel-aa">
            politicas / graf / trvalá citace
          </span>
        </div>
      </header>
      <div className="mx-auto max-w-3xl px-6 py-16">
        <div className="border-2 border-ink bg-paper px-5 py-10 sm:px-10 sm:py-14">
          <p className="max-w-2xl text-2xl font-black leading-snug tracking-tight sm:text-3xl">
            Tento pohled už dnešní graf nedokládá<span className="text-signal">.</span>
          </p>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-steel-aa">
            Adresa je čitelná a kdysi nesla doložený pohled, ale znalostní graf se přepočítává
            dávkou a citovaný uzel, trasa nebo cesta v dnešním sestavení není. Nic podobného se
            nedosazuje: citace buď odpovídá vydanému otisku, nebo to řekne.
          </p>
          <SourceNote className="mt-6">
            otisk v adrese: {HASH_ALGORITHM} {urlHash} · znovuodvozeno {f.date(retrievedOn)}
          </SourceNote>
        </div>
        <div className="mt-8">
          <Link
            href="/graf"
            className="inline-flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-cobalt transition-colors hover:text-signal"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> otevřít plátno grafu
          </Link>
        </div>
      </div>
    </main>
  );
}
