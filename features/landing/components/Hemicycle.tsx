"use client";

/**
 * Hemicykl 200 křesel jako sutnarovský bodový obrazec.
 * Řady nabíhají po scrollu (entry once). Pásma skóre: vysoké = čerň,
 * střední = kobalt, nízké = signální červená.
 */

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";

const ROWS = [26, 30, 34, 38, 34, 38];

interface Seat {
  x: number;
  y: number;
  band: number;
}

function buildRows(): Seat[][] {
  const seatRows: Seat[][] = [];
  let seatIdx = 0;
  ROWS.forEach((count, r) => {
    const radius = 34 + r * 11;
    const row: Seat[] = [];
    for (let i = 0; i < count; i++) {
      const angle = Math.PI - (Math.PI * i) / (count - 1);
      // Deterministické pseudo-skóre, aby byl obrazec stabilní mezi rendery;
      // zaokrouhlení na 2 desetinná místa — surová goniometrie se mezi
      // serverem a klientem liší v poslední číslici floatu a shodí hydrataci.
      row.push({
        x: Math.round((110 + radius * Math.cos(angle)) * 100) / 100,
        y: Math.round((104 - radius * Math.sin(angle)) * 100) / 100,
        band: (seatIdx * 37 + r * 13) % 100,
      });
      seatIdx++;
    }
    seatRows.push(row);
  });
  return seatRows;
}

const SEAT_ROWS = buildRows();

const bandClass = (b: number) => (b > 72 ? "fill-ink" : b > 38 ? "fill-cobalt" : "fill-signal");

export default function Hemicycle() {
  const t = useTranslations("landing");
  return (
    <svg viewBox="0 0 220 112" className="w-full" role="img" aria-label={t("hemicycleAria")}>
      {SEAT_ROWS.map((row, r) => (
        <motion.g
          key={r}
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ delay: r * 0.09, duration: 0.4 }}
        >
          {row.map((s, i) => (
            <circle key={i} cx={s.x} cy={s.y} r={3.2} className={bandClass(s.band)} opacity={0.92} />
          ))}
        </motion.g>
      ))}
    </svg>
  );
}
