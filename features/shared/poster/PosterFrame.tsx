/**
 * @catalog Tiskový arch plakátu — hlavička, titulní pás, tělo a archivní
 * citační patička v jednom rámu; formát A4/A3 řeší tisková vrstva v globals.css.
 *
 * KANONICKÝ exportní primitiv Konstruktu (batch 1D): plocha, která chce jít
 * na papír, se NEskládá vlastní tiskovou cestu — obalí obsah tímhle rámem,
 * citaci postaví přes buildPosterCitation() a viditelnost v tisku zapne
 * usePosterMode(). Serverově renderovatelný, ZÁMĚRNĚ bez jediné animace:
 * arch je statický artefakt, na papíře se nic nehýbe, a náhled na obrazovce
 * musí být totožný s tiskem (tím je vyřešen i reduced-motion — není co tlumit).
 *
 * Sazba drží plakátovou anatomii z docs/DESIGN.md §5: mono meta nahoře,
 * obří verzálkový titulek s červenou tečkou, signální linka, patička nad
 * čtyřlinkou citace. Žádné logo — slovní značka POLITICAS je součást patičky,
 * protože vytištěný arch žije mimo aplikaci i její lištu.
 */

import { useLocale, useTranslations } from "next-intl";
import { formattersFor } from "@/lib/format";
import { defaultLocale, isLocale } from "@/lib/i18n/config";
import type { PosterCitation } from "./citation";

export type PosterFormat = "a4" | "a3";

export default function PosterFrame({
  eyebrow,
  figureLabel,
  title,
  lead,
  citation,
  format = "a4",
  children,
}: {
  /** Mono řádek nad titulkem — „POLITICAS — OTEVŘENÝ INDEX · PSP10". */
  eyebrow: string;
  /** Pravý horní index archu — „obr. 1" (atlasová konvence Konstruktu). */
  figureLabel?: string;
  /** Plakátový titulek; červenou tečku sází rám. */
  title: string;
  /** Jedna uvozující věta pod linkou. */
  lead?: string;
  /** Archivní patička — stavět VÝHRADNĚ přes buildPosterCitation(). */
  citation: PosterCitation;
  format?: PosterFormat;
  children: React.ReactNode;
}) {
  const t = useTranslations("shared");
  const rawLocale = useLocale();
  const f = formattersFor(isLocale(rawLocale) ? rawLocale : defaultLocale);

  // Citační řádky se skládají z katalogu nad strukturovanými poli citace —
  // datum sází aktivní locale, volitelné části (pas, rozpor formule) se
  // připojují středníkovou tečkou jen když je záznam nese.
  const methodologyParts = [t("poster.methodologyLine", { methodology: citation.methodology })];
  if (citation.pass !== null) methodologyParts.push(t("poster.pass", { pass: f.int(citation.pass) }));
  if (citation.mismatch) {
    methodologyParts.push(
      t("poster.formulaMismatch", {
        storedRef: citation.mismatch.storedRef,
        declaredRef: citation.mismatch.declaredRef,
      }),
    );
  }

  return (
    <section
      className="poster-sheet border-2 border-ink font-sans"
      data-poster-format={format}
      aria-label={t("poster.frameAria", { title })}
    >
      {/* ── horní metařádek ────────────────────────────────────────────── */}
      <header className="flex items-baseline justify-between gap-4 border-b-4 border-ink px-10 pb-3 pt-8">
        <p className="font-mono text-xs font-bold uppercase tracking-[0.25em]">{eyebrow}</p>
        {figureLabel && (
          <p className="font-mono text-xs uppercase tracking-widest text-steel-aa">{figureLabel}</p>
        )}
      </header>

      {/* ── titulní pás ────────────────────────────────────────────────── */}
      <div className="px-10 pt-7">
        <h1 className="text-6xl font-black uppercase leading-[0.92] tracking-tight">
          {title}
          <span className="text-signal">.</span>
        </h1>
        {/* statické pravítko — tisková obdoba SectionRule, bez motion */}
        <div aria-hidden className="mt-4 h-1.5 w-2/3 bg-signal" />
        {lead && <p className="mt-4 max-w-[46rem] text-sm leading-relaxed text-steel-aa">{lead}</p>}
      </div>

      {/* ── tělo archu ─────────────────────────────────────────────────── */}
      <div className="min-h-0 flex-1 overflow-hidden px-10 pt-6">{children}</div>

      {/* ── archivní citační patička ───────────────────────────────────── */}
      <footer className="mt-6 border-t-4 border-ink px-10 pb-8 pt-4">
        <div className="flex items-end justify-between gap-8">
          <div className="min-w-0 font-mono text-xs leading-relaxed text-steel-aa">
            <p>{t("poster.sourceLine", { source: citation.source })}</p>
            <p>{methodologyParts.join(" · ")}</p>
            <p>{t("poster.retrievedLine", { date: f.date(citation.retrievedAt) })}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-xl font-black uppercase tracking-tight">
              politicas<span className="text-signal">.</span>
            </p>
            <p className="mt-1 font-mono text-xs uppercase tracking-widest text-steel-aa">
              {t("poster.liveLine", { url: citation.displayUrl })}
            </p>
          </div>
        </div>
      </footer>
    </section>
  );
}
