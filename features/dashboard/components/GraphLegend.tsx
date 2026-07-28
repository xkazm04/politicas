"use client";

/*
 * Legenda tvarosloví — bez ní je uzlový graf hezký obrázek, ne důkaz.
 * Součástí je i poznámka o čárkované hraně: co čeká na lidskou kontrolu, se
 * nikdy nevydává za fakt (evidence-first doktrína, docs/DESIGN.md §3).
 */

import { useTranslations } from "next-intl";
import type { StateNodeKind } from "@/lib/civic/stateGraph";
import GraphGlyph from "./GraphGlyph";

/** Kanonické pořadí tvarosloví — legenda z něj bere jen to, co graf kreslí. */
const KIND_ORDER: StateNodeKind[] = ["person", "company", "money", "party", "vote", "bill", "law"];

export default function GraphLegend({
  kinds,
  compact = false,
}: {
  /** Druhy uzlů skutečně přítomné v grafu. Legenda, která jmenuje tvar, jenž na
   *  ploše není, není legenda — je to seznam přání. */
  kinds?: StateNodeKind[];
  compact?: boolean;
}) {
  const tg = useTranslations("dashboard.graph");
  const present = kinds ? KIND_ORDER.filter((k) => kinds.includes(k)) : KIND_ORDER;

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[11px] uppercase tracking-widest text-steel">
      {!compact && <span className="font-bold text-ink">{tg("legendTitle")}</span>}
      {present.map((kind) => (
        <span key={kind} className="flex items-center gap-1.5">
          <svg viewBox="-12 -12 24 24" className="h-3.5 w-3.5 shrink-0" aria-hidden>
            <GraphGlyph kind={kind} lit />
          </svg>
          {tg(`kinds.${kind}`)}
        </span>
      ))}
      <span className="flex items-center gap-1.5">
        <svg viewBox="0 0 24 6" className="h-1.5 w-6 shrink-0" aria-hidden>
          <line x1={0} y1={3} x2={24} y2={3} className="stroke-steel" strokeWidth={2} strokeDasharray="4 4" />
        </svg>
        {tg("pendingEdge")}
      </span>
    </div>
  );
}
