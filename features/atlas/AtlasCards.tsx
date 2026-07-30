"use client";

/*
 * Řaditelné karty zdrojů atlasu (batch-6 item 6D). Klientská komponenta jen
 * kvůli řazení — data přicházejí hotová ze serveru (AtlasReport), nic se tu
 * nepočítá znovu, jen přerovnává. Bez animací (žádný reduced-motion dluh).
 *
 * Řadicí pravidlo (přiznané u ovládání): sestupně podle zvoleného skóre;
 * „nehodnoceno“ se řadí VŽDY za hodnocené — nehodnoceno není 0 ani při řazení.
 * Shodu rozhoduje klíč zdroje vzestupně, aby bylo pořadí deterministické.
 */

import { useMemo, useState } from "react";
import SourceNote from "@/features/shared/components/SourceNote";
import { czechDate, czechInt } from "@/lib/format";
import {
  ATLAS_DIMENSIONS,
  ATLAS_RULES,
  type AtlasDimension,
  type AtlasReport,
  type AtlasScore,
  type AtlasSourceCard,
} from "@/lib/analysis/atlas";

type SortKey = "composite" | AtlasDimension | "source";

const SORT_LABELS: Record<SortKey, string> = {
  composite: "souhrn",
  coverage: "pokrytí",
  freshness: "čerstvost",
  integrity: "integrita",
  completeness: "úplnost",
  source: "název",
};

const SORT_KEYS: readonly SortKey[] = ["composite", ...ATLAS_DIMENSIONS, "source"];

/** Hodnota pro řazení: hodnocené skóre, jinak null (řadí se za všechny hodnocené). */
function sortScore(card: AtlasSourceCard, key: SortKey): number | null {
  if (key === "source") return null;
  if (key === "composite") return card.composite.score;
  const d = card.dimensions[key];
  return d.status === "hodnoceno" ? d.score : null;
}

function sortCards(cards: readonly AtlasSourceCard[], key: SortKey): AtlasSourceCard[] {
  const byName = [...cards].sort((a, b) => (a.source < b.source ? -1 : a.source > b.source ? 1 : 0));
  if (key === "source") return byName;
  return byName.sort((a, b) => {
    const sa = sortScore(a, key);
    const sb = sortScore(b, key);
    if (sa === null && sb === null) return 0;
    if (sa === null) return 1; // nehodnocené vždy za hodnocenými
    if (sb === null) return -1;
    return sb - sa;
  });
}

function ScoreBadge({ score }: { score: AtlasScore }) {
  if (score.status === "nehodnoceno") {
    return (
      <span className="border border-hairline px-2 py-0.5 font-mono text-xs font-bold uppercase tracking-widest text-steel-aa">
        nehodnoceno
      </span>
    );
  }
  return (
    <span className="bg-ink px-2 py-0.5 font-mono text-sm font-black tabular-nums text-paper">
      {czechInt(score.score)}
      <span className="ml-0.5 text-xs font-bold text-paper/70">/100</span>
    </span>
  );
}

function DimensionRow({ dim, card }: { dim: AtlasDimension; card: AtlasSourceCard }) {
  const score = card.dimensions[dim];
  return (
    <div className="border-t border-hairline py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="font-mono text-xs font-bold uppercase tracking-widest">{ATLAS_RULES[dim].label}</p>
        <ScoreBadge score={score} />
      </div>
      <p className="mt-1 font-mono text-xs leading-relaxed text-steel-aa">
        {score.status === "hodnoceno" ? `podklad: ${score.basis}` : `důvod: ${score.reason}`}
      </p>
      {/* Vytištěné pravidlo — skóre bez pravidla na téhle stránce neexistuje. */}
      <p className="mt-1.5 border-l-2 border-hairline pl-2 text-xs leading-relaxed text-steel-aa">
        pravidlo: {ATLAS_RULES[dim].rule}
      </p>
    </div>
  );
}

