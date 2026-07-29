"use client";

/**
 * Přepínač variant úvodní strany (experiment /impeccable, 2026-07-29).
 *
 * Na `/` sedí pruh záložek: zděděná stránka + čtyři varianty vyrobené povely
 * impeccable (bolder · distill · nový svět · typeset+colorize). Výchozí je
 * ZDĚDĚNÁ verze — experiment nesmí přepsat produkční úvodní stranu tím, že se
 * spustí.
 *
 * Výběr se drží v URL (`?v=b`) přes `history.replaceState` a čte se až v
 * mount efektu, ne přes `useSearchParams`: ten by buď vynutil dynamické
 * vykreslení, nebo hrozil hydratačním rozjezdem, který si tenhle repozitář už
 * jednou zaplatil (viz features/dashboard/useGraphSelection.ts a
 * memory/revalidate-is-inert-every-route-is-dynamic.md). První render je proto
 * na obou stranách `INCUMBENT`.
 *
 * Data: varianty čtou SKUTEČNÝ graf (getLandingData). Když loader vrátí null,
 * varianty se nepřepínají na vymyšlená čísla — řeknou to a nabídnou zděděnou
 * stránku, která má vlastní OZNAČENOU ukázku.
 */

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import VariantTabs, { type VariantTab } from "@/features/shared/components/VariantTabs";
import LiveDataNotice from "@/features/shared/components/LiveDataNotice";
import LandingPage from "./LandingPage";
import type { LandingData } from "./getLandingData";
import VariantBolder from "./variants/VariantBolder";
import VariantDistill from "./variants/VariantDistill";
import VariantLedger from "./variants/VariantLedger";
import VariantTypeset from "./variants/VariantTypeset";

const INCUMBENT = "incumbent";
const VARIANT_IDS = [INCUMBENT, "a", "b", "c", "d"] as const;
type VariantId = (typeof VARIANT_IDS)[number];

const isVariantId = (v: string | null): v is VariantId =>
  v !== null && (VARIANT_IDS as readonly string[]).includes(v);

/**
 * Adresní řádek je EXTERNÍ systém, ne odvozený stav — takže se čte přes
 * `useSyncExternalStore`, ne `setState` v efektu. `react-hooks/set-state-in-effect`
 * je v tomhle repu chyba, ne varování (memory/react-state-lint-patterns.md), a má
 * pravdu: čtení z `window.location` v efektu je přesně ta kaskáda, kterou zakazuje.
 *
 * `replaceState` sám žádnou událost nevyvolá, takže si posluchače držíme sami a
 * po každém zápisu je zavoláme; `popstate` pokrývá tlačítko zpět.
 */
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("popstate", notify);
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0) window.removeEventListener("popstate", notify);
  };
}

/** Vrací řetězec, takže porovnání hodnotou stačí a snapshot nemusíme cachovat. */
function readVariant(): VariantId {
  const raw = new URLSearchParams(window.location.search).get("v");
  return isVariantId(raw) ? raw : INCUMBENT;
}

export default function LandingSwitcher({ data }: { data: LandingData | null }) {
  const t = useTranslations("landingVariants");
  // Server i první klientský render dávají INCUMBENT — hydratace se tak nemůže
  // rozejít na hodnotě, kterou server nezná.
  const variant = useSyncExternalStore(subscribe, readVariant, () => INCUMBENT as VariantId);

  // Hodnotu, kterou neznáme, z adresy smažeme — ať nikdo nesdílí odkaz, který
  // nic nevybírá. Zápis do externího systému, žádný setState.
  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get("v");
    if (raw === null || isVariantId(raw)) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("v");
    window.history.replaceState(null, "", url.toString());
    notify();
  }, []);

  const select = useCallback((id: string) => {
    if (!isVariantId(id)) return;
    const url = new URL(window.location.href);
    if (id === INCUMBENT) url.searchParams.delete("v");
    else url.searchParams.set("v", id);
    // Výběr varianty není navigace — replaceState, ne push.
    window.history.replaceState(null, "", url.toString());
    notify();
  }, []);

  const tabs: VariantTab[] = [
    { id: INCUMBENT, label: t("tabIncumbent"), hint: t("hintIncumbent") },
    { id: "a", label: t("tabA"), hint: t("hintA") },
    { id: "b", label: t("tabB"), hint: t("hintB") },
    { id: "c", label: t("tabC"), hint: t("hintC") },
    { id: "d", label: t("tabD"), hint: t("hintD") },
  ];

  const liveVariant = variant !== INCUMBENT;

  return (
    <>
      <VariantTabs tabs={tabs} value={variant} onChange={select} ariaLabel={t("tabsAria")} />

      {liveVariant && !data && (
        <div className="mx-auto max-w-6xl px-6 pt-6">
          <LiveDataNotice
            title={t("noDataTitle")}
            body={t("noDataBody")}
            source={t("noDataSource")}
          />
        </div>
      )}

      {variant === INCUMBENT || !data ? (
        <LandingPage />
      ) : variant === "a" ? (
        <VariantBolder data={data} />
      ) : variant === "b" ? (
        <VariantDistill data={data} />
      ) : variant === "c" ? (
        <VariantLedger data={data} />
      ) : (
        <VariantTypeset data={data} />
      )}
    </>
  );
}
