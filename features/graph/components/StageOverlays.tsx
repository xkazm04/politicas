"use client";

/*
 * Plovoucí panely nad jevištěm — plátno je STRÁNKA, chrome pluje nad ním.
 * Konstrukt řeč: papírové karty s inkoustovým rámem, mono meta. Všechno
 * kompaktní, aby grafu zbylo maximum plochy.
 */

import type { ReactNode } from "react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, ChevronUp } from "lucide-react";
import SourceNote from "@/features/shared/components/SourceNote";
import { glyphPath, KIND_FILL_CLASS, KIND_FILL_TOKEN, KIND_ORDER, KIND_STYLE } from "../kindStyle";
import NodeInspector from "./NodeInspector";
import type { NodeSelection } from "../useNodeSelection";

/** Levý horní roh: vyhledávání + ovládání varianty. */
export function TopLeft({ children }: { children: ReactNode }) {
  return <div className="absolute left-3 top-3 z-20 flex w-[22rem] max-w-[calc(100%-6rem)] flex-col gap-2">{children}</div>;
}

/** Pravý horní roh: mono stav (počty, práce). */
export function StatChip({ children }: { children: ReactNode }) {
  return (
    <div className="absolute right-3 top-3 z-10 border-2 border-ink bg-paper px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest text-steel">
      {children}
    </div>
  );
}

/** Inspektor jako zásuvka u pravého okraje — přes plátno, ne vedle něj. */
export function InspectorDrawer({
  selection,
  onExpand,
  expandLabel,
}: {
  selection: NodeSelection;
  onExpand?: (id: string) => void;
  expandLabel?: string;
}) {
  if (!selection.selectedId) return null;
  return (
    <div className="absolute bottom-3 right-3 top-14 z-20 w-[23rem] max-w-[88vw]">
      <NodeInspector
        detail={selection.detail}
        loading={selection.loading}
        onClose={selection.clear}
        onExpand={onExpand}
        expandLabel={expandLabel}
      />
    </div>
  );
}

/** Legenda tvarosloví + metodická poznámka — sbalitelná, vlevo dole. */
export function LegendOverlay({ footnote }: { footnote: string }) {
  const t = useTranslations("graph");
  const ts = useTranslations("graph.stage");
  const tcom = useTranslations("common");
  const [open, setOpen] = useState(false);

  return (
    <div className="absolute bottom-3 left-3 z-10 max-w-[26rem] border-2 border-ink bg-paper">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-widest transition-colors hover:bg-paper-strong"
      >
        {ts("legend")}
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
      </button>
      {open && (
        <div className="border-t border-hairline px-3 py-2.5">
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {KIND_ORDER.map((kind) => {
              const style = KIND_STYLE[kind];
              return (
                <span key={kind} className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-steel">
                  <svg viewBox="-12 -12 24 24" className="h-3 w-3 shrink-0" aria-hidden>
                    {/* Barva přes slot tokenu (fill-*), aby legendu přebarvila
                        i forenzní vrstva — hex z KIND_STYLE by na tmě lhal. */}
                    <path d={glyphPath(style.shape, 9)} className={KIND_FILL_CLASS[KIND_FILL_TOKEN[kind]]} />
                  </svg>
                  {t(`kinds.${kind}`)}
                </span>
              );
            })}
            <span className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-steel">
              <svg viewBox="0 0 24 6" className="h-1.5 w-6 shrink-0" aria-hidden>
                <line x1={0} y1={3} x2={24} y2={3} className="stroke-steel" strokeWidth={2} strokeDasharray="4 4" />
              </svg>
              {tcom("pendingReview")}
            </span>
          </div>
          <SourceNote className="mt-2">{footnote}</SourceNote>
        </div>
      )}
    </div>
  );
}
