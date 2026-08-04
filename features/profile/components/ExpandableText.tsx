"use client";

/*
 * Progresivní odkrytí dlouhého prózního textu (Case ② manifestation pass —
 * dosier poslance). effort_bill_focus / effort_notes / effort_psp9_trend_note
 * bývají několik vět dlouhé citované prózy; nad práh znaků se sbalí a nabídnou
 * "více" — čtenář vidí první věty hned, zbytek na vyžádání, bez skrývání do
 * tooltipu (evidence-first: citovaný text musí jít přečíst celý, ne jen najet
 * myší).
 *
 * SBALENÍ JE VIZUÁLNÍ, NE DATOVÉ (2026-08-04). Dřív se text v DOM opravdu
 * uřízl — `text.slice(0, …)` — takže Ctrl+F v prohlížeči citovanou prózu
 * NENAŠEL, tisk vydal půlku věty a odečítač dostal „…" místo zbytku. Na ploše,
 * jejíž celý smysl je, že tvrzení stojí vedle svého důkazu, je uříznutý důkaz
 * horší než dlouhý odstavec. Text je proto v DOM VŽDY celý a schovává ho jen
 * `line-clamp` — najde ho find-in-page, vytiskne se celý a odečítač ho přečte
 * celý. Tlačítko `aria-expanded` + `aria-controls` míří na region, který
 * skutečně ovládá.
 */

import { useId, useState } from "react";
import { useTranslations } from "next-intl";

// Raised from 240 (UX audit 2026-07-27, #9): at 240 the cut consistently fell
// inside the setup sentence, before any dossier reached its payoff clause —
// verified against the two worst offenders in the corpus (Fiala's ČEZ-chair
// finding, the Teleky family-firm note), both of which land past 320.
const COLLAPSE_AT = 360;

/** Řádky, na které se sbalená próza ořízne. `COLLAPSE_AT` znaků odpovídá při
 *  sazbě téhle plochy zhruba pěti řádkům; klamp je pak vizuální ekvivalent
 *  původního řezu, jen bez ztráty textu. */
const COLLAPSED_LINES = 5;

export default function ExpandableText({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  const t = useTranslations("profile");
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const isLong = text.length > COLLAPSE_AT;
  const collapsed = isLong && !expanded;

  return (
    <>
      <p
        id={id}
        className={className}
        style={
          collapsed
            ? {
                display: "-webkit-box",
                WebkitBoxOrient: "vertical",
                WebkitLineClamp: COLLAPSED_LINES,
                overflow: "hidden",
              }
            : undefined
        }
      >
        {text}
      </p>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
          aria-controls={id}
          className="mt-1 inline-block font-mono text-[11px] font-bold uppercase tracking-wider text-cobalt hover:text-signal"
        >
          {expanded ? t("expandLess") : t("expandMore")}
        </button>
      )}
    </>
  );
}
