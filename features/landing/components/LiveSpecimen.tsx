"use client";

/**
 * Pravá polovina hero — živý, přenastavitelný index nad REÁLNÝMI daty.
 * Metodika jako hlavní interakce: posuvníky šesti zveřejněných složek
 * přepočítávají skóre živě pravidlem čočky (features/civicscore/lens.ts).
 * Při zveřejněných vahách se ukazuje autoritativní contribution_score
 * z grafu; jinak přepočet označený jako „vaše váhy". Stav (vybraný
 * poslanec + váhy) vlastní LandingPage; tady jen ovládání.
 *
 * Štítky složek jsou kanonické české z componentDefs.ts — týž zdroj jako
 * /zebricek (jedna definice, žádná druhá kopie štítků ani vah).
 */

import { RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ComponentDef, LeaderboardListEntry } from "@/features/civicscore/getLeaderboardData";
import { COMPONENT_FILL } from "@/features/civicscore/componentFill";
import type { WeightVector } from "@/features/civicscore/lens";
import { PUBLISHED_WEIGHTS_LABEL } from "@/features/civicscore/lens";
import { useFormat } from "@/lib/i18n/useFormat";
import type { Claim } from "@/lib/claims/claim";
import AnimatedScore from "@/features/shared/components/AnimatedScore";
import SourceNote from "@/features/shared/components/SourceNote";

export default function LiveSpecimen({
  mp,
  featured,
  components,
  total,
  score,
  claim,
  weights,
  isDefault,
  onSelect,
  onWeightChange,
  onReset,
}: {
  mp: LeaderboardListEntry;
  /** Špička žebříčku — přepínač vzorku. */
  featured: LeaderboardListEntry[];
  /** Šest zveřejněných složek z loaderu (label/weight/source). */
  components: ComponentDef[];
  /** Kolik poslanců index pokrývá (207). */
  total: number;
  score: number;
  /** Citace ZVEŘEJNĚNÉHO kompozitu (features/civicscore/scoreClaim.ts). Pod
   *  čtenářovými vahami přichází `undefined` — přepočtené číslo v grafu nikde
   *  nestojí, takže by nemělo co citovat (totéž pravidlo drží /kraj i žebříček). */
  claim?: Claim;
  weights: WeightVector;
  isDefault: boolean;
  onSelect: (pspId: number) => void;
  onWeightChange: (key: ComponentDef["key"], value: number) => void;
  onReset: () => void;
}) {
  const t = useTranslations("landing");
  const f = useFormat();
  return (
    <div className="py-14 lg:pl-12">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-steel-aa">
          {t("specimenLabel", { name: mp.name, party: mp.clubName })}
        </p>
        {!isDefault && (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex shrink-0 items-center gap-1 font-mono text-[11px] uppercase tracking-wider text-cobalt transition-colors hover:text-signal-deep"
          >
            <RotateCcw className="h-3 w-3" /> {t("publishedWeights")}
          </button>
        )}
      </div>

      {/* přepínač vzorku — příjmení špičky žebříčku jako štítky */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {featured.map((e) => (
          <button
            key={e.pspId}
            type="button"
            onClick={() => onSelect(e.pspId)}
            className={`border-2 px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-wider transition-colors ${
              e.pspId === mp.pspId ? "border-ink bg-ink text-paper" : "border-hairline text-steel-aa hover:text-ink"
            }`}
            aria-pressed={e.pspId === mp.pspId}
          >
            {e.name.split(" ").at(-1)}
          </button>
        ))}
      </div>

      <div className="mt-4 flex items-end gap-4">
        <AnimatedScore
          value={score}
          format={f.dec}
          claim={isDefault ? claim : undefined}
          className={`text-[8rem] font-black leading-[0.85] tracking-tighter sm:text-[10rem] ${
            isDefault ? "text-ink" : "text-cobalt"
          }`}
        />
        <div className="pb-4">
          <span className="block h-10 w-10 rounded-full bg-signal" />
          <span className="mt-2 block font-mono text-[11px] uppercase tracking-widest text-steel-aa">/100</span>
        </div>
      </div>
      <p className={`mt-1 font-mono text-[11px] uppercase tracking-widest ${isDefault ? "text-steel-aa" : "text-cobalt"}`}>
        {isDefault
          ? t("scoreDefault", { weights: PUBLISHED_WEIGHTS_LABEL, rank: mp.rank, total })
          : t("scoreCustom")}
      </p>

      <div className="mt-8 space-y-5">
        {components.map((c) => {
          const fill = COMPONENT_FILL[c.key];
          return (
            <div key={c.key} className="grid grid-cols-[9.5rem_1fr_3rem] items-center gap-4">
              <span className="flex items-center gap-2 text-sm font-black uppercase tracking-wide">
                {/* barva složky — jediný zdroj componentFill.ts (tokeny palety) */}
                <span
                  className="inline-block h-3 w-3"
                  style={{ background: fill.color, opacity: fill.opacity ?? 1 }}
                />
                {c.label}
              </span>
              <input
                type="range"
                min={0}
                max={100}
                value={weights[c.key]}
                onChange={(e) => onWeightChange(c.key, Number(e.target.value))}
                aria-label={t("componentWeightAria", { component: c.label })}
                className="k-range"
              />
              <span className="text-right font-mono text-sm tabular-nums text-steel-aa">
                {Math.round(weights[c.key])}
              </span>
            </div>
          );
        })}
      </div>
      <SourceNote className="mt-6">{t("specimenSource")}</SourceNote>
      {/* Zadržená citace se PŘIZNÁVÁ. Číslo pod čtenářovou čočkou nikde v grafu
          nestojí, takže nemá trvalou adresu — mlčení by čtenáře nechalo hledat
          citaci, která nikdy nevznikne (táž věta jako na kartě kraje). */}
      {!isDefault && <SourceNote className="mt-1.5">{t("specimenNoClaim")}</SourceNote>}
    </div>
  );
}
