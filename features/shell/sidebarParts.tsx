"use client";

/*
 * Společné díly obou variant levé lišty — hlavička se značkou, patička
 * a překlad popisků řádků. Varianty se mají lišit KOMPOZICÍ (jak je obsah
 * stránky svázaný s navigací), ne tím, že by každá jinak psala „Politicas".
 */

import { useTranslations } from "next-intl";
import Link from "next/link";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { MODULES } from "@/lib/civic/data";
import SourceNote from "@/features/shared/components/SourceNote";
import type { NavChild, NavEntry, NavSection } from "./navModel";

export interface SidebarProps {
  pathname: string;
  /** Kotvy, které na stránce opravdu existují. */
  sections: NavSection[];
  activeSection: string | null;
  activeEntry: NavEntry | undefined;
}

/** Jméno modulu je značka (data), doprovodné popisky jdou z katalogu.
 *  Řádky mimo katalog modulů (schranka, zaznam — moonshot 7A) nesou od
 *  bilingvního launche vlastní klíče v `nav.entries.*` (labelKey/tagKey);
 *  metriku mají jen skutečné moduly — řádky s labelKey ji nenesou. */
export function useNavLabels() {
  const t = useTranslations();
  const tc = useTranslations("content");

  return {
    name: (entry: NavEntry) =>
      entry.labelKey ? t(entry.labelKey) : (MODULES.find((m) => m.key === entry.key)?.name ?? entry.key),
    tag: (entry: NavEntry) =>
      entry.tagKey ? t(entry.tagKey) : entry.key === "overview" ? t("nav.overviewHint") : tc(`modules.${entry.key}.tag`),
    metric: (entry: NavEntry) => (entry.labelKey ? null : tc(`modules.${entry.key}.metricValue`)),
    metricLabel: (entry: NavEntry) => (entry.labelKey ? null : tc(`modules.${entry.key}.metricLabel`)),
    label: (key: string) => t(key),
    childLabel: (c: NavChild) => t(c.labelKey),
  };
}

export function BrandBlock() {
  return (
    <Link
      href="/"
      className="flex shrink-0 items-center gap-3 border-b-4 border-ink px-5 py-4 transition-colors hover:text-signal"
    >
      <svg viewBox="0 0 32 32" className="h-7 w-7 shrink-0" aria-hidden>
        <rect width="32" height="32" className="fill-signal" />
        <circle cx="16" cy="16" r="9" className="fill-paper" />
        <rect x="14.5" y="4" width="3" height="24" className="fill-ink" />
      </svg>
      <span className="min-w-0 truncate text-lg font-black uppercase tracking-tight">Politicas</span>
    </Link>
  );
}

export function SidebarFooter() {
  const t = useTranslations("common");

  return (
    <div className="shrink-0 border-t-2 border-ink px-5 py-4">
      <LanguageSwitcher />
      {/* Kadence ingesce je vlastnost platformy, ne jedné plochy — patří do
          globálního chromu, aby ji čtenář viděl na každém modulu. */}
      <SourceNote className="mt-3">{t("ingestion")}</SourceNote>
    </div>
  );
}

/** Očko sekce v seznamu kotev — sdílený tvar položky „na této stránce". */
export function SectionLink({
  index,
  label,
  href,
  active,
}: {
  index: number;
  label: string;
  href: string;
  active: boolean;
}) {
  return (
    <a
      href={href}
      aria-current={active ? "true" : undefined}
      className={`flex items-baseline gap-2.5 py-1.5 text-sm transition-colors ${
        active ? "font-bold text-ink" : "text-steel hover:text-signal"
      }`}
    >
      <span
        className={`shrink-0 font-mono text-[11px] tabular-nums ${active ? "text-signal" : "text-hairline"}`}
      >
        {String(index).padStart(2, "0")}
      </span>
      <span className="min-w-0">{label}</span>
    </a>
  );
}
