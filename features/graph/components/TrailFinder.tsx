"use client";

/*
 * SPOJ DVA BODY — panel důkazní cesty nad mapou grafu.
 *
 * Čtenář vybere dva uzly (našeptávačem — jedinou klávesnicovou cestou k
 * plátnu) a server spočítá nejkratší doložené cesty hranami grafu. Panel je
 * ÚČETNÍ KNIHA té odpovědi: každý krok = jeden sazený řádek s relací, částkou
 * a stavem kontroly; klik na řádek otevře inspektor uzlu s provenience a
 * odkazy do registrů — stejná dohledatelnost jako u všeho ostatního.
 *
 * DVĚ DOKTRÍNY, KTERÉ SE TU NESMÍ ZTRATIT:
 *  - pravidlo řazení se ČTENÁŘI TISKNE (viz ruleNote) — jinak by generovaná
 *    cesta byla implicitní obvinění; konstanty bere z výsledku, nehádá je;
 *  - „žádná cesta" je plnohodnotná, poctivá odpověď, ne chybová hláška.
 *
 * Texty jsou záměrně lokální konstanty, ne messages/*.json: katalog překladů
 * je sdílený soubor mimo výhradní plochu téhle feature (paralelní stavba,
 * batch 1) — precedens je lešení variant v GraphPage.tsx. Aplikace je
 * Czech-first; až se katalog otevře, řádky se přestěhují beze změny UI.
 */

import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { Waypoints, X } from "lucide-react";
import { compactCzk } from "@/features/money/moneyTypes";
import SourceNote from "@/features/shared/components/SourceNote";
import { useFormat } from "@/lib/i18n/useFormat";
import { glyphPath, KIND_STYLE } from "../kindStyle";
import NodeSearch from "./NodeSearch";
import type { GraphNode, PathQueryResult, SearchHit } from "../graphTypes";

const COPY = {
  title: "Spoj dva body",
  intro: "Vyberte dva uzly — plátno rozsvítí nejkratší doloženou cestu mezi nimi, krok za krokem.",
  fromLabel: "odkud",
  toLabel: "kam",
  fromPlaceholder: "výchozí uzel — hledat…",
  toPlaceholder: "cílový uzel — hledat…",
  clearSlot: "zrušit tento uzel",
  reset: "zrušit spojení",
  working: "hledám doloženou cestu…",
  unavailable: "hledání cest není v tomhle běhu dostupné — čeká na připojený datový sklad",
  emptyTitle: "žádná doložená cesta",
  empty: (steps: string) =>
    `Mezi vybranými uzly nevede do ${steps} žádná cesta doloženými hranami grafu. I to je zjištění: spojení v našich datech doložené není.`,
  pathTab: (n: string) => `cesta ${n}`,
  pathAria: (n: string) => `zobrazit cestu ${n}`,
  startRow: "výchozí bod",
  stepRow: (n: string) => `krok ${n}`,
  summary: (steps: string, pending: string) => `${steps} · ${pending}`,
  pendingNone: "vše ověřeno",
  pendingSome: (n: string) => `${n} hran čeká na kontrolu`,
  pendingOne: "1 hrana čeká na kontrolu",
  moneySum: (czk: string) => `doloženo ${czk} ve smlouvách`,
  rule: (hub: string, steps: string, found: string) =>
    `Pravidlo řazení: nejkratší cesta důkazními hranami (společné hlasování se nepoužívá), nejvýše ${steps}; uzel s ${hub} a více hranami se počítá za dva kroky, aby cesta nevedla přes největší uzly. Při shodě vyhrává méně neověřených hran, pak vyšší smluvní částka, pak abeceda. ${found}`,
  found: (n: string, capped: boolean) => `Nalezeno ${n}${capped ? " a více" : ""} stejně krátkých cest.`,
  foundOne: "Nalezena 1 nejkratší cesta.",
} as const;

/** Česká množná čísla kroků — 1 krok, 2–4 kroky, 5+ kroků. */
export function formatSteps(n: number, formatted?: string): string {
  const word = n === 1 ? "krok" : n >= 2 && n <= 4 ? "kroky" : "kroků";
  return `${formatted ?? String(n)} ${word}`;
}

