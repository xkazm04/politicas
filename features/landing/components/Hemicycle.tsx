"use client";

/**
 * Hemicykl jako sutnarovský bodový obrazec — REÁLNÁ data (2026-08-05).
 * Jedno křeslo = jeden poslanec; vstupem je vektor skutečných skóre
 * (index přispění, řazeno sestupně), takže obrazec kreslí rozložení
 * sněmovny, ne pseudonáhodnou texturu. Pásma = třetiny pořadí:
 * horní třetina = čerň, střední = kobalt, dolní = signální červená.
 * Řady nabíhají po scrollu (entry once).
 */

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";

interface Seat {
  x: number;
  y: number;
}

/** Rozdělí `count` křesel do šesti oblouků úměrně jejich poloměru
 *  (delší oblouk = víc křesel) a spočítá souřadnice. Deterministické;
 *  zaokrouhlení na 2 desetinná místa — surová goniometrie se mezi
 *  serverem a klientem liší v poslední číslici floatu a shodí hydrataci. */
function buildRows(count: number): Seat[][] {
  const radii = [34, 45, 56, 67, 78, 89];
  const total = radii.reduce((s, r) => s + r, 0);
  const perRow = radii.map((r) => Math.floor((count * r) / total));
  let remainder = count - perRow.reduce((s, n) => s + n, 0);
  for (let i = radii.length - 1; remainder > 0; i = (i - 1 + radii.length) % radii.length) {
    perRow[i] += 1;
    remainder -= 1;
  }
  return radii.map((radius, r) => {
    const n = perRow[r];
    const row: Seat[] = [];
    for (let i = 0; i < n; i++) {
      const angle = n === 1 ? Math.PI / 2 : Math.PI - (Math.PI * i) / (n - 1);
      row.push({
        x: Math.round((110 + radius * Math.cos(angle)) * 100) / 100,
        y: Math.round((104 - radius * Math.sin(angle)) * 100) / 100,
      });
    }
    return row;
  });
}

export default function Hemicycle({
  scores,
}: {
  /** Reálná skóre všech poslanců, řazená sestupně (pořadí žebříčku). */
  scores: number[];
}) {
  const t = useTranslations("landing");
  const rows = buildRows(scores.length);
  // Pásma po třetinách POŘADÍ — křeslo k patří k-tému poslanci žebříčku.
  const t1 = Math.floor(scores.length / 3);
  const t2 = Math.floor((2 * scores.length) / 3);
  const bandClass = (idx: number) => (idx < t1 ? "fill-ink" : idx < t2 ? "fill-cobalt" : "fill-signal");

  // Kumulativní posun řad — křeslo (r, i) patří poslanci offsets[r] + i.
  const offsets: number[] = [];
  rows.reduce((acc, row) => {
    offsets.push(acc);
    return acc + row.length;
  }, 0);

  return (
    <svg
      viewBox="0 0 220 112"
      className="w-full"
      role="img"
      aria-label={t("hemicycleAria", { count: scores.length })}
    >
      {rows.map((row, r) => (
        <motion.g
          key={r}
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ delay: r * 0.09, duration: 0.4 }}
        >
          {row.map((s, i) => (
            <circle key={i} cx={s.x} cy={s.y} r={3.2} className={bandClass(offsets[r] + i)} opacity={0.92} />
          ))}
        </motion.g>
      ))}
    </svg>
  );
}
