"use client";

/*
 * Dlaždice ze vzorku `lib/civic` — vykreslí se jen tehdy, když příslušná vrstva
 * grafu není k dispozici. Nese ILUSTRATIVNÍ variantu, takže se od spočítaného
 * čísla liší plochou a barvou číselníku, ne pouze textem pod ním.
 */

import { useTranslations } from "next-intl";
import StatTile from "@/features/shared/components/StatTile";

export default function MockStatTile({ statKey }: { statKey: string }) {
  const t = useTranslations("dashboard");
  const tc = useTranslations("content");
  return (
    <StatTile
      variant="illustrative"
      illustrativeTag={t("mockTag")}
      label={tc(`chamberStats.${statKey}.label`)}
      value={tc(`chamberStats.${statKey}.value`)}
      // Bez `sub`: štítek nahoře a citace dole už to říkají dvakrát, potřetí
      // by z upozornění byl šum.
      source={tc(`chamberStats.${statKey}.source`)}
    />
  );
}
