/**
 * @catalog Seznam příznaků: štítek + vysvětlující věta; nepřeložený strojový token je odlišený, nikdy skrytý.
 *
 * Vznik (2026-08-04): plochy sázely strojové tokeny z grafu (`stale-ongoing-in-graph`,
 * `dataor-checked-not-isvr-registered`) doslova a bez vysvětlení — na VEŘEJNÉM spisu
 * poslance. Štítek bez věty je pro čtenáře šum; věta bez štítku se nedá přehlédnout na
 * kartě. Tenhle primitiv sází obojí a drží jedno pravidlo pro obě plochy, které příznaky
 * zobrazují (interní konzole i veřejný spis).
 *
 * Doménově neutrální: neví nic o penězích ani o vazbách — dostane hotové položky
 * (`label` + `note` + tón) přes props, jak vyžaduje hranice `features/shared/**`.
 *
 * Tón: `warn` kaz v datech nebo v tvrzení · `info` procesní poznámka · `lead` samostatná
 * nedoložená stopa · `machine` značka, pro kterou produkt nemá přeloženou větu (ta se sází
 * jako `font-mono`, aby bylo na první pohled vidět, že jde o strojový identifikátor).
 */

export type FlagTone = "warn" | "info" | "lead" | "machine";

export interface FlagItem {
  /** Stabilní klíč (typicky doslovný token). */
  key: string;
  label: string;
  /** Věta, která štítek vysvětluje. Prázdná = sází se jen štítek. */
  note?: string;
  tone: FlagTone;
}

const CHIP: Record<FlagTone, string> = {
  warn: "border-ochre bg-ochre/15 text-ink",
  info: "border-hairline text-steel-aa",
  lead: "border-cobalt text-cobalt",
  machine: "border-dashed border-steel font-mono text-steel-aa",
};

export default function FlagList({
  items,
  heading,
  className = "",
}: {
  items: readonly FlagItem[];
  /** Volitelný nadpis sekce (např. „příznaky z analytických průchodů"). */
  heading?: string;
  className?: string;
}) {
  if (items.length === 0) return null;
  return (
    <div className={className}>
      {heading ? (
        <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-steel-aa">{heading}</p>
      ) : null}
      <ul className={`space-y-1.5 ${heading ? "mt-2" : ""}`}>
        {items.map((item) => (
          <li key={item.key} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span
              className={`border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${CHIP[item.tone]}`}
            >
              {item.label}
            </span>
            {item.note ? (
              <span className="min-w-[12rem] flex-1 text-xs leading-relaxed text-steel-aa">{item.note}</span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
