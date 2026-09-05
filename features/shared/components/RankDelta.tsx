/**
 * @catalog Posun v pořadí — ▲/▼/— s počtem míst.
 *
 * Vzestup modře, sestup červeně (řeč plakátu: modrá = klid, červená =
 * signál), beze změny šedou pomlčkou.
 */

import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { useTranslations } from "next-intl";

export default function RankDelta({ delta }: { delta: number }) {
  const t = useTranslations("common");
  // A missing previous-rank snapshot (new entrant, undefined - number) can produce a
  // NaN delta. Treat it the same as "no data" (the same neutral dash as delta === 0)
  // rather than falling through to the down/red branch, which would otherwise render
  // a specific, colorable, confidently-wrong "dropped by NaN places" claim.
  // `aria-label` on a bare <svg> or a generic <span> is not reliably announced - the
  // element needs a role that accepts a name. The whole delta is one picture-with-a-
  // sentence for a reader („o 3 místa výš“), so it is `role="img"` (scan-sweep 2026-09-07).
  if (delta === 0 || !Number.isFinite(delta)) {
    return <Minus className="h-4 w-4 text-steel" role="img" aria-label={t("rankSame")} />;
  }
  const up = delta > 0;
  return (
    <span
      role="img"
      className={`inline-flex items-center gap-0.5 font-mono text-xs font-bold ${up ? "text-cobalt" : "text-signal"}`}
      aria-label={up ? t("rankUp", { n: delta }) : t("rankDown", { n: -delta })}
    >
      {up ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
      {Math.abs(delta)}
    </span>
  );
}
