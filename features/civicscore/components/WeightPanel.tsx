"use client";

/**
 * Otevřený index — panel vah (moonshot 1A). Šest posuvníků nad zveřejněnými
 * složkami indexu přispění: čtenář si nastaví vlastní priority a celý žebříček
 * (rozložení, souboj, tabulka) se přepočítá pod JEHO čočkou. Vektor vah žije
 * v URL (?vahy=…), takže každý sdílený žebříček nese svou metodiku v odkazu.
 *
 * Vizuální stav je nezaměnitelný: zveřejněná metodika = klidný papír;
 * vlastní čočka = kobaltový rám + kobaltové akcenty (tatáž konvence jako
 * landing LiveSpecimen: kobalt znamená „vaše číslo, ne zveřejněné").
 *
 * Česká UI kopie je inline literálem, ne next-intl: messages/*.json je ve
 * fleet režimu sdílený/mimo hranici (týž precedens jako LowScoreReasonBadge
 * a workhorse-filtr v LeaderboardTable) — navržené klíče jsou v předávacím
 * protokolu dávky pro orchestrátora.
 */

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Link2, RotateCcw } from "lucide-react";
import type { LeaderboardData } from "../getLeaderboardData";
import {
  effectiveWeights,
  encodeWeights,
  LENS_COMPONENT_ORDER,
  LENS_PRESETS,
  PUBLISHED_WEIGHTS_LABEL,
  type WeightVector,
} from "../lens";
import type { LensWeightsState } from "../useLensWeights";
import { trackEvent } from "@/lib/analytics";
import { useFormat } from "@/lib/i18n/useFormat";
import SourceNote from "@/features/shared/components/SourceNote";
import { COMPONENT_FILL } from "../componentFill";

const sameWeights = (a: WeightVector, b: WeightVector) =>
  LENS_COMPONENT_ORDER.every((k) => a[k] === b[k]);

/** Tlačítko „kopírovat odkaz" s potvrzením — jen u vlastní čočky (u výchozí
 *  metodiky adresa žádnou čočku nenese, není co sdílet). */
function CopyLensLink() {
  const t = useTranslations("civicscore");
  const [state, setState] = useState<"idle" | "ok" | "fail">("idle");
  useEffect(() => {
    if (state === "idle") return;
    const id = setTimeout(() => setState("idle"), 2500);
    return () => clearTimeout(id);
  }, [state]);
  return (
    <button
      type="button"
      onClick={() =>
        navigator.clipboard.writeText(window.location.href).then(
          () => setState("ok"),
          () => setState("fail"),
        )
      }
      className="inline-flex items-center gap-1.5 border-2 border-cobalt px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-wider text-cobalt transition-colors hover:bg-cobalt hover:text-paper"
    >
      {state === "ok" ? <Check className="h-3 w-3" aria-hidden /> : <Link2 className="h-3 w-3" aria-hidden />}
      {state === "ok" ? t("lensLinkCopied") : state === "fail" ? t("lensLinkCopyFailed") : t("lensShare")}
    </button>
  );
}

