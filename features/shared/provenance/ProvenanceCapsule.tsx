"use client";

/*
 * KAPSLE PŮVODU — citace, na kterou se dá kliknout a dostat doklad.
 *
 * Trigger je součást citačního řádku (SourceNote ho sází místo prostého
 * textu, když volající dodá účtenku) a otevírá malý dialog s tělem účtenky:
 * hrana/uzel grafu, stav lidské brány, provenience, registry a trvalá adresa
 * /zdroj/<ref>. Existující citace bez účtenky se nemění ani o pixel.
 *
 * Klávesnice a fokus — kompletní smlouva dialogu:
 *  · otevření přesune fokus na panel, zavření ho vrátí na trigger,
 *  · Tab/Shift+Tab cyklí UVNITŘ panelu (fokusová past),
 *  · Esc zavírá, klik mimo panel zavírá,
 *  · trigger nese aria-haspopup/aria-expanded, panel role="dialog" aria-modal.
 *
 * Vstupní animace je jednorázová a krátká (fade/pop ≤ 0,2 s), gated přes
 * useReducedMotion — při reduced motion se panel objeví bez pohybu.
 */

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Stamp, X } from "lucide-react";
import Link from "next/link";
import { claimRefPath } from "./claimRef";
import type { ProvenanceReceipt } from "./receipt";
import ReceiptBody from "./ReceiptBody";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function ProvenanceCapsule({
  receipt,
  children,
}: {
  receipt: ProvenanceReceipt;
  /** Text citace — sází se beze změny, jen získá afordanci dokladu. */
  children: React.ReactNode;
}) {
  const t = useTranslations("shared");
  const [open, setOpen] = useState(false);
  const reduceMotion = useReducedMotion();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();

  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  // Otevření: fokus jde na panel (sám je fokusovatelný, tabIndex -1, takže
  // odečítačka ohlásí dialog dřív, než čtenář začne tabovat po odkazech).
  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  // Klik mimo panel zavírá — bez vracení fokusu (čtenář odešel myší jinam).
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
      close(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, close]);

  // Esc + fokusová past. Na panelu, ne na dokumentu — dialog je lokální
  // kapsle, ne celostránkový modal, a nesmí polykat Esc cizím plochám.
  const onPanelKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      close(true);
      return;
    }
    if (e.key !== "Tab" || !panelRef.current) return;
    const focusables = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (focusables.length === 0) {
      e.preventDefault();
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === panelRef.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <span className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => (open ? close(true) : setOpen(true))}
        className="inline-flex items-baseline gap-1 text-left underline decoration-dotted decoration-hairline underline-offset-2 transition-colors hover:text-signal-deep hover:decoration-signal focus-visible:outline focus-visible:outline-2 focus-visible:outline-cobalt"
      >
        <Stamp className="h-3 w-3 shrink-0 self-center" aria-hidden />
        <span>{children}</span>
        <span className="sr-only">{t("provenance.open")}</span>
      </button>

      {open && (
        <motion.div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          onKeyDown={onPanelKeyDown}
          initial={reduceMotion ? false : { opacity: 0, y: 6, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="absolute left-0 top-full z-50 mt-2 w-[min(26rem,88vw)] border-2 border-ink bg-paper p-4 font-sans normal-case tracking-normal shadow-[6px_6px_0_0_var(--color-ink)] outline-none"
        >
          <div className="flex items-start justify-between gap-3 border-b-2 border-ink pb-2">
            <p
              id={titleId}
              className="flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.25em] text-signal"
            >
              <Stamp className="h-3.5 w-3.5" aria-hidden /> {t("provenance.kicker")}
            </p>
            <button
              type="button"
              onClick={() => close(true)}
              aria-label={t("provenance.close")}
              className="-m-1 p-1 text-steel-aa transition-colors hover:text-signal focus-visible:outline focus-visible:outline-2 focus-visible:outline-cobalt"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>

          <div className="pt-3">
            <ReceiptBody receipt={receipt} />
          </div>

          <div className="mt-4 border-t-2 border-ink pt-2.5">
            <Link
              href={claimRefPath(receipt.ref)}
              className="inline-flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-cobalt transition-colors hover:text-signal focus-visible:outline focus-visible:outline-2 focus-visible:outline-cobalt"
            >
              {t("provenance.permalink")}
            </Link>
          </div>
        </motion.div>
      )}
    </span>
  );
}
