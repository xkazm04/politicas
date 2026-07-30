"use client";

/*
 * Forenzní panely nad jevištěm (batch 7D) — referenční integrace režimu.
 *
 * Pásek: přiznává výchozí filtr „jen ověřené hrany" — skryté ČEKAJÍCÍ hrany
 * se počítají nahlas a jedním tlačítkem se dají přikreslit (čárkovaně).
 * Vyžádané čočky (trasa, spočítaná cesta) se nefiltrují nikdy — vynechaný
 * krok ve vyžádané odpovědi by byl lež; pásek to říká.
 *
 * Karta najetí: stavy lidské kontroly kolem uzlu BEZ klikání — najetí
 * ukazatelem vypíše rozpad ověřené/čekající po relacích (čistý model
 * hoverCardModel ve forensicView.ts). Karta je pointer-events-none, aby
 * nekradla najetí plátnu, a na malých displejích se skrývá (najetí tam
 * neexistuje; plný záznam dál nabízí klik = inspektor).
 */

import { useTranslations } from "next-intl";
import { ScanLine, ShieldCheck } from "lucide-react";
import SourceNote from "@/features/shared/components/SourceNote";
import { useFormat } from "@/lib/i18n/useFormat";
import type { HoverCardModel } from "../forensicView";

export function ForensicStrip({
  hiddenPending,
  keptPending,
  showPending,
  onTogglePending,
}: {
  hiddenPending: number;
  keptPending: number;
  showPending: boolean;
  onTogglePending: () => void;
}) {
  const t = useTranslations("graph.forensic");
  const f = useFormat();
  return (
    <div className="border-2 border-signal bg-paper">
      <div className="flex items-center gap-2 border-b border-hairline px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-widest text-signal">
        <ScanLine className="h-3.5 w-3.5" aria-hidden />
        {t("strip")}
      </div>
      <div className="px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-steel-aa">
        {showPending ? (
          <p>{t("showingPending", { n: f.int(hiddenPending) })}</p>
        ) : hiddenPending > 0 ? (
          <p>{t("hidden", { n: f.int(hiddenPending) })}</p>
        ) : (
          <p>{t("none")}</p>
        )}
        {keptPending > 0 && <p className="mt-1">{t("lensNote", { n: f.int(keptPending) })}</p>}
        {hiddenPending > 0 && (
          <button
            type="button"
            onClick={onTogglePending}
            aria-pressed={showPending}
            className="mt-1.5 border border-ink px-2 py-1 font-bold uppercase tracking-widest text-ink transition-colors hover:bg-paper-strong"
          >
            {showPending ? t("hidePending") : t("showPending")}
          </button>
        )}
        <SourceNote className="mt-1.5 normal-case">{t("source")}</SourceNote>
      </div>
    </div>
  );
}

export function ForensicHoverCard({
  model,
  relLabel,
  kindLabel,
}: {
  model: HoverCardModel;
  relLabel: (rel: string) => string;
  kindLabel: string;
}) {
  const t = useTranslations("graph.forensic.hover");
  const f = useFormat();
  return (
    <div className="pointer-events-none absolute left-1/2 top-3 z-30 hidden w-[24rem] max-w-[40vw] -translate-x-1/2 border-2 border-ink bg-paper md:block">
      <div className="flex items-baseline justify-between gap-3 border-b-2 border-ink px-3 py-1.5">
        <span className="min-w-0 truncate font-mono text-[11px] font-bold uppercase tracking-widest">
          {model.label}
        </span>
        <span className="shrink-0 font-mono text-[10px] uppercase tracking-widest text-steel-aa">{kindLabel}</span>
      </div>
      <div className="px-3 py-2">
        <p className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-signal" aria-hidden />
          <span>{t("verified", { n: f.int(model.verified) })}</span>
          <span className="text-steel-aa">·</span>
          <span className={model.pending > 0 ? "text-signal" : "text-steel-aa"}>
            {t("pending", { n: f.int(model.pending) })}
          </span>
        </p>
        {model.rows.length === 0 ? (
          <p className="mt-1.5 font-mono text-[11px] uppercase tracking-wider text-steel-aa">{t("empty")}</p>
        ) : (
          <>
          <p className="mt-1.5 font-mono text-[10px] uppercase tracking-widest text-steel-aa">{t("cols")}</p>
          <ul className="mt-0.5 border-t border-hairline">
            {model.rows.map((row) => (
              <li
                key={row.rel}
                className="flex items-baseline justify-between gap-3 border-b border-hairline py-1 font-mono text-[11px]"
              >
                <span className="min-w-0 truncate uppercase tracking-wider">{relLabel(row.rel)}</span>
                <span className="shrink-0 tabular-nums text-steel-aa">
                  {f.int(row.verified)} / {row.pending > 0 ? <span className="text-signal">{f.int(row.pending)}</span> : f.int(row.pending)}
                </span>
              </li>
            ))}
          </ul>
          </>
        )}
        {model.more > 0 && (
          <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-steel-aa">
            {t("more", { n: f.int(model.more) })}
          </p>
        )}
        <p className="mt-1.5 font-mono text-[10px] uppercase tracking-widest text-steel-aa">{t("open")}</p>
        <SourceNote className="mt-1 !text-[10px]">{t("source")}</SourceNote>
      </div>
    </div>
  );
}
