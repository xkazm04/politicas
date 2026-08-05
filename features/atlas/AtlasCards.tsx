"use client";

/*
 * Řaditelné karty zdrojů atlasu (batch-6 item 6D). Klientská komponenta jen
 * kvůli řazení — data přicházejí hotová ze serveru (AtlasReport), nic se tu
 * nepočítá znovu, jen přerovnává. Bez animací (žádný reduced-motion dluh).
 *
 * Řadicí pravidlo (přiznané u ovládání): sestupně podle zvoleného skóre;
 * „nehodnoceno“ se řadí VŽDY za hodnocené — nehodnoceno není 0 ani při řazení.
 * Shodu rozhoduje klíč zdroje vzestupně, aby bylo pořadí deterministické.
 *
 * COPY JE V KATALOGU (2026-08-05): štítky a věty žijí v messages/{cs,en}.json
 * pod `atlas.*`; strojové tokeny reportu (staleness, composite.status a texty
 * pravidel v ATLAS_RULES) zůstávají v lib/analysis/atlas.ts, protože je nese
 * i strojový /atlas/atlas.json — tady se jen mapují na klíče katalogu.
 * Podklad (`basis`) a důvod (`reason`) skóre přicházejí hotové z derivace.
 */

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import SourceNote from "@/features/shared/components/SourceNote";
import { formattersFor, type Formatters } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import {
  ATLAS_DIMENSIONS,
  type AtlasDimension,
  type AtlasReport,
  type AtlasScore,
  type AtlasSourceCard,
  type Staleness,
} from "@/lib/analysis/atlas";

/** Překladač namespace `atlas` — jediný typ, který si komponenty předávají. */
type T = ReturnType<typeof useTranslations<"atlas">>;

type SortKey = "composite" | AtlasDimension | "source";

const SORT_LABEL_KEYS: Record<SortKey, string> = {
  composite: "sort.composite",
  coverage: "sort.coverage",
  freshness: "sort.freshness",
  integrity: "sort.integrity",
  completeness: "sort.completeness",
  source: "sort.source",
};

const SORT_KEYS: readonly SortKey[] = ["composite", ...ATLAS_DIMENSIONS, "source"];

/** Strojové pásmo čerstvosti (sdílené s atlas.json) → klíč katalogu. */
const STALENESS_KEYS: Record<Staleness, string> = {
  "čerstvé": "staleness.fresh",
  "stárnoucí": "staleness.aging",
  "zastaralé": "staleness.stale",
};

/** Strojový stav souhrnu (sdílený s atlas.json) → klíč katalogu. */
const COMPOSITE_STATUS_KEYS: Record<AtlasSourceCard["composite"]["status"], string> = {
  hodnoceno: "compositeStatus.rated",
  "částečné": "compositeStatus.partial",
  nehodnoceno: "compositeStatus.unrated",
};

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

function ScoreBadge({ score, t, tCommon, f }: { score: AtlasScore; t: T; tCommon: (key: "of100") => string; f: Formatters }) {
  if (score.status === "nehodnoceno") {
    return (
      <span className="border border-hairline px-2 py-0.5 font-mono text-xs font-bold uppercase tracking-widest text-steel-aa">
        {t("score.unrated")}
      </span>
    );
  }
  return (
    <span className="bg-ink px-2 py-0.5 font-mono text-sm font-black tabular-nums text-paper">
      {f.int(score.score)}
      <span className="ml-0.5 text-xs font-bold text-paper/70">{tCommon("of100")}</span>
    </span>
  );
}

function DimensionRow({
  dim,
  card,
  t,
  tCommon,
  f,
}: {
  dim: AtlasDimension;
  card: AtlasSourceCard;
  t: T;
  tCommon: (key: "of100") => string;
  f: Formatters;
}) {
  const score = card.dimensions[dim];
  return (
    <div className="border-t border-hairline py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="font-mono text-xs font-bold uppercase tracking-widest">{t(`dimension.${dim}.label`)}</p>
        <ScoreBadge score={score} t={t} tCommon={tCommon} f={f} />
      </div>
      <p className="mt-1 font-mono text-xs leading-relaxed text-steel-aa">
        {score.status === "hodnoceno"
          ? t("card.basis", { basis: score.basis })
          : t("card.reason", { reason: score.reason })}
      </p>
      {/* Vytištěné pravidlo — skóre bez pravidla na téhle stránce neexistuje. */}
      <p className="mt-1.5 border-l-2 border-hairline pl-2 text-xs leading-relaxed text-steel-aa">
        {t("card.rule", { rule: t(`dimension.${dim}.rule`) })}
      </p>
    </div>
  );
}

