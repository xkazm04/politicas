/**
 * Vysvětlivka tříd vazby — vlastník/jednatel vs. představenstvo vs. dozorčí (P29
 * pravidlo). Bez tohohle štítku vedle sebe splyne dozorčí funkce v nemocnici s
 * majitelem firmy, která dodává státu — jedno je obohacení, druhé vlastní veřejná
 * činnost instituce. Používá se v knize vazeb i ve spisu poslance, aby čtenář vždy
 * viděl stejnou definici na stejném místě.
 */

import { useLocale, useTranslations } from "next-intl";
import { tieClassInfo, tieClassOriginInfo, type TieClass, type TieClassOrigin } from "../moneyTypes";

const TONE_CLS: Record<string, string> = {
  signal: "border-signal text-signal",
  cobalt: "border-cobalt text-cobalt",
  steel: "border-hairline text-steel",
};

const CLASSES: TieClass[] = ["owner-operator", "manager", "steward"];
const ORIGINS: TieClassOrigin[] = ["stored", "derived"];

export default function TieClassExplainer({ compact = false }: { compact?: boolean }) {
  const locale = useLocale();
  const en = locale === "en";
  const t = useTranslations("money");

  return (
    <div>
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

      {/* Odkud třída je. Bez tohohle by se odhad programu četl stejně autoritativně jako
          údaj, který někdo skutečně zapsal po kontrole v rejstříku. */}
      <div className="mt-4 border-t-2 border-hairline pt-3">
        <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-steel">
          {t("tieExplainer.originHeading")}
        </p>
        <dl className="mt-2 grid gap-2 sm:grid-cols-2">
          {ORIGINS.map((o) => {
            const oi = tieClassOriginInfo(o);
            return (
              <div key={o}>
                <dt
                  className={`font-mono text-[10px] font-bold uppercase tracking-widest ${o === "stored" ? "text-ink" : "text-ochre"}`}
                >
                  {en ? oi.labelEn : oi.labelCs}
                </dt>
                <dd className="mt-0.5 text-sm leading-relaxed text-steel">{en ? oi.noteEn : oi.noteCs}</dd>
              </div>
            );
          })}
        </dl>
      </div>
    </div>
  );
}
