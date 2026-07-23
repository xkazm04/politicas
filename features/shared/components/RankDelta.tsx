/**
 * @catalog Posun v pořadí — ▲/▼/— s počtem míst.
 *
 * Vzestup modře, sestup červeně (řeč plakátu: modrá = klid, červená =
 * signál), beze změny šedou pomlčkou.
 */

import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

export default function RankDelta({ delta }: { delta: number }) {
  if (delta === 0) return <Minus className="h-4 w-4 text-steel" aria-label="beze změny" />;
  const up = delta > 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 font-mono text-xs font-bold ${up ? "text-cobalt" : "text-signal"}`}
      aria-label={up ? `vzestup o ${delta}` : `sestup o ${-delta}`}
    >
      {up ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
      {Math.abs(delta)}
    </span>
  );
}