function Card({
  card,
  t,
  tCommon,
  f,
}: {
  card: AtlasSourceCard;
  t: T;
  tCommon: (key: "of100") => string;
  f: Formatters;
}) {
  return (
    <article className="border-2 border-ink bg-paper p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="font-mono text-lg font-black">{card.source}</h3>
        {card.composite.score === null ? (
          <span className="border border-hairline px-2 py-0.5 font-mono text-xs font-bold uppercase tracking-widest text-steel-aa">
            {t("card.compositeUnrated")}
          </span>
        ) : (
          <span className="bg-signal-deep px-2 py-0.5 font-mono text-sm font-black tabular-nums text-paper">
            {f.int(card.composite.score)}
            <span className="ml-0.5 text-xs font-bold text-paper/80">{tCommon("of100")}</span>
          </span>
        )}
      </div>
      <p className="mt-0.5 font-mono text-xs uppercase tracking-widest text-steel-aa">
        {t("card.compositeLine", {
          status: t(COMPOSITE_STATUS_KEYS[card.composite.status]),
          evaluated: f.int(card.composite.evaluated),
          of: f.int(card.composite.of),
        })}
        {card.freshness.staleness ? ` · ${t(STALENESS_KEYS[card.freshness.staleness])}` : ""}
      </p>
      {card.summary && <p className="mt-3 text-sm leading-relaxed text-steel-aa">{card.summary}</p>}

      <div className="mt-4">
        {ATLAS_DIMENSIONS.map((dim) => (
          <DimensionRow key={dim} dim={dim} card={card} t={t} tCommon={tCommon} f={f} />
        ))}
      </div>

      {/* Fakta pod skóre — čísla, ze kterých dimenze vycházejí. */}
      <dl className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 border-t border-hairline pt-3 font-mono text-xs text-steel-aa sm:grid-cols-4">
        <div>
          <dt className="font-bold uppercase tracking-widest">{t("card.rows")}</dt>
          <dd className="tabular-nums">{f.int(card.rowsTotal)}</dd>
        </div>
        <div>
          <dt className="font-bold uppercase tracking-widest">{t("card.withRun")}</dt>
          <dd className="tabular-nums">{f.int(card.rowsWithRun)}</dd>
        </div>
        <div>
          <dt className="font-bold uppercase tracking-widest">{t("card.cadence")}</dt>
          <dd className="tabular-nums">
            {card.freshness.cadenceDays === null
              ? t("card.cadenceNone")
              : t("card.cadenceDays", { days: f.int(card.freshness.cadenceDays) })}
          </dd>
        </div>
        <div>
          <dt className="font-bold uppercase tracking-widest">{t("card.lastRefresh")}</dt>
          <dd>
            {card.freshness.lastOkFinishedAt
              ? f.date(card.freshness.lastOkFinishedAt)
              : t("card.lastRefreshNone")}
          </dd>
        </div>
      </dl>

      {card.knownIssues.length > 0 && (
        <details className="mt-3 border-t border-hairline pt-3">
          <summary className="cursor-pointer font-mono text-xs font-bold uppercase tracking-widest text-signal-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-cobalt">
            {t("card.knownIssues", { count: f.int(card.knownIssues.length) })}
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
              <SourceNote>
                {t("card.contextProvenance", { provenance: card.contextProvenance })}
              </SourceNote>
            </div>
          )}
        </details>
      )}

      <div className="mt-3">
        <SourceNote>{t("card.source")}</SourceNote>
      </div>
    </article>
  );
}

export default function AtlasCards({ report, locale }: { report: AtlasReport; locale: Locale }) {
  const t = useTranslations("atlas");
  const tCommon = useTranslations("common");
  const f = useMemo(() => formattersFor(locale), [locale]);
  const [sortKey, setSortKey] = useState<SortKey>("composite");
  const sorted = useMemo(() => sortCards(report.sources, sortKey), [report.sources, sortKey]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t("cards.sortGroup")}>
        <span className="font-mono text-xs uppercase tracking-widest text-steel-aa">{t("cards.sortBy")}</span>
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
            {t(SORT_LABEL_KEYS[key])}
          </button>
        ))}
      </div>
      <div className="mt-2">
        <SourceNote>{t("cards.sortRule")}</SourceNote>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {sorted.map((card) => (
          <Card key={card.source} card={card} t={t} tCommon={tCommon} f={f} />
        ))}
      </div>
    </div>
  );
}
