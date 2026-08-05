"use client";

/**
 * @catalog CopyLinkButton — tlačítko „kopírovat odkaz" s potvrzením do
 * aria-live; adresa se skládá až při kliknutí z window.location.origin, takže
 * SSR nikdy nesází neznámý origin.
 *
 * Vzniklo vytažením z features/shared/provenance/ReceiptPage.tsx (2026-08-04):
 * návod na /overeni zve čtenáře „zkopírujte tenhle tvar" a druhá kopie téhož
 * tlačítka by se rozešla s tou první při první opravě. Selhání schránky
 * (permissions, http) se POJMENUJE a nechá ruční cestu — adresa je vypsaná
 * vedle tlačítka.
 */

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Check, Link2 } from "lucide-react";

export default function CopyLinkButton({
  path,
  label,
  copiedLabel,
  failedLabel,
  errorContext = "kopírování odkazu selhalo",
}: {
  /** Cesta nebo celý text ke zkopírování. Cesta začínající „/" se doplní na
   *  absolutní URL; cokoli jiného se kopíruje doslova (tvar citace). */
  path: string;
  /** Výchozí popisky jdou z katalogu (`shared.copyLink.*`); props je přebíjejí. */
  label?: string;
  copiedLabel?: string;
  failedLabel?: string;
  /** Kontext do console.error — ať je v logu poznat, která plocha selhala.
   *  Log, ne UI — nepřekládá se. */
  errorContext?: string;
}) {
  const t = useTranslations("shared");
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const reduceMotion = useReducedMotion();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const copy = async () => {
    const text = path.startsWith("/") ? new URL(path, window.location.origin).toString() : path;
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch (err) {
      console.error(errorContext, err);
      setState("failed");
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 2600);
  };

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <button
        type="button"
        onClick={copy}
        className="inline-flex items-center gap-1.5 border border-ink px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-wider text-ink transition-colors hover:bg-paper-strong hover:text-signal focus-visible:outline focus-visible:outline-2 focus-visible:outline-cobalt"
      >
        <Link2 className="h-3.5 w-3.5" aria-hidden /> {label ?? t("copyLink.label")}
      </button>
      <span role="status" aria-live="polite" className="min-h-[1rem]">
        {state === "copied" && (
          <motion.span
            initial={reduceMotion ? false : { opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-1 font-mono text-xs font-bold uppercase tracking-wider text-cobalt"
          >
            <Check className="h-3.5 w-3.5" aria-hidden /> {copiedLabel ?? t("copyLink.copied")}
          </motion.span>
        )}
        {state === "failed" && (
          <span className="font-mono text-xs uppercase tracking-wider text-signal-deep">
            {failedLabel ?? t("copyLink.failed")}
          </span>
        )}
      </span>
    </div>
  );
}
