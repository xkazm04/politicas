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
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
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
