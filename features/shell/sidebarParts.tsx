"use client";

/*
 * Společné díly obou variant levé lišty — hlavička se značkou, patička
 * a překlad popisků řádků. Varianty se mají lišit KOMPOZICÍ (jak je obsah
 * stránky svázaný s navigací), ne tím, že by každá jinak psala „Politicas".
 */

import { useTranslations } from "next-intl";
import Link from "next/link";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import SourceNote from "@/features/shared/components/SourceNote";
import type { NavChild, NavEntry, NavSection } from "./navModel";

export interface SidebarProps {
  pathname: string;
  /** Kotvy, které na stránce opravdu existují. */
  sections: NavSection[];
  activeSection: string | null;
  activeEntry: NavEntry | undefined;
}

/**
 * Jméno modulu je ZNAČKA (nepřekládá se, jde z `navModel.brandName`),
 * doprovodné popisky jdou z katalogu. Řádky mimo katalog modulů (schranka,
 * zaznam — moonshot 7A) nesou od bilingvního launche vlastní klíče
 * v `nav.entries.*` (labelKey/tagKey).
 *
 * ── ŽÁDNÝ UKÁZKOVÝ KATALOG (2026-08-13) ────────────────────────────────────
 * Tenhle soubor sahal na `MODULES` z `lib/civic/data.ts` — jediným výrazem,
 * `MODULES.find((m) => m.key === entry.key)?.name` — a tím tahal CELÝ ukázkový
 * katalog do chunku, který si webpack sdílí mezi routami. Změřeno na buildu
 * 2026-08-13: chunk `975-*.js`, 14 615 B, referencovaný 42 ze 42 manifestů
 * stránek — tedy i /graf, /admin a /rentgen, které lištu vůbec nekreslí, i
 * oběma právními dokumenty. Uvnitř: vymyšlení čeští lidé („Petra Nováková",
 * „Karel Hruška"), vymyšlené firmy s vymyšlenými IČO („Silnice MSK a.s." /
 * 258 41 991, „Agrofond s.r.o." / 470 12 336) a „2,1 mld Kč" — v aplikaci,
 * která staví na rozdílu mezi doloženým a vymyšleným. Vykreslovaná polovina
 * (metriky) padla 2026-08-11 (viz níž), odesílaná až teď. Tím se doplácejí
 * i obě dělení kódu (/penize, /dashboard), jejichž vlastní hlavičky si tenhle
 * chunk zapsaly jako přiznanou mez, kterou žádná změna v modulu neodstraní.
 *
 * Jméno modulu teď deklaruje `features/shell/navModel.ts` — model, který
 * seznam modulů beztak vlastní. Vykreslené popisky se nezměnily ani o bajt.
 *
 * ── ŽÁDNÁ METRIKA (2026-08-11) ─────────────────────────────────────────────
 * `metric()` sem tahalo `content.modules.<key>.metricValue` — „2,1 mld Kč",
 * „312", „5 214", „6 254", „200" — a rail i mobilní navigace to vypisovaly na
 * KAŽDÉ routě: vymyšlená čísla bez citace, v aplikaci, jejíž značkové pravidlo
 * zní, že každé vypsané číslo cituje svůj zdroj. Doprovodné `metricLabel`
 * („— ilustrativní ukázka"), které jediné to přiznávalo, nerenderoval nikdo;
 * `metricLabel()` bylo mrtvé od začátku. Plakát tuhle dvojici smazal už dřív
 * (features/landing/components/SystemModules.tsx). Rail teď nese identitu
 * modulu — jméno a rubriku — a jediné číslo v navigaci je REÁLNÝ odznak
 * schránky. Zpátky to nepatří: pinuje to ./sidebarParts.test.ts.
 */
export function useNavLabels() {
  const t = useTranslations();
  const tc = useTranslations("content");

  return {
    name: (entry: NavEntry) => (entry.labelKey ? t(entry.labelKey) : (entry.brandName ?? entry.key)),
    tag: (entry: NavEntry) =>
      entry.tagKey ? t(entry.tagKey) : entry.key === "overview" ? t("nav.overviewHint") : tc(`modules.${entry.key}.tag`),
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
  const tLanding = useTranslations("landing");

  return (
    <div className="shrink-0 border-t-2 border-ink px-5 py-4">
      <LanguageSwitcher />
      {/* Kadence ingesce je vlastnost platformy, ne jedné plochy — patří do
          globálního chromu, aby ji čtenář viděl na každém modulu. */}
      <SourceNote className="mt-3">{t("ingestion")}</SourceNote>
      {/* Právní dokumenty musí být dosažitelné z každé plochy, ne jen z plakátu. */}
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px] uppercase tracking-widest">
        <Link
          href="/ochrana-osobnich-udaju"
          className="text-steel-aa transition-colors hover:text-signal"
        >
          {tLanding("footerPrivacy")}
        </Link>
        <Link href="/podminky" className="text-steel-aa transition-colors hover:text-signal">
          {tLanding("footerTerms")}
        </Link>
      </div>
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
