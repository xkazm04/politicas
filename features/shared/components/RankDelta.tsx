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
  if (delta === 0) return <Minus className="h-4 w-4 text-steel" aria-label={t("rankSame")} />;
  const up = delta > 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 font-mono text-xs font-bold ${up ? "text-cobalt" : "text-signal"}`}
      aria-label={up ? t("rankUp", { n: delta }) : t("rankDown", { n: -delta })}
    >
      {up ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
      {Math.abs(delta)}
    </span>
  );
}
