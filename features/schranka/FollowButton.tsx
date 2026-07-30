"use client";

/*
 * „Sledovat" — jediná veřejná afordance sledování (moonshot 7A).
 *
 * Malé přepínací tlačítko, které smí adoptovat kterákoli plocha: dej mu klíč
 * entity (týž veřejný klíč jako filtr deníku `?entita=`) a popisek. Stav žije
 * v localStorage (useSchranka), žádný účet. Přepínač je `aria-pressed`,
 * plně klávesový (skutečný <button>), bez animací.
 */

import { Eye, EyeOff } from "lucide-react";
import { isEntityKey } from "./followCodec";
import { useSchranka } from "./useSchranka";

export default function FollowButton({
  entityKey,
  label,
  compact = false,
}: {
  /** Veřejný klíč entity (`poslanec:<id>` | `firma:<ičo>` | `tisk:<č>` | `obec:<ičo>`). */
  entityKey: string;
  /** Popisek entity v okamžiku sledování (nápověda; schránka pak bere popisky ze záznamů). */
  label: string;
  /** Úsporná varianta pro lištu. */
  compact?: boolean;
}) {
  const { isFollowed, follow, unfollow } = useSchranka();
  if (!isEntityKey(entityKey)) return null;

  const on = isFollowed(entityKey);
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => (on ? unfollow(entityKey) : follow(entityKey, label))}
      className={`inline-flex items-center gap-1.5 border font-mono font-bold uppercase tracking-wider transition-colors ${
        compact ? "px-2 py-1 text-[11px]" : "px-3 py-1.5 text-xs"
      } ${
        on
          ? "border-cobalt bg-cobalt text-paper hover:bg-paper hover:text-cobalt"
          : "border-ink text-ink hover:bg-ink hover:text-paper"
      }`}
    >
      {on ? <EyeOff className="h-3.5 w-3.5" aria-hidden /> : <Eye className="h-3.5 w-3.5" aria-hidden />}
      {on ? "sledujete" : "sledovat"}
    </button>
  );
}