export default function WeightPanel({
  components,
  lens,
  totalRaw,
}: {
  /** ZVEŘEJNĚNÉ složkové definice (labels, zdroje, oficiální váhy) z loaderu. */
  components: LeaderboardData["components"];
  lens: LensWeightsState;
  /** Surový součet posuvníků (z reweigh), u výchozí metodiky 100. */
  totalRaw: number;
}) {
  const t = useTranslations("civicscore");
  const tcom = useTranslations("common");
  const f = useFormat();
  const { weights, isDefault, setWeight, setAll, reset } = lens;
  const eff = effectiveWeights(weights);
  const vector = encodeWeights(weights);

  return (
    <div className={`border-2 p-6 transition-colors ${isDefault ? "border-ink" : "border-cobalt"}`}>
      <div className="grid gap-8 lg:grid-cols-[5fr_7fr]">
        {/* ── stav + presety + pravidlo ─────────────────────────── */}
        <div>
          <p className="max-w-md text-[15px] leading-relaxed text-steel-aa">
            {t("weightPanelLead", { count: f.int(207) })}
          </p>

          <p
            aria-live="polite"
            className={`mt-4 font-mono text-xs font-bold uppercase tracking-widest ${
              isDefault ? "text-steel-aa" : "text-cobalt"
            }`}
          >
            {isDefault ? t("lensStatusDefault") : t("lensBadge", { weights: vector ?? "" })}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {LENS_PRESETS.map((p) => {
              const active = sameWeights(weights, p.weights);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setAll({ ...p.weights })}
                  title={p.note}
                  aria-pressed={active}
                  className={`border-2 px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-wider transition-colors ${
                    active ? "border-cobalt bg-cobalt text-paper" : "border-hairline text-steel-aa hover:text-ink"
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
          <div className="mt-2">
            <SourceNote>{t("lensPresetsNote")}</SourceNote>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {!isDefault && (
              <button
                type="button"
                onClick={reset}
                className="inline-flex items-center gap-1.5 border-2 border-ink bg-ink px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-wider text-paper transition-colors hover:bg-paper hover:text-ink"
              >
                <RotateCcw className="h-3 w-3" aria-hidden />
                {t("resetToPublished")}
              </button>
            )}
            {!isDefault && <CopyLensLink />}
          </div>
        </div>

        {/* ── posuvníky ─────────────────────────────────────────── */}
        <div>
          <div className="space-y-4">
            {components.map((c) => {
              const fill = COMPONENT_FILL[c.key];
              const changed = weights[c.key] !== c.weight;
              return (
                <div key={c.key} className="grid grid-cols-[minmax(8.5rem,11rem)_1fr_2.5rem_4.5rem] items-center gap-3 max-sm:grid-cols-[1fr_2.5rem_4.5rem]">
                  <span
                    className="flex items-center gap-2 text-sm font-black uppercase tracking-wide max-sm:col-span-3"
                    title={t("weightRowTitle", { label: c.label, weight: c.weight, source: c.source })}
                  >
                    <span
                      className="inline-block h-3 w-3 shrink-0"
                      style={{ background: fill?.color, opacity: fill?.opacity ?? 1 }}
                      aria-hidden
                    />
                    <span className="truncate">{c.label}</span>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={weights[c.key]}
                    onChange={(e) => setWeight(c.key, Number(e.target.value))}
                    // Aktivační trychtýř: jedna událost na KONEC tahu, ne na
                    // každý krok posuvníku (onChange střílí desítkykrát).
                    onPointerUp={() => trackEvent("weights-adjusted")}
                    aria-label={t("weightSliderAria", { label: c.label, weight: c.weight })}
                    aria-valuetext={t("weightSliderValue", { value: weights[c.key], effective: f.dec(eff[c.key]) })}
                    className="k-range"
                  />
                  <span
                    className={`text-right font-mono text-sm font-bold tabular-nums ${changed ? "text-cobalt" : "text-ink"}`}
                  >
                    {f.int(weights[c.key])}
                  </span>
                  <span className="text-right font-mono text-xs tabular-nums text-steel-aa">
                    → {f.dec(eff[c.key])} {tcom("pts")}
                  </span>
                </div>
              );
            })}
          </div>

          <p className="mt-4 border-t border-hairline pt-3 font-mono text-xs uppercase tracking-wider text-steel-aa">
            {t("weightTotal", { total: f.int(totalRaw) })}{" "}
            {totalRaw === 0
              ? t("weightTotalZero")
              : totalRaw === 100
                ? t("weightTotalExact")
                : t("weightTotalScaled")}
          </p>

          {/* Přiznané pravidlo čočky — týž vzor jako stateSlice („bordered note"). */}
          <div className="mt-3 border-l-4 border-cobalt pl-4">
            <SourceNote>{t("lensRule", { weights: PUBLISHED_WEIGHTS_LABEL })}</SourceNote>
          </div>
        </div>
      </div>
    </div>
  );
}
