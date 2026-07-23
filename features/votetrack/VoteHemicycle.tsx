"use client";

/**
 * Hemicykl jednoho hlasování — 200 křesel po stranických klínech
 * (zleva doprava), křeslo obarvené hlasem: pro = kobalt, proti = signální,
 * zdržel se = okr, omluven = vlasová šedá. Přepnutí hlasování obrazec
 * jemně překreslí (fade, once).
 */

import { motion, useReducedMotion } from "framer-motion";
import type { RollCall } from "@/lib/civic/data";

const ROWS = [26, 30, 34, 38, 34, 38];

/** Pořadí klínů zleva doprava — stabilní politické usazení vzorku. */
const WEDGE_ORDER = ["pir", "stan", "kdu", "top", "ods", "ano", "spd"];

const VOTE_FILL: Record<string, string> = {
  pro: "fill-cobalt",
  proti: "fill-signal",
  zdrzel: "fill-ochre",
  omluven: "fill-hairline",
};

interface Seat {
  x: number;
  y: number;
  angle: number;
}

function buildSeats(): Seat[] {
  const seats: Seat[] = [];
  ROWS.forEach((count, r) => {
    const radius = 34 + r * 11;
    for (let i = 0; i < count; i++) {
      const angle = Math.PI - (Math.PI * i) / (count - 1);
      // Zaokrouhlení kvůli SSR/CSR float driftu (viz docs/DESIGN.md).
      seats.push({
        x: Math.round((110 + radius * Math.cos(angle)) * 100) / 100,
        y: Math.round((104 - radius * Math.sin(angle)) * 100) / 100,
        angle,
      });
    }
  });
  // Zleva (úhel π) doprava (úhel 0) — stranické klíny přes všechny řady.
  return seats.sort((a, b) => b.angle - a.angle);
}

const SEATS = buildSeats();

export default function VoteHemicycle({ rc }: { rc: RollCall }) {
  const reduceMotion = useReducedMotion();
  // Křesla klínu: v rámci strany seskupit hlasy pro / zdržel / omluven / proti,
  // aby barvy tvořily čitelné bloky.
  const votes: string[] = [];
  for (const code of WEDGE_ORDER) {
    const pv = rc.byParty[code];
    votes.push(
      ...Array<string>(pv.pro).fill("pro"),
      ...Array<string>(pv.zdrzel).fill("zdrzel"),
      ...Array<string>(pv.omluven).fill("omluven"),
      ...Array<string>(pv.proti).fill("proti"),
    );
  }

  return (
    <svg viewBox="0 0 220 112" className="w-full" role="img" aria-label={`Hemicykl hlasování: ${rc.title}`}>
      <motion.g
        key={rc.id}
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.35 }}
      >
        {SEATS.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={3.2} className={VOTE_FILL[votes[i]]} opacity={0.95} />
        ))}
      </motion.g>
    </svg>
  );
}
