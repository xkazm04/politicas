"use client";

/**
 * Agregátní pás /penize — OZNAČENÁ VZOROVÁ čísla, když peněžní vrstva grafu není k
 * dispozici. Vlastní modul jen kvůli balíčku: tahle větev je jediný důvod, proč
 * `FollowTheMoneyPage` importovala `lib/civic/data.ts` (27 KB) na úrovni modulu, a
 * platil za ni každý čtenář, který uvidí jen reálná čísla. Nahrává se přes
 * `next/dynamic`, takže fallback dál funguje včetně serverového renderu.
 */

import { useTranslations } from "next-intl";
import { MODULES, MONEY_TIES } from "@/lib/civic/data";
import { useFormat } from "@/lib/i18n/useFormat";
import StatTiles from "./StatTiles";

const MODULE = MODULES.find((m) => m.key === "follow-the-money")!;
const PENDING = MONEY_TIES.filter((tie) => !tie.verified).length;

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
          sub: t("stats.sampleTies.sub"),
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
