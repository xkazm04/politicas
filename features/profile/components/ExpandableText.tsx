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

const COLLAPSE_AT = 240;

export default function ExpandableText({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > COLLAPSE_AT;
  const shown = !isLong || expanded ? text : `${text.slice(0, COLLAPSE_AT).trimEnd()}…`;

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
          {expanded ? "méně" : "více"}
        </button>
      )}
    </p>
  );
}
