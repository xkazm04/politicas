"use client";

/**
 * Plný žebříček 207 poslanců (REÁLNÁ DATA) — filtr po klubech, hledání a výběr
 * dvou poslanců do souboje. Každý řádek odkazuje na spis /poslanec/<pspId>.
 * Žádná dogenerovaná jména — všech 207 je skutečných.
 *
 * Manifestation pass (2026-07-25): řádek nese ikonu dosieru
 * (effortHasDossier), přibyl souhrnný filtr "jen s dosierem" a kompaktní/
 * rozšířený přepínač řádků.
 *
 * UX audit (2026-07-27, #8) removed the per-row six-segment MiniBreakdown: at
 * 207 rows it rendered ~1 533 SVG paths and the segments were too close in
 * width to tell apart (the top ~50 MPs share near-identical Práce/Legislativa/
 * Sál bars; rank actually hinged on a 1-point Docházka difference invisible at
 * that scale). Replaced with one text stat — the single component where this
 * MP deviates furthest from the chamber median — which states the thing that
 * actually explains the row instead of drawing six bars a reader can't
 * compare. The full six-segment breakdown stays on the profile page, which
 * has room for it (DESIGN.md §5).
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";
import { ArrowUpRight, FileText, Gavel, Rows3, ShieldCheck, Swords } from "lucide-react";
import type { ClubFacet, LeaderboardData, LeaderboardListEntry } from "../getLeaderboardData";
import { useFormat } from "@/lib/i18n/useFormat";
import CitableNumber from "@/lib/claims/CitableNumber";
import type { Locale } from "@/lib/i18n/config";
import { contributionScoreClaim } from "../scoreClaim";
import type { ContributionProvenance } from "../provenance";
import SourceNote from "@/features/shared/components/SourceNote";
import { COBALT, INK, OCHRE, SIGNAL, STEEL } from "@/features/landing/palette";
import { workhorseFlavourCopy, type WorkhorseFlavour } from "@/lib/analysis/workhorse-flavour";
import { asciiFold } from "@/lib/ingest/normalize";
import { foldQuery, nameMatches } from "../search";
import WorkhorseBadge from "./WorkhorseBadge";
import RapporteurBadge from "./RapporteurBadge";
import LowScoreReasonChip from "./LowScoreReasonChip";
import FollowButton from "@/features/schranka/FollowButton";

// Barva složky — jen tokeny palety (custom/no-hardcoded-colors). Šest složek,
// pět tokenů → leadership sdílí odstín s účastí, odlišen průhledností.
export const COMPONENT_FILL: Record<string, { color: string; opacity?: number }> = {
  participation: { color: COBALT },
  committee: { color: SIGNAL },
  legislative: { color: OCHRE },
  speech: { color: INK },
  attendance: { color: STEEL },
  leadership: { color: COBALT, opacity: 0.5 },
};

/** Per-component median across the whole chamber (207 MPs) — the baseline a
 *  single row's standout stat is measured against. Pure function of the full
 *  entries list; cheap enough to recompute on every render (207 × 6 numbers). */
function componentMedians(
  entries: LeaderboardListEntry[],
  components: LeaderboardData["components"],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of components) {
    const vals = entries.map((e) => e.components[c.key]).sort((a, b) => a - b);
    const n = vals.length;
    out[c.key] = n === 0 ? 0 : n % 2 ? vals[(n - 1) / 2] : (vals[n / 2 - 1] + vals[n / 2]) / 2;
  }
  return out;
}

/** The one component where this MP deviates furthest from the chamber
 *  median, as signed text ("+9 účast", "−2 docházka") — what actually
 *  explains the row, instead of six bars too similar to compare. */
