"use client";

/*
 * Progresivní odkrytí dlouhého prózního textu (Case ② manifestation pass —
 * dosier poslance). effort_bill_focus / effort_notes bývají několik vět
 * dlouhé citované prózy; nad práh znaků se strihnou a nabídnou "více" —
 * čtenář vidí první větu hned, zbytek na vyžádání, bez skrývání do tooltipu
 * (evidence-first: citovaný text musí jít přečíst celý, ne jen najet myší).
 *
 * Feature-local, ne shared/: chová se čistě text→text, ale vázané na dosier
 * copy (mono "více"/"méně" tlačítko v tónu profilu). Kandidát na
 * features/shared/components, pokud se objeví druhé použití mimo profil.
 */

import { useState } from "react";
import { useTranslations } from "next-intl";

// Raised from 240 (UX audit 2026-07-27, #9): at 240 the cut consistently fell
// inside the setup sentence, before any dossier reached its payoff clause —
// verified against the two worst offenders in the corpus (Fiala's ČEZ-chair
// finding, the Teleky family-firm note), both of which land past 320.
const COLLAPSE_AT = 360;

/** Cuts at the sentence boundary (". ", "! ", "? ") nearest to but not before
 *  COLLAPSE_AT, so collapsed prose always ends on a complete thought instead
 *  of mid-word. Falls back to the nearest word boundary if no sentence ends
 *  within a reasonable stretch after the threshold (e.g. one very long
 *  run-on sentence) — never a hard character slice. */
function collapseBoundary(text: string, at: number): number {
  const tail = text.slice(at, at + 200);
  const sentenceEnd = tail.search(/[.!?]\s/);
  if (sentenceEnd !== -1) return at + sentenceEnd + 1;
  const wordEnd = text.slice(0, at).lastIndexOf(" ");
  return wordEnd > 0 ? wordEnd : at;
}

export default function ExpandableText({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  const t = useTranslations("profile");
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > COLLAPSE_AT;
  const shown = !isLong || expanded ? text : `${text.slice(0, collapseBoundary(text, COLLAPSE_AT)).trimEnd()}…`;

  return (
    <p className={className}>
      {shown}
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
          className="ml-2 inline-block font-mono text-[11px] font-bold uppercase tracking-wider text-cobalt hover:text-signal"
        >
          {expanded ? t("expandLess") : t("expandMore")}
        </button>
      )}
    </p>
  );
}
