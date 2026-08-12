"use client";

/**
 * Stavový řádek souboje — JEDINÁ oblast, která hlásí, kdo právě stojí proti
 * komu.
 *
 * Proč existuje (2026-08-12): sekce „Souboj" sedí NAD žebříčkem, ale vybírá se
 * v něm — tlačítkem „vs" u řádku, klidně u sto padesátého. Kliknutí tedy měnilo
 * panel o čtyři obrazovky výš a neřeklo o tom vůbec nic: vidoucí čtenář viděl
 * zčervenat jen vlastní tlačítko, nevidoucí neslyšel nic.
 *
 * JEDEN MECHANISMUS, NE DVA: hlásí se tady, a proto `HeadToHead` sám žádnou
 * živou oblast nemá. Panel se navíc přemontovává přes `AnimatePresence`, takže
 * živá oblast uvnitř něj by se při každé změně dvojice odpojila a znovu
 * připojila — odečítačky z toho podle enginu dělají dvojí čtení, nebo mlčení.
 * Tenhle prvek stojí MIMO tu animaci a jen mění text.
 */

import { useTranslations } from "next-intl";
import type { LeaderboardListEntry } from "../getLeaderboardData";

export default function DuelStatus({
  selected,
  /** Volitelná pravá strana řádku (odkaz na sdílení souboje) — mimo živou
   *  oblast, aby se změna tlačítka nečetla jako změna stavu. */
  action,
}: {
  /** Poslanci vybraní do souboje, v pořadí výběru (0–2). Rozřešení dělá
   *  stránka — tenhle prvek nic nedohledává. */
  selected: readonly LeaderboardListEntry[];
  action?: React.ReactNode;
}) {
  const t = useTranslations("civicscore");

  const sentence =
    selected.length >= 2
      ? t("duelStatusPair", { a: selected[0].name, b: selected[1].name })
      : selected.length === 1
        ? t("duelStatusOne", { name: selected[0].name })
        : t("duelStatusNone");

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-l-4 border-hairline pl-3">
      <p role="status" aria-live="polite" className="font-mono text-xs uppercase tracking-widest text-steel-aa">
        {sentence}
      </p>
      {action}
    </div>
  );
}