function StandoutStat({
  entry,
  components,
  medians,
}: {
  entry: LeaderboardListEntry;
  components: LeaderboardData["components"];
  medians: Record<string, number>;
}) {
  let best: { label: string; delta: number } | null = null;
  for (const c of components) {
    const delta = Math.round(entry.components[c.key] - (medians[c.key] ?? 0));
    if (!best || Math.abs(delta) > Math.abs(best.delta)) best = { label: c.label.split(" ")[0], delta };
  }
  if (!best || best.delta === 0) return <span className="font-mono text-[10px] uppercase tracking-wider text-steel">≈ medián</span>;
  const up = best.delta > 0;
  return (
    <span
      className={`font-mono text-[10px] font-bold uppercase tracking-wider ${up ? "text-cobalt" : "text-signal"}`}
      title={`${best.label}: ${up ? "+" : ""}${best.delta} b. proti mediánu`}
    >
      {up ? "+" : "−"}
      {Math.abs(best.delta)} {best.label}
    </span>
  );
}

export default function LeaderboardTable({
  entries,
  clubs,
  components,
  provenance,
  duel,
  onToggleDuel,
  custom = false,
}: {
  entries: LeaderboardListEntry[];
  clubs: ClubFacet[];
  components: LeaderboardData["components"];
  /** Komorová provenience indexu — jde do CITACE skóre (scoreClaim.ts), aby
   *  citace nesla vlastní původ (pass + ref formule). Už je na drátě kvůli
   *  poznámkám pod žebříčkem; nový payload to není. */
  provenance: ContributionProvenance;
  duel: number[];
  onToggleDuel: (pspId: number) => void;
  /** True = řádky jsou seřazené čtenářovou čočkou (otevřený index, sekce /01),
   *  ne zveřejněným indexem: skóre a top-3 jdou do kobaltu (konvence „vaše
   *  číslo") a patička to přizná. Přeřazení animuje framer `layout` — jen bez
   *  prefers-reduced-motion. Česká kopie inline (messages/*.json je ve fleet
   *  režimu mimo hranici — precedens viz workhorse-filtr níže). */
  custom?: boolean;
}) {
  const t = useTranslations("civicscore");
  const tcom = useTranslations("common");
  const locale = useLocale();
  const f = useFormat();
  const reduceMotion = useReducedMotion();
  // Živé přeřazení pod čočkou: layout animace jen v režimu čočky (oficiální
  // pořadí se mění jen filtrem — tam řádky přibývají/mizí, nic neputuje).
  const animateRank = custom && !reduceMotion;
  const [club, setClub] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  // Quiet-workhorse flavour filter (batch 003, O-effort-3) — P31's two
  // positive-symmetry flavours. Graceful: only rendered when at least one MP in
  // `entries` carries a real (non-null) effortWorkhorseFlavour; each flavour
  // button only appears if that specific flavour has ≥1 MP, so the filter never
  // offers an option with zero results.
  const [workhorseFlavour, setWorkhorseFlavour] = useState<WorkhorseFlavour | null>(null);
  const workhorseCounts = useMemo(() => {
    const counts: Record<WorkhorseFlavour, number> = { legislative: 0, oversight: 0 };
    for (const e of entries) {
      if (e.effortWorkhorse && e.effortWorkhorseFlavour === "legislative") counts.legislative++;
      if (e.effortWorkhorse && e.effortWorkhorseFlavour === "oversight") counts.oversight++;
    }
    return counts;
  }, [entries]);
  const hasWorkhorseData = workhorseCounts.legislative + workhorseCounts.oversight > 0;

  // Dosier k dispozici (effort-loop enrichment, batch 001+) — souhrnný filtr
  // napříč všemi effort_* dosierovými poli (viz getLeaderboardData.hasDossierProps).
  // Souměrný s workhorse-filtrem: jen jeden aktivní stav, vlastní tlačítko.
  const [dossierOnly, setDossierOnly] = useState(false);
  const dossierCount = useMemo(() => entries.filter((e) => e.effortHasDossier).length, [entries]);
  // Pokrytí se uzavřelo na 207/207 (batch 006/007). Filtr, který vybere všechny
  // řádky, a ikona na každém řádku nic nerozlišují — proto se afordance ukazuje
  // jen dokud je pokrytí ČÁSTEČNÉ. Není to skrývání: úplnost říká věta pod
  // titulkem stránky. Zůstává funkční, kdyby graf o poslance povyrostl.
  const dossierPartial = dossierCount > 0 && dossierCount < entries.length;

  // Kolik řádků nese poctivý korektiv nízkého skóre (uzavřený slovník
  // effort_low_score_reason) — počítáno z celého žebříčku, ne z filtru.
  const correctionCount = useMemo(() => entries.filter((e) => e.effortLowScoreReason).length, [entries]);

  // Kompaktní/rozšířený přepínač řádků (manifestation pass 2026-07-25) —
  // kompaktní režim skryje standout statistiku a klubovou/regionální meta
  // řádku, nechá jen jméno, klub tečkou a skóre — čtenář může projít celý
  // žebříček rychleji.
  const [compact, setCompact] = useState(false);

  const medians = useMemo(() => componentMedians(entries, components), [entries, components]);

  // Kolik poslanců sdílí své pořadí, a v kolika skupinách — počítáno z celého
  // žebříčku (ne z filtru), aby věta pod tabulkou popisovala index, ne výběr.
  const tieStats = useMemo(() => {
    const byScore = new Map<number, number>();
    for (const e of entries) byScore.set(e.score, (byScore.get(e.score) ?? 0) + 1);
    const groups = [...byScore.values()].filter((c) => c > 1);
    return { shared: groups.reduce((a, b) => a + b, 0), groups: groups.length, total: entries.length };
  }, [entries]);

  // Hledání bez diakritiky: „zacek" musí najít „Žáček". Skládá se TOUTÉŽ funkcí,
  // která při ingestu plní person.name_norm (asciiFold) — viz ../search.ts. Složená
  // jména se počítají jednou na seznam, ne na každý úhoz.
  const foldedNames = useMemo(() => new Map(entries.map((e) => [e.pspId, asciiFold(e.name)])), [entries]);

  const rows = useMemo(() => {
    const q = foldQuery(query);
    return entries.filter(
      (r) =>
        (!club || r.clubAbbrev === club) &&
        nameMatches(foldedNames.get(r.pspId) ?? asciiFold(r.name), q) &&
        (!workhorseFlavour || (r.effortWorkhorse && r.effortWorkhorseFlavour === workhorseFlavour)) &&
        (!dossierOnly || r.effortHasDossier),
    );
  }, [entries, foldedNames, club, query, workhorseFlavour, dossierOnly]);

  return (
    <div>
      {/* filtry po klubech */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setClub(null)}
          className={`border-2 px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider transition-colors ${
            club === null ? "border-ink bg-ink text-paper" : "border-hairline text-steel hover:text-ink"
          }`}
          aria-pressed={club === null}
        >
          {t("allParties")}
        </button>
        {clubs.map((c) => (
          <button
            key={c.abbrev}
            type="button"
            onClick={() => setClub(club === c.abbrev ? null : c.abbrev)}
            className={`inline-flex items-center gap-1.5 border-2 px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider transition-colors ${
              club === c.abbrev ? "border-ink bg-ink text-paper" : "border-hairline text-steel hover:text-ink"
            }`}
            aria-pressed={club === c.abbrev}
          >
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: c.color }} />
            {c.name.split(" ")[0]} · {c.seats}
          </button>
        ))}
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchAriaLabel")}
          className="ml-auto border-2 border-hairline bg-paper px-3 py-1.5 font-mono text-xs uppercase tracking-wider text-ink placeholder:text-steel focus:border-ink focus:outline-none"
        />
      </div>

      {/* filtr tichých pracantů (batch 003, O-effort-3) — souměrně obě flavours,
          zobrazí se jen pokud graf obsahuje aspoň jednoho MP s daným flavourem */}
      {hasWorkhorseData && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {/* inline Czech literal, not next-intl: messages/*.json is shared/off-boundary
              in fleet mode (same precedent as LowScoreReasonBadge / TrendPanel) — proposed
              i18n key is listed in the batch handoff for the orchestrator to fold in */}
          <span className="font-mono text-[10px] uppercase tracking-wider text-steel">Tiší pracanti:</span>
          {(["legislative", "oversight"] as const).map((flav) => {
            if (workhorseCounts[flav] === 0) return null;
            const copy = workhorseFlavourCopy(flav)!;
            const Icon = flav === "legislative" ? Gavel : ShieldCheck;
            const active = workhorseFlavour === flav;
            return (
              <button
                key={flav}
                type="button"
                onClick={() => setWorkhorseFlavour(active ? null : flav)}
                title={copy.detail}
                aria-pressed={active}
                className={`inline-flex items-center gap-1.5 border-2 px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider transition-colors ${
                  active ? "border-cobalt bg-cobalt text-paper" : "border-hairline text-steel hover:text-ink"
                }`}
              >
                <Icon className="h-3 w-3" aria-hidden />
                {copy.badge} · {workhorseCounts[flav]}
              </button>
            );
          })}
        </div>
      )}

      {/* dosier filtr + kompaktní přepínač — jeden souvislý ovládací řádek */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {dossierPartial && (
          <button
            type="button"
            onClick={() => setDossierOnly((v) => !v)}
            title="Poslanci s pracovním profilem (effort-loop enrichment)"
            aria-pressed={dossierOnly}
            className={`inline-flex items-center gap-1.5 border-2 px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider transition-colors ${
              dossierOnly ? "border-cobalt bg-cobalt text-paper" : "border-hairline text-steel hover:text-ink"
            }`}
          >
            <FileText className="h-3 w-3" aria-hidden />
            Jen s dosierem · {dossierCount}
          </button>
        )}
        <button
          type="button"
          onClick={() => setCompact((v) => !v)}
          aria-pressed={compact}
          title={compact ? "Rozšířené řádky" : "Kompaktní řádky"}
          className="ml-auto inline-flex items-center gap-1.5 border-2 border-hairline px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-steel transition-colors hover:text-ink"
        >
          <Rows3 className="h-3 w-3" aria-hidden />
          {compact ? "Rozšířit" : "Zúžit"}
        </button>
      </div>

      {/* řádky */}
      <div className="mt-4 border-t-2 border-ink">
        {rows.map((r) => {
          const inDuel = duel.includes(r.pspId);
          return (
            <motion.div
              key={r.pspId}
              layout={animateRank ? "position" : false}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className={`grid grid-cols-[3.25rem_1fr_auto_auto_auto] items-center gap-3 border-b border-hairline px-2 py-2.5 transition-colors hover:bg-paper-strong max-sm:grid-cols-[2.5rem_1fr_auto_auto] ${
                inDuel ? "bg-paper-strong" : ""
              }`}
            >
              {/* Pořadí je SDÍLENÉ při shodě skóre (getLeaderboardData: competition
                  ranking). „=" před číslem říká, že o toto místo se dělí víc poslanců —
                  dřív se o červené top-3 rozhodovalo abecedou. */}
              <span
                className={`font-mono text-lg font-bold ${r.rank <= 3 ? (custom ? "text-cobalt" : "text-signal") : "text-steel"}`}
                title={r.tiedCount > 1 ? t("tieRowTitle", { count: f.int(r.tiedCount) }) : undefined}
              >
                {r.tiedCount > 1 && (
                  <span aria-hidden className="mr-0.5 text-[0.8em]">
                    =
                  </span>
                )}
                {f.int(r.rank)}
                {r.tiedCount > 1 && <span className="sr-only"> — {t("tieRowTitle", { count: f.int(r.tiedCount) })}</span>}
              </span>
              <span className="min-w-0">
                <Link
                  href={`/poslanec/${r.pspId}`}
                  className="group inline-flex items-center gap-1.5 text-[15px] font-black uppercase tracking-tight hover:text-signal"
                >
                  <span className="truncate">{r.name}</span>
                  {dossierPartial && r.effortHasDossier && (
                    <FileText
                      className="h-3 w-3 shrink-0 text-cobalt"
                      aria-hidden
                    />
                  )}
                  <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-signal" />
                </Link>
                {/* Korektiv stojí VEDLE čísla, které opravuje — a je vidět i v
                    kompaktním režimu, protože skrýt ho znamená nechat pořadí
                    tvrdit něco, co data samy opravují. */}
                {r.effortLowScoreReason && (
                  <span className="ml-1.5 inline-flex align-middle">
                    <LowScoreReasonChip
                      reason={r.effortLowScoreReason}
                      recordedAt={r.effortRecordedAt}
                      dateLabel={r.effortRecordedAt ? f.date(r.effortRecordedAt) : null}
                    />
                  </span>
                )}
                {!compact && (
                  <span className="flex flex-wrap items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-steel">
                    <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: r.clubColor }} />
                    {r.clubName.split(" ")[0]}{r.region ? ` · ${r.region}` : ""}
                    {/* Verdikt je DATOVANÉ tvrzení s vlastním číslem — týž standard,
                        jaký vedle drží LowScoreReasonChip. */}
                    {r.effortWorkhorse && (
                      <WorkhorseBadge
                        flavour={r.effortWorkhorseFlavour}
                        speechTurns={r.duelFacts.speechTurns}
                        recordedAt={r.effortRecordedAt}
                        compact
                      />
                    )}
                    <RapporteurBadge load={r.effortRapporteurLoad} recordedAt={r.effortRecordedAt} compact />
                  </span>
                )}
              </span>
              {!compact && (
                <span className="max-sm:hidden">
                  <StandoutStat entry={r} components={components} medians={medians} />
                </span>
              )}
              {/* Kobaltové skóre = vaše číslo, ne zveřejněné (konvence z landing LiveSpecimen). */}
              {/* A právě proto se ČTENÁŘOVO číslo NERAZÍ jako citace: pod čočkou
                  je to jeho vlastní vážení, které v grafu nikde nestojí. Citovat
                  se dá jen zveřejněný index — ten nese svůj pass i ref formule. */}
              <span className={`w-12 text-right text-lg font-black tabular-nums ${custom ? "text-cobalt" : ""}`}>
                {custom ? (
                  f.dec(r.score)
                ) : (
                  <CitableNumber
                    value={r.score}
                    claim={contributionScoreClaim(r.pspId, r.score, provenance).claim}
                    locale={locale as Locale}
                  />
                )}
              </span>
              <span className="flex items-center gap-1.5">
              {/* Sledovat rovnou z řádku. V husté tabulce jen ikona — význam
                  nese přístupná jmenovka, která JMENUJE poslance (dvě stě
                  tlačítek „sledovat" bez podmětu vedle sebe nerozliší nikdo). */}
              <FollowButton
                entityKey={`poslanec:${r.pspId}`}
                label={r.name}
                subject={tcom("followSubjectMp", { name: r.name })}
                words={{ follow: tcom("followWord"), following: tcom("followingWord") }}
                compact
                iconOnly
              />
              <button
                type="button"
                onClick={() => onToggleDuel(r.pspId)}
                title={inDuel ? t("toggleDuelRemove") : t("toggleDuelAdd")}
                aria-pressed={inDuel}
                className={`inline-flex items-center gap-1 border-2 px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-wider transition-colors ${
                  inDuel ? "border-signal bg-signal text-paper" : "border-hairline text-steel hover:border-ink hover:text-ink"
                }`}
              >
                <Swords className="h-3 w-3" /> {t("vsButton")}
              </button>
              </span>
            </motion.div>
          );
        })}
        {rows.length === 0 && (
          <div className="border-2 border-dashed border-hairline p-6 text-sm text-steel">
            {t("emptyResults")}
          </div>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <SourceNote>
          {t("shownOf", { count: rows.length })}
        </SourceNote>
        {custom ? (
          <SourceNote>
            seřazeno podle vašich vah (otevřený index, /01) — nejde o zveřejněný index; výchozí
            metodiku vrátí tlačítko v horním pruhu
          </SourceNote>
        ) : (
          <SourceNote className="!text-[10px]">{t("realNote")}</SourceNote>
        )}
      </div>
      {correctionCount > 0 && (
        <div className="mt-2">
          <SourceNote className="!text-[10px]">
            {t("correctionNote", { count: f.int(correctionCount), total: f.int(entries.length) })}
          </SourceNote>
        </div>
      )}
      {/* Co „=" znamená a co zbylý pořádek uvnitř shody NEznamená — bez toho by
          abecední řazení vypadalo jako výsledek. */}
      <div className="mt-2">
        <SourceNote className="!text-[10px]">
          {t("tieNote", { shared: f.int(tieStats.shared), total: f.int(tieStats.total), groups: f.int(tieStats.groups) })}
        </SourceNote>
      </div>
    </div>
  );
}