function NodeGlyph({ node }: { node: GraphNode }) {
  const style = KIND_STYLE[node.kind];
  return (
    <svg viewBox="-12 -12 24 24" className="h-3 w-3 shrink-0" aria-hidden>
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

/** Vybraný koncový bod — papírový štítek s tvarem druhu a křížkem. */
function SlotChip({ hit, onClear }: { hit: SearchHit; onClear: () => void }) {
  const t = useTranslations("graph");
  const style = KIND_STYLE[hit.kind];
  return (
    <div className="flex items-center gap-2 border-2 border-ink bg-paper-strong px-3 py-2">
      <svg viewBox="-12 -12 24 24" className="h-3 w-3 shrink-0" aria-hidden>
        <path d={glyphPath(style.shape, 9)} fill={style.fill} />
      </svg>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold">{hit.label}</span>
        <span className="font-mono text-[11px] uppercase tracking-wider text-steel-aa">
          {t(`kinds.${hit.kind}`)}
        </span>
      </span>
      <button
        type="button"
        onClick={onClear}
        aria-label={COPY.clearSlot}
        className="shrink-0 border border-hairline p-1 text-steel transition-colors hover:border-ink hover:text-signal"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

export default function TrailFinder({
  from,
  to,
  result,
  activeIdx,
  revealed,
  onPickFrom,
  onPickTo,
  onClearFrom,
  onClearTo,
  onReset,
  onPickPath,
  onHopFocus,
}: {
  from: SearchHit | null;
  to: SearchHit | null;
  result: PathQueryResult | null | "loading";
  /** Index zobrazené cesty (vítěz = 0, alternativy dál). */
  activeIdx: number;
  /** Kolik kroků už čočka rozsvítila — řádky se rozsvěcují s ní. */
  revealed: number;
  onPickFrom: (hit: SearchHit) => void;
  onPickTo: (hit: SearchHit) => void;
  onClearFrom: () => void;
  onClearTo: () => void;
  onReset: () => void;
  onPickPath: (idx: number) => void;
  /** Klik na řádek knihy: vybrat uzel (inspektor) + najet na něj plátnem. */
  onHopFocus: (nodeId: string) => void;
}) {
  const t = useTranslations("graph");
  const f = useFormat();
  const locale = useLocale();

  const done = result !== null && result !== "loading" ? result : null;
  const active = done && done.status === "ok" ? (done.paths[activeIdx] ?? done.paths[0] ?? null) : null;

  return (
    <div className="border-2 border-ink bg-paper">
      <div className="flex items-center justify-between gap-2 border-b-2 border-ink px-3 py-1.5">
        <span className="flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-widest">
          <Waypoints className="h-3.5 w-3.5 text-signal" />
          {COPY.title}
        </span>
        {(from || to) && (
          <button
            type="button"
            onClick={onReset}
            className="font-mono text-[11px] uppercase tracking-wider text-steel-aa transition-colors hover:text-signal"
          >
            {COPY.reset}
          </button>
        )}
      </div>

      {!done && result !== "loading" && (
        <p className="border-b border-hairline px-3 py-2 text-[13px] leading-snug text-steel">{COPY.intro}</p>
      )}

      {/* Dva sloty — našeptávač je jediná klávesnicová cesta k uzlům. */}
      <div className="space-y-2 px-3 py-2.5">
        <div>
          <p className="mb-1 font-mono text-[11px] font-bold uppercase tracking-widest text-steel-aa">
            {COPY.fromLabel}
          </p>
          {from ? (
            <SlotChip hit={from} onClear={onClearFrom} />
          ) : (
            <NodeSearch placeholder={COPY.fromPlaceholder} onPick={onPickFrom} />
          )}
        </div>
        <div>
          <p className="mb-1 font-mono text-[11px] font-bold uppercase tracking-widest text-steel-aa">
            {COPY.toLabel}
          </p>
          {to ? (
            <SlotChip hit={to} onClear={onClearTo} />
          ) : (
            <NodeSearch placeholder={COPY.toPlaceholder} onPick={onPickTo} />
          )}
        </div>
      </div>

      {result === "loading" && (
        <p className="border-t border-hairline px-3 py-3 font-mono text-[11px] uppercase tracking-widest text-steel-aa">
          {COPY.working}
        </p>
      )}

      {done && done.status === "unavailable" && (
        <p className="border-t border-hairline px-3 py-3 text-[13px] leading-snug text-steel">
          {COPY.unavailable}
        </p>
      )}

      {/* Poctivá prázdnota — absence doložené cesty je taky odpověď. */}
      {done && done.status === "ok" && done.paths.length === 0 && (
        <div className="border-t-2 border-ink px-3 py-3">
          <p className="font-mono text-[11px] font-bold uppercase tracking-widest">
            {COPY.emptyTitle}
            <span className="text-signal">.</span>
          </p>
          <p className="mt-1.5 text-[13px] leading-snug text-steel">
            {COPY.empty(formatSteps(done.maxCost, f.int(done.maxCost)))}
          </p>
          <SourceNote className="mt-2">
            {COPY.rule(f.int(done.hubDegree), formatSteps(done.maxCost, f.int(done.maxCost)), "")}
          </SourceNote>
        </div>
      )}

      {done && done.status === "ok" && active && (
        <div className="border-t-2 border-ink">
          {/* Alternativy: stejně krátké cesty v otištěném pořadí. */}
          {done.paths.length > 1 && (
            <div className="flex items-stretch gap-px border-b border-hairline bg-ink">
              {done.paths.map((p, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onPickPath(i)}
                  aria-pressed={i === activeIdx}
                  aria-label={COPY.pathAria(f.int(i + 1))}
                  className={`flex-1 px-2 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider transition-colors ${
                    i === activeIdx ? "bg-signal-deep text-paper" : "bg-paper text-steel-aa hover:bg-paper-strong"
                  }`}
                >
                  {COPY.pathTab(f.int(i + 1))}
                  <span className="ml-1 font-normal normal-case">
                    {p.pendingCount > 0 ? `· ${f.int(p.pendingCount)}?` : ""}
                  </span>
                </button>
              ))}
            </div>
          )}

          <p className="border-b border-hairline px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest text-steel-aa">
            {COPY.summary(
              formatSteps(active.hops, f.int(active.hops)),
              active.pendingCount === 0
                ? COPY.pendingNone
                : active.pendingCount === 1
                  ? COPY.pendingOne
                  : COPY.pendingSome(f.int(active.pendingCount)),
            )}
            {active.moneyCzk > 0 && (
              <span className="block text-cobalt">{COPY.moneySum(compactCzk(active.moneyCzk, locale))}</span>
            )}
          </p>

          {/* Účetní kniha cesty: výchozí bod + řádek na každý krok. */}
          <ol className="max-h-[30vh] overflow-y-auto">
            {active.ledger.length > 0 && (
              <li>
                <button
                  type="button"
                  onClick={() => onHopFocus(active.ledger[0].from.id)}
                  className="flex w-full items-center gap-2 border-b border-hairline px-3 py-2 text-left transition-colors hover:bg-paper-strong"
                >
                  <span className="w-9 shrink-0 font-mono text-[11px] uppercase tracking-wider text-steel-aa">
                    /0
                  </span>
                  <NodeGlyph node={active.ledger[0].from} />
                  <span className="min-w-0 flex-1 truncate text-sm font-bold">{active.ledger[0].from.label}</span>
                </button>
              </li>
            )}
            {active.ledger.map((row, i) => {
              const lit = i < revealed;
              return (
                <li key={row.step}>
                  <button
                    type="button"
                    onClick={() => onHopFocus(row.to.id)}
                    aria-label={`${COPY.stepRow(f.int(row.step))}: ${row.from.label} → ${row.to.label}`}
                    className={`w-full border-b border-hairline px-3 py-2 text-left transition-opacity duration-300 hover:bg-paper-strong ${
                      lit ? "opacity-100" : "opacity-40"
                    }`}
                  >
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
                  </button>
                </li>
              );
            })}
          </ol>

          {/* Otištěné pravidlo — bez něj by generovaná cesta byla obvinění. */}
          <div className="border-t border-hairline px-3 py-2">
            <SourceNote>
              {COPY.rule(
                f.int(done.hubDegree),
                formatSteps(done.maxCost, f.int(done.maxCost)),
                done.totalFound === 1 ? COPY.foundOne : COPY.found(f.int(done.totalFound), done.capped),
              )}
            </SourceNote>
          </div>
        </div>
      )}
    </div>
  );
}
