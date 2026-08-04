"use client";

/**
 * @catalog Plynule přepočítávané číslo — skóre jako živý přístroj.
 *
 * Animuje přechod mezi hodnotami (0,5 s ease-out); formát dodává volající
 * (výchozí je česká desetinná čárka). Při `prefers-reduced-motion` se přechod
 * NEPŘEHRÁVÁ — hodnota skočí rovnou na cílovou. Dřív tu stálo, že animace je
 * „čistě číselná a krátká, takže reduced motion respektuje"; běžící číslice je
 * ale právě ten pohyb, kvůli kterému WCAG 2.3.3 existuje, a zbytek /poslanec
 * se tou preferencí řídil.
 *
 * S `claim` se z čísla stává CITACE: vysází se jako `<data>` s data-claim-*
 * atributy z jediného emitoru (lib/claims/claim.ts), stejnými, jaké vydává
 * <CitableNumber>. Atributy nesou CÍLOVOU hodnotu, ne mezikrok animace —
 * strojová hodnota se nesmí měnit s průběhem přechodu.
 */

import { useEffect, useRef, useState } from "react";
import { animate, useReducedMotion } from "framer-motion";
import { czech } from "@/lib/format";

/** Ty členy `Formatters`, které berou číslo a vracejí text (tj. bez `date`/`cite`). */
type NumericFormatKind = "dec" | "int" | "czk";
import { useFormat } from "@/lib/i18n/useFormat";
import { claimDataAttributes, type Claim } from "@/lib/claims/claim";

export default function AnimatedScore({
  value,
  className = "",
  format,
  formatKind,
  claim,
}: {
  value: number;
  className?: string;
  /** Formátovač od volajícího. Použitelný JEN z klientského stromu — funkce se
   *  přes hranici serverové komponenty neserializuje. Ze serveru se předává
   *  `formatKind`, který si komponenta vyzvedne sama. */
  format?: (n: number) => string;
  /** Který formátovač `lib/format` použít, když `format` nepřijde (server → klient). */
  formatKind?: NumericFormatKind;
  /** Citace figury; bez ní se sází prostý <span> jako dřív. */
  claim?: Claim;
}) {
  const reduceMotion = useReducedMotion();
  const fmts = useFormat();
  // Beze změny pro dosavadní volající: bez `format` i bez `formatKind` je to
  // pořád `czech`, jak stálo v defaultní hodnotě parametru.
  const fmt = format ?? (formatKind ? fmts[formatKind] : czech);
  const [display, setDisplay] = useState(Number.isFinite(value) ? value : 0);
  const prev = useRef(Number.isFinite(value) ? value : 0);
  useEffect(() => {
    // A NaN/Infinity from upstream (a ratio divided by zero, an average over an
    // empty array) must never reach the animation or the formatter — animating
    // toward a non-finite target keeps `display` at whatever it last was and
    // then hands the formatter garbage. Hold the last good value instead of
    // silently rendering "NaN" in place of a civic score.
    if (!Number.isFinite(value)) return;
    // Reduced motion: no transition is started at all. The rendered value comes
    // straight from `value` below (never via setState in an effect), so the
    // digits do not run; `prev` still tracks the target so a later re-enable
    // animates from the right place.
    if (reduceMotion) {
      prev.current = value;
      return;
    }
    const controls = animate(prev.current, value, {
      duration: 0.5,
      ease: "easeOut",
      onUpdate: (v) => setDisplay(Math.round(v * 10) / 10),
    });
    prev.current = value;
    return () => controls.stop();
  }, [value, reduceMotion]);
  // Při reduced motion se sází CÍLOVÁ hodnota rovnou — žádný mezikrok, a žádné
  // setState v efektu (kaskádový render).
  const shown = reduceMotion && Number.isFinite(value) ? value : display;
  // Nefinální hodnota nesvědčí (týž zákaz jako v CitableNumber): pomlčka ani
  // podržená poslední hodnota nesmí nést strojové tvrzení.
  if (claim && Number.isFinite(value)) {
    return (
      <data
        value={String(value)}
        {...claimDataAttributes(claim, value)}
        className={`tabular-nums ${className}`}
      >
        {fmt(shown)}
      </data>
    );
  }
  return <span className={`tabular-nums ${className}`}>{fmt(shown)}</span>;
}
