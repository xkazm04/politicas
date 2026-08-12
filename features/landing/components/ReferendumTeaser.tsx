"use client";

/**
 * Referendum o metodice — rubrika titulní strany (moonshot 7B, teaser).
 * Tři REDAKČNÍ ukázkové čočky z features/civicscore/lens.ts (LENS_PRESETS —
 * jediný zdroj, READ-ONLY import; záměrně nepřipsané žádné organizaci) +
 * vstup do plného toku „nastav si váhy" na /referendum. Každý odkaz nese
 * vektor vah v adrese (?vahy=…, týž kodek jako /zebricek) — odkaz je čočka.
 *
 * COPY JDE Z KATALOGU (2026-08-12). Rubrika vznikla s poznámkou „copy česky
 * přímo zde (messages/*.json mimo plochu)" jako dočasná výjimka a ta výjimka
 * přežila dávku, kvůli které vznikla: anglický čtenář dostal na PRVNÍ stránce
 * produktu sedmnáct českých vět včetně `aria-label`. Štítky a poznámky čoček
 * přicházejí z `lens.ts` jako KLÍČE do `civicscore.lensPreset.*` a překládají se
 * tady; vlastní copy rubriky žije pod `landing.referendum.*`. Hlídá to
 * features/landing/hardcodedCopy.test.ts.
 *
 * A počet ukázek je DERIVACE, ne slovo: „Tři redakční ukázky" byl literál nad
 * polem, které si svou délku nese samo — čtvrtá čočka by z věty udělala lež.
 */

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useTranslations } from "next-intl";
import SourceNote from "@/features/shared/components/SourceNote";
import type { ComponentKey } from "@/features/civicscore/getLeaderboardData";
import {
  effectiveWeights,
  encodeWeights,
  LENS_COMPONENT_ORDER,
  LENS_PRESETS,
  PUBLISHED_WEIGHTS,
  PUBLISHED_WEIGHTS_LABEL,
} from "@/features/civicscore/lens";
import { useFormat } from "@/lib/i18n/useFormat";

/** Tailwind bg-* třída složky — drž v sync s COMPONENT_FILL
 *  (features/civicscore/components/LeaderboardTable.tsx). */
const COMPONENT_BG: Record<ComponentKey, string> = {
  participation: "bg-cobalt",
  committee: "bg-signal",
  legislative: "bg-ochre",
  speech: "bg-ink",
  attendance: "bg-steel",
  leadership: "bg-cobalt/50",
};

export default function ReferendumTeaser({
  /** Kolik poslanců index skutečně pokrývá; `null` = store nedostupný, a pak
   *  se věta o „všech {count} poslancích" NEVYSLOVÍ. Tvrzení o pokrytí nesmí
   *  přežít data, ze kterých pochází. */
  count,
}: {
  count: number | null;
}) {
  const t = useTranslations("landing");
  /** Štítky čoček bydlí v katalogu žebříčku — je to jeho metodika, ne rubrika. */
  const tc = useTranslations("civicscore");
  const f = useFormat();
  // Zveřejněné váhy se ODVOZUJÍ ze vzorce (lens.ts → CONTRIBUTION_WEIGHTS), ne
  // z přepsané věty: „účast 25, výbory 20…" tu stálo jako literál na stránce,
  // která čtenáře zve index převážit — změna vzorce by ji nechala lhát.
  // Krátké štítky složek jsou taky katalog: `landing.referendum.short.*`.
  const publishedList = LENS_COMPONENT_ORDER.map(
    (k) => `${t(`referendum.short.${k}`)} ${f.int(PUBLISHED_WEIGHTS[k])}`,
  ).join(", ");
  // I ten součet je derivace, ne literál — „100 bodů" je vlastnost vzorce.
  const publishedTotal = LENS_COMPONENT_ORDER.reduce((s, k) => s + PUBLISHED_WEIGHTS[k], 0);
  return (
    <section aria-label={t("referendum.regionLabel")} className="border-t-4 border-ink">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-xs font-bold uppercase tracking-widest text-signal-deep">
              {t("referendum.eyebrow")}
            </p>
            <h2 className="mt-1 text-4xl font-black uppercase tracking-tight sm:text-5xl">
              {t("referendum.title")}<span className="text-signal">?</span>
            </h2>
          </div>
          <SourceNote>{t("referendum.weightsSource", { weights: PUBLISHED_WEIGHTS_LABEL })}</SourceNote>
        </div>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-steel-aa">
          {t("referendum.leadWeights", { total: f.int(publishedTotal), list: publishedList })}{" "}
          {count === null
            ? t("referendum.leadReweighNoCount")
            : t("referendum.leadReweighCount", { count: f.int(count) })}{" "}
          {t("referendum.leadPresets", {
            n: LENS_PRESETS.length,
            nFmt: f.int(LENS_PRESETS.length),
          })}
        </p>

        <div className="mt-8 grid gap-px border border-ink bg-ink sm:grid-cols-3">
          {LENS_PRESETS.map((p) => {
            const eff = effectiveWeights(p.weights);
            const vector = encodeWeights(p.weights);
            return (
              <Link
                key={p.id}
                href={vector ? `/referendum?vahy=${vector}` : "/referendum"}
                className="group bg-paper p-5 transition-colors hover:bg-paper-strong"
              >
                <p className="text-lg font-black uppercase tracking-wide">
                  {tc(p.labelKey)}
                  <span className="text-cobalt">.</span>
                </p>
                <p className="mt-1 min-h-10 text-[13px] leading-snug text-steel-aa">{tc(p.noteKey)}</p>
                <div className="mt-4 space-y-1.5">
                  {LENS_COMPONENT_ORDER.map((k) => (
                    <div key={k} className="grid grid-cols-[5.5rem_1fr_2.2rem] items-center gap-2">
                      <span className="truncate font-mono text-[10px] uppercase tracking-wider text-steel-aa">
                        {t(`referendum.short.${k}`)}
                      </span>
                      <span className="h-2 bg-paper-strong">
                        <span
                          className={`block h-2 ${COMPONENT_BG[k]}`}
                          style={{ width: `${Math.min(100, eff[k] * 2)}%` }}
                          aria-hidden
                        />
                      </span>
                      <span className="text-right font-mono text-[10px] tabular-nums text-steel-aa">
                        {f.dec(eff[k])}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="mt-4 inline-flex items-center gap-1 font-mono text-[11px] font-bold uppercase tracking-widest text-cobalt group-hover:underline">
                  {t("referendum.openLens")}{" "}
                  <ArrowUpRight
                    className="h-3 w-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                    aria-hidden
                  />
                </p>
              </Link>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <SourceNote>{t("referendum.presetsSource")}</SourceNote>
          <Link
            href="/referendum"
            className="inline-flex items-center gap-2 bg-signal-deep px-6 py-3.5 text-sm font-black uppercase tracking-wider text-paper transition-transform hover:-translate-y-0.5"
          >
            {t("referendum.cta")} <ArrowUpRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}