function Card({ card }: { card: AtlasSourceCard }) {
  return (
    <article className="border-2 border-ink bg-paper p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="font-mono text-lg font-black">{card.source}</h3>
        {card.composite.score === null ? (
          <span className="border border-hairline px-2 py-0.5 font-mono text-xs font-bold uppercase tracking-widest text-steel-aa">
            souhrn nehodnocen
          </span>
        ) : (
          <span className="bg-signal-deep px-2 py-0.5 font-mono text-sm font-black tabular-nums text-paper">
            {czechInt(card.composite.score)}
            <span className="ml-0.5 text-xs font-bold text-paper/80">/100</span>
          </span>
        )}
      </div>
      <p className="mt-0.5 font-mono text-xs uppercase tracking-widest text-steel-aa">
        souhrn: {card.composite.status} · {czechInt(card.composite.evaluated)} ze {czechInt(card.composite.of)} dimenzí
        {card.freshness.staleness ? ` · ${card.freshness.staleness}` : ""}
      </p>
      {card.summary && <p className="mt-3 text-sm leading-relaxed text-steel-aa">{card.summary}</p>}

      <div className="mt-4">
        {ATLAS_DIMENSIONS.map((dim) => (
          <DimensionRow key={dim} dim={dim} card={card} />
        ))}
      </div>

      {/* Fakta pod skóre — čísla, ze kterých dimenze vycházejí. */}
      <dl className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 border-t border-hairline pt-3 font-mono text-xs text-steel-aa sm:grid-cols-4">
        <div>
          <dt className="font-bold uppercase tracking-widest">řádky</dt>
          <dd className="tabular-nums">{czechInt(card.rowsTotal)}</dd>
        </div>
        <div>
          <dt className="font-bold uppercase tracking-widest">s během</dt>
          <dd className="tabular-nums">{czechInt(card.rowsWithRun)}</dd>
        </div>
        <div>
          <dt className="font-bold uppercase tracking-widest">kadence</dt>
          <dd className="tabular-nums">
            {card.freshness.cadenceDays === null ? "nedeklarována" : `${czechInt(card.freshness.cadenceDays)} d`}
          </dd>
        </div>
        <div>
          <dt className="font-bold uppercase tracking-widest">poslední obnova</dt>
          <dd>{card.freshness.lastOkFinishedAt ? czechDate(card.freshness.lastOkFinishedAt) : "žádná"}</dd>
        </div>
      </dl>

      {card.knownIssues.length > 0 && (
        <details className="mt-3 border-t border-hairline pt-3">
          <summary className="cursor-pointer font-mono text-xs font-bold uppercase tracking-widest text-signal-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-cobalt">
            {czechInt(card.knownIssues.length)} přiznaných mezer upstreamu
          </summary>
          <ul className="mt-2 space-y-2">
            {card.knownIssues.map((issue) => (
              <li key={issue} className="border-l-2 border-hairline pl-2 text-xs leading-relaxed text-steel-aa">
                {issue}
              </li>
            ))}
          </ul>
          {card.contextProvenance && (
            <div className="mt-2">
              <SourceNote>provenience kontextu: {card.contextProvenance}</SourceNote>
            </div>
          )}
        </details>
      )}

      <div className="mt-3">
        <SourceNote>
          zdroj: entitní tabulky (provenance kvartet) + ingest_run (běhy, Merkle kořeny od
          LedgerRepository.sealIngestRun) + kontext zdroje (lib/analysis/context-model.ts)
        </SourceNote>
      </div>
    </article>
  );
}

export default function AtlasCards({ report }: { report: AtlasReport }) {
  const [sortKey, setSortKey] = useState<SortKey>("composite");
  const sorted = useMemo(() => sortCards(report.sources, sortKey), [report.sources, sortKey]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Řazení karet zdrojů">
        <span className="font-mono text-xs uppercase tracking-widest text-steel-aa">řadit podle:</span>
        {SORT_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setSortKey(key)}
            aria-pressed={sortKey === key}
            className={`border px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-wider transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-cobalt ${
              sortKey === key
                ? "border-ink bg-ink text-paper"
                : "border-ink text-ink hover:bg-paper-strong hover:text-signal"
            }`}
          >
            {SORT_LABELS[key]}
          </button>
        ))}
      </div>
      <div className="mt-2">
        <SourceNote>
          řadicí pravidlo: sestupně podle zvoleného skóre; „nehodnoceno“ se řadí za hodnocené —
          nehodnoceno není nula ani při řazení; shodu rozhoduje klíč zdroje
        </SourceNote>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {sorted.map((card) => (
          <Card key={card.source} card={card} />
        ))}
      </div>
    </div>
  );
}
