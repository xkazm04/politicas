"use client";

/**
 * @catalog Plynule přepočítávané číslo — skóre jako živý přístroj.
 *
 * Animuje přechod mezi hodnotami (0,5 s ease-out); formát dodává volající
 * (výchozí je česká desetinná čárka). Respektuje reduced motion tím, že
 * animace je čistě číselná a krátká — žádný pohyb geometrie.
 */

import { useEffect, useRef, useState } from "react";
import { animate } from "framer-motion";
import { czech } from "@/lib/format";

export default function AnimatedScore({
  value,
  className = "",
  format = czech,
}: {
  value: number;
  className?: string;
  format?: (n: number) => string;
}) {
  const [display, setDisplay] = useState(Number.isFinite(value) ? value : 0);
  const prev = useRef(Number.isFinite(value) ? value : 0);
  useEffect(() => {
    // A NaN/Infinity from upstream (a ratio divided by zero, an average over an
    // empty array) must never reach the animation or the formatter — animating
    // toward a non-finite target keeps `display` at whatever it last was and
    // then hands the formatter garbage. Hold the last good value instead of
    // silently rendering "NaN" in place of a civic score.
    if (!Number.isFinite(value)) return;
    const controls = animate(prev.current, value, {
      duration: 0.5,
      ease: "easeOut",
      onUpdate: (v) => setDisplay(Math.round(v * 10) / 10),
    });
    prev.current = value;
    return () => controls.stop();
  }, [value]);
  return <span className={`tabular-nums ${className}`}>{format(display)}</span>;
}
