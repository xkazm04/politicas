/**
 * Vysvětlivka tříd vazby — vlastník/jednatel vs. představenstvo vs. dozorčí (P29
 * pravidlo). Bez tohohle štítku vedle sebe splyne dozorčí funkce v nemocnici s
 * majitelem firmy, která dodává státu — jedno je obohacení, druhé vlastní veřejná
 * činnost instituce. Používá se v knize vazeb i ve spisu poslance, aby čtenář vždy
 * viděl stejnou definici na stejném místě.
 */

import { useLocale } from "next-intl";
import { tieClassInfo, type TieClass } from "../moneyTypes";

const TONE_CLS: Record<string, string> = {
  signal: "border-signal text-signal",
  cobalt: "border-cobalt text-cobalt",
  steel: "border-hairline text-steel",
};

const CLASSES: TieClass[] = ["owner-operator", "manager", "steward"];

export default function TieClassExplainer({ compact = false }: { compact?: boolean }) {
  const locale = useLocale();
  const en = locale === "en";

  return (
    <div className={compact ? "grid gap-3 sm:grid-cols-3" : "grid gap-px border border-ink bg-ink sm:grid-cols-3"}>
      {CLASSES.map((cls) => {
        const info = tieClassInfo(cls);
        return (
          <div key={cls} className={compact ? `border-2 p-4 ${TONE_CLS[info.tone]}` : "bg-paper p-5"}>
            <span
              className={`inline-block border-2 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${TONE_CLS[info.tone]}`}
            >
              {en ? info.labelEn : info.labelCs}
            </span>
            <p className="mt-2 text-sm leading-relaxed text-steel">{en ? info.descEn : info.descCs}</p>
          </div>
        );
      })}
    </div>
  );
}
