"use client";

/*
 * Celý pás odečtů ze vzorku — kreslí se jen při ÚPLNÉM výpadku loaderu (jedna
 * vrstva sama spadne na jedinou ./MockStatTile). Vlastní modul proto, aby se
 * `CHAMBER_STATS` a tenhle renderer nevozily na šťastné cestě.
 */

import { CHAMBER_STATS } from "@/lib/civic/data";
import MockStatTile from "./MockStatTile";

export default function MockStatTiles() {
  return (
    <>
      {CHAMBER_STATS.map((s) => (
        <MockStatTile key={s.key} statKey={s.key} />
      ))}
    </>
  );
}
