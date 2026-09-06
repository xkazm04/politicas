"use client";

/*
 * /metodika §05 — pravidla nálezů pro /volby, vysvětlená TÍM KÓDEM, KTERÝ JE POČÍTÁ.
 *
 * Stejné pravidlo jako zbytek stránky: každý práh je IMPORT z
 * lib/analysis/volby/rules.ts, nikdy literál. Každé pravidlo má kotvu
 * `#volby-<ref>` — řádek nálezu na /volby na ni odkazuje svým `ruleRef`.
 * Žádné skóre: ledger je počet podle valence × závažnosti, a to tu stojí
 * napsané dřív než první práh.
 */

import { useTranslations } from "next-intl";
import SectionHeading from "@/features/shared/components/SectionHeading";
import SourceNote from "@/features/shared/components/SourceNote";
import { useFormat } from "@/lib/i18n/useFormat";
import {
  CIRCLE_HIGH,
  CONFLICT_HIGH_CZK,
  MIN_DATED_WINS,
  N1_DEPENDENCE_MIN,
  N1_MULTIPLE_HIGH,
  N1_MULTIPLE_MEDIUM,
  N2_CIRCLE_MIN,
  N2_SWITCH_MAX,
  N3_SWITCH_MIN,
  N4_MIN_LOTS,
  N4_MULTIPLE,
  P1_MAX_MULTIPLE,
  P1_MIN_LOTS,
  RAPPORTEUR_MIN,
  RULE_REF,
  VOLBY_RULES_REF,
} from "@/lib/analysis/volby/rules";
import { TERM_WINDOWS } from "@/lib/analysis/volby/terms";
import type { FindingKind } from "@/lib/analysis/volby/types";

/** Kotva pravidla: `volby:N1` → `volby-N1`. Stejný převod používá řádek nálezu. */
export const ruleAnchor = (ruleRef: string): string => ruleRef.replace(":", "-");

/** KAŽDÉ pravidlo, které RULE_REF pojmenuje — v jeho pořadí. Do 2026-09-07 tu stál
 *  ruční opis jedenácti druhů a záznamové pravidlo R1 (`law_final_vote`) v něm
 *  chybělo, takže odkaz `/metodika#volby-R1` z řádku nálezu vedl do prázdna;
 *  katalog jeho větu měl celou dobu. */
const RULE_KINDS = Object.keys(RULE_REF) as FindingKind[];

export default function MetodikaVolbySection({ index }: { index: number }) {
  const t = useTranslations("metodika");
  const f = useFormat();
  // Podíly se tisknou jako celá procenta — práh 0,6 je „60 %", ne „0,6".
  const pct = (x: number) => `${f.int(Math.round(x * 100))} %`;
  const vars = {
    n1Medium: f.int(N1_MULTIPLE_MEDIUM),
    n1High: f.int(N1_MULTIPLE_HIGH),
    n1Dependence: pct(N1_DEPENDENCE_MIN),
    circleMin: pct(N2_CIRCLE_MIN),
    switchMax: pct(N2_SWITCH_MAX),
    switchMin: pct(N3_SWITCH_MIN),
    circleHigh: pct(CIRCLE_HIGH),
    minWins: f.int(MIN_DATED_WINS),
    n4Multiple: f.int(N4_MULTIPLE),
    n4MinLots: f.int(N4_MIN_LOTS),
    p1MinLots: f.int(P1_MIN_LOTS),
    p1Max: f.dec(P1_MAX_MULTIPLE),
    conflictCzk: f.int(CONFLICT_HIGH_CZK / 1_000_000),
    rapporteurMin: f.int(RAPPORTEUR_MIN),
  };

  return (
    <section id="volby" className="mt-14 border-t-4 border-ink pt-10">
      <SectionHeading
        index={index}
        title={t("volbyHeading")}
        aside={<SourceNote>{t("volbySource", { ref: VOLBY_RULES_REF })}</SourceNote>}
      />
      <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-steel">{t("volbyLead")}</p>

      <ul className="mt-6 divide-y divide-hairline border-y border-hairline">
        {RULE_KINDS.map((kind) => {
          const ref = RULE_REF[kind];
          return (
            <li key={kind} id={ruleAnchor(ref)} className="grid gap-2 py-4 sm:grid-cols-[7rem_1fr]">
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-signal">{ref}</span>
              <div>
                <p className="font-bold">{t(`volbyRule_${kind}_title`)}</p>
                <p className="mt-1 text-sm leading-relaxed text-steel">{t(`volbyRule_${kind}_rule`, vars)}</p>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="mt-6 max-w-2xl text-sm leading-relaxed text-steel">{t("volbyWindowsLead")}</p>
      <ul className="mt-2 space-y-1 font-mono text-xs text-steel">
        {TERM_WINDOWS.map((w) => (
          <li key={w.ballot}>
            {w.label}: {f.date(w.from)} → {w.to ? f.date(w.to) : t("volbyWindowOpen")}
          </li>
        ))}
      </ul>
      <SourceNote className="mt-4">{t("volbyWindowsSource")}</SourceNote>
    </section>
  );
}
