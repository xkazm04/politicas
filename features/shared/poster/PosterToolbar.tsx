"use client";

/**
 * @catalog Lišta nad archem plakátu — přepínač formátu A4/A3 a tlačítko Tisk.
 *
 * Obrazovkový chrom režimu plakátu: v tisku ji tisková vrstva skryje spolu se
 * zbytkem aplikace (viditelný zůstane jen `.poster-sheet`). Nese i povinnou
 * vysvětlující větu — čtenář, který sem přijde poprvé, musí pochopit, co
 * nástroj dělá, dřív než zmáčkne Ctrl+P.
 */

import { useTranslations } from "next-intl";
import { Printer } from "lucide-react";
import type { PosterFormat } from "./PosterFrame";

// Značky formátu papíru (A4/A3) jsou technické identifikátory — nepřekládají se.
const FORMATS: { key: PosterFormat; label: string }[] = [
  { key: "a4", label: "A4" },
  { key: "a3", label: "A3" },
];

export default function PosterToolbar({
  format,
  onFormatChange,
  onPrint,
  printLabel,
}: {
  format: PosterFormat;
  onFormatChange: (f: PosterFormat) => void;
  onPrint: () => void;
  /** Popisek tiskového tlačítka — plocha ho může pojmenovat po svém artefaktu
   *  („Tisk kandidátky"); výchozí zůstává obecný katalogový „Tisk / plakát". */
  printLabel?: string;
}) {
  const t = useTranslations("shared");
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-hairline pb-4">
      <p className="max-w-xl text-sm leading-relaxed text-steel-aa">{t("poster.toolbar.hint")}</p>
      <div className="flex items-center gap-2">
        <div
          role="group"
          aria-label={t("poster.toolbar.formatGroup")}
          className="flex border-2 border-ink font-mono text-xs font-bold uppercase tracking-widest"
        >
          {FORMATS.map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={format === f.key}
              onClick={() => onFormatChange(f.key)}
              className={
                format === f.key
                  ? "bg-ink px-3 py-2 text-paper"
                  : "px-3 py-2 text-ink transition-colors hover:bg-paper-strong"
              }
            >
              {f.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onPrint}
          className="inline-flex items-center gap-2 bg-signal-deep px-4 py-2 font-mono text-xs font-bold uppercase tracking-widest text-paper transition-colors hover:bg-ink"
        >
          <Printer className="h-3.5 w-3.5" aria-hidden />
          {printLabel ?? t("poster.toolbar.print")}
        </button>
      </div>
    </div>
  );
}
