"use client";

/**
 * Hemicykl jednoho REÁLNÉHO hlasování — seats laid out from the vote's actual
 * ballot counts (200 per PSP10 roll call), grouped into club wedges left→right
 * by the disclosed editorial seating (record/clubStyle.ts WEDGE_ORDER), the
 * unaffiliated bucket last. Seat color = ballot bucket: pro kobalt · proti
 * signální · K okr · nepřihlášen ocel. Geometry is total-agnostic: rows are
 * allocated by largest remainder from the mock's 6-row arc, so a mid-term seat
 * count other than 200 still renders instead of throwing.
 */

import { motion, useReducedMotion } from "framer-motion";
import { COPY } from "../record/copy";
import { wedgeSort } from "../record/clubStyle";
import type { Bucket } from "../record/derive";
import type { ClubTally, LedgerVote } from "../record/types";

const ROW_WEIGHTS = [26, 30, 34, 38, 34, 38]; // 200-seat reference arc

const BUCKET_FILL: Record<Bucket, string> = {
  yes: "fill-cobalt",
  no: "fill-signal",
  k: "fill-ochre",
  away: "fill-steel",
};

interface Seat {
  x: number;
  y: number;
  angle: number;
}

/** Largest-remainder allocation of `n` seats onto the reference rows, then arc
 * placement; sorted by angle so wedges run left→right across all rows. */
function buildSeats(n: number): Seat[] {
  const totalWeight = ROW_WEIGHTS.reduce((s, w) => s + w, 0);
  const raw = ROW_WEIGHTS.map((w) => (w * n) / totalWeight);
  const counts = raw.map((r) => Math.floor(r));
  let rest = n - counts.reduce((s, c) => s + c, 0);
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; rest > 0; k = (k + 1) % order.length, rest--) counts[order[k].i]++;

  const seats: Seat[] = [];
  counts.forEach((count, r) => {
    const radius = 34 + r * 11;
    for (let i = 0; i < count; i++) {
      const angle = count === 1 ? Math.PI / 2 : Math.PI - (Math.PI * i) / (count - 1);
      // Rounded for SSR/CSR float parity (docs/DESIGN.md §5).
      seats.push({
        x: Math.round((110 + radius * Math.cos(angle)) * 100) / 100,
        y: Math.round((104 - radius * Math.sin(angle)) * 100) / 100,
        angle,
      });
    }
  });
  return seats.sort((a, b) => b.angle - a.angle);
}

const wedge = (t: ClubTally): Bucket[] => [
  ...Array<Bucket>(t.yes).fill("yes"),
  ...Array<Bucket>(t.k).fill("k"),
  ...Array<Bucket>(t.away).fill("away"),
  ...Array<Bucket>(t.no).fill("no"),
];

export default function RealHemicycle({ vote }: { vote: LedgerVote }) {
  const reduceMotion = useReducedMotion();

  const buckets: Bucket[] = [];
  for (const club of wedgeSort(Object.keys(vote.stat.byClub))) {
    buckets.push(...wedge(vote.stat.byClub[club]));
  }
  buckets.push(...wedge(vote.stat.unaffiliated));

  const seats = buildSeats(buckets.length);

  return (
    <svg viewBox="0 0 220 112" className="w-full" role="img" aria-label={COPY.hemicycleAria(vote.title)}>
      <motion.g
        key={vote.pspId}
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.35 }}
      >
        {seats.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={3.2} className={BUCKET_FILL[buckets[i]]} opacity={0.95} />
        ))}
      </motion.g>
    </svg>
  );
}
