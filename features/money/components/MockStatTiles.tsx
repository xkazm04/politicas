"use client";

/**
 * Agregátní pás /penize — OZNAČENÁ VZOROVÁ čísla, když peněžní vrstva grafu není k
 * dispozici. Vlastní modul jen kvůli balíčku: tahle větev je jediný důvod, proč
 * `FollowTheMoneyPage` importovala `lib/civic/data.ts` (27 KB) na úrovni modulu, a
 * platil za ni každý čtenář, který uvidí jen reálná čísla. Nahrává se přes
 * `next/dynamic`, takže fallback dál funguje včetně serverového renderu.
 */

import { useTranslations } from "next-intl";
import { MODULES, MONEY_TIES, MPS } from "@/lib/civic/data";
import { useFormat } from "@/lib/i18n/useFormat";
import StatTiles from "./StatTiles";

const MODULE = MODULES.find((m) => m.key === "follow-the-money")!;
const PENDING = MONEY_TIES.filter((tie) => !tie.verified).length;
/* Poměr pod dlaždicí byl LITERÁL („u 3 z 5 sledovaných poslanců") nad vzorkem,
   který ho nese sám: přidaná ukázková vazba by z věty udělala lež i v mocku.
   Odvozuje se proto z týchž dvou polí, ze kterých se počítá hodnota nad ní. */
const MPS_WITH_TIES = new Set(MONEY_TIES.map((tie) => tie.mpId)).size;
const MPS_TRACKED = MPS.length;

export default function MockStatTiles() {
  const t = useTranslations("money");
  const tc = useTranslations("content");
  const f = useFormat();

  return (
    <StatTiles
      items={[
        {
          label: tc(`modules.${MODULE.key}.metricLabel`),
          value: tc(`modules.${MODULE.key}.metricValue`),
          sub: t("stats.contracted.sub"),
          source: t("stats.contracted.source"),
        },
        {
          label: t("stats.sampleTies.label"),
          value: f.int(MONEY_TIES.length),
          sub: t("stats.sampleTies.sub", {
            withTiesFmt: f.int(MPS_WITH_TIES),
            total: MPS_TRACKED,
            totalFmt: f.int(MPS_TRACKED),
          }),
          source: t("stats.sampleTies.source"),
        },
        {
          label: t("stats.pendingReview.label"),
          value: f.int(PENDING),
          sub: t("stats.pendingReview.sub"),
          source: t("stats.pendingReview.source"),
        },
        {
          label: t("stats.joinKey.label"),
          value: "IČO",
          sub: t("stats.joinKey.sub"),
          source: t("stats.joinKey.source"),
        },
      ]}
    />
  );
}
