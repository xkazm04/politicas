"use client";

/*
 * „Sledovat" — jediná veřejná afordance sledování (moonshot 7A).
 *
 * Malé přepínací tlačítko, které smí adoptovat kterákoli plocha: dej mu klíč
 * entity (týž veřejný klíč jako filtr deníku `?entita=`) a popisek. Stav žije
 * v localStorage (useSchranka), žádný účet. Přepínač je `aria-pressed`,
 * plně klávesový (skutečný <button>), bez animací.
 *
 * PŘÍSTUPNÁ JMENOVKA: samotné „sledovat" je pro odečítač obrazovky tvrzení
 * bez podmětu — na žebříčku jich vedle sebe stojí dvě stě. Plocha proto smí
 * dodat `subject` (koho tlačítko sleduje) a jmenovka pak zní „sledovat: Jan
 * Novák". Dvojtečka je záměr: čeština by u „sledovat poslance <jméno>"
 * vyžadovala skloňování jména, které aplikace nemá odkud vzít.
 *
 * SLOVA: od 2026-08-05 jdou výchozí slova z katalogu (`common.followWord` /
 * `common.followingWord`, next-intl) — tlačítko mluví jazykem plochy. Plocha
 * s vlastní dikcí může slova dál podat v `words` (přepis katalogu).
 */

import { useTranslations } from "next-intl";
import { Eye, EyeOff } from "lucide-react";
import { isEntityKey } from "./followCodec";
import { useSchranka } from "./useSchranka";

export interface FollowWords {
  follow: string;
  following: string;
}

export default function FollowButton({
  entityKey,
  label,
  compact = false,
  iconOnly = false,
  subject,
  words,
}: {
  /** Veřejný klíč entity (`poslanec:<id>` | `firma:<ičo>` | `tisk:<č>` | `obec:<ičo>`). */
  entityKey: string;
  /** Popisek entity v okamžiku sledování (nápověda; schránka pak bere popisky ze záznamů). */
  label: string;
  /** Úsporná varianta pro lištu. */
  compact?: boolean;
  /** Jen ikona — pro husté řádky (žebříček). Význam nese přístupná jmenovka. */
  iconOnly?: boolean;
  /** Koho tlačítko sleduje — jde do přístupné jmenovky („sledovat: Jan Novák"). */
  subject?: string;
  /** Viditelná slova pro plochu s vlastní dikcí; výchozí je katalog (common.*). */
  words?: FollowWords;
}) {
  const t = useTranslations("common");
  const { isFollowed, follow, unfollow } = useSchranka();
  if (!isEntityKey(entityKey)) return null;

  const on = isFollowed(entityKey);
  const word = on ? (words?.following ?? t("followingWord")) : (words?.follow ?? t("followWord"));
  const ariaLabel = subject ? `${word}: ${subject}` : iconOnly ? word : undefined;
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={ariaLabel}
      title={subject ? `${word}: ${subject}` : undefined}
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
      {!iconOnly && word}
    </button>
  );
}
