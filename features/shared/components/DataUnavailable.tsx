/**
 * @catalog Honest empty-state for a DETAIL route whose data source is temporarily
 * unreachable — as opposed to an entity that genuinely does not exist (that stays
 * a real 404 via notFound()).
 *
 * Why this exists: PGlite is single-connection. When an analysis script or a second
 * dev server holds `./.pglite`, every server loader degrades to null. List surfaces
 * fall back to their labelled mock, but a detail route that called notFound() would
 * tell the reader "tento poslanec neexistuje" when the record exists and the database
 * was merely busy — a false statement, which the brand rule forbids as much as any
 * fabricated number. Detail routes therefore render THIS (HTTP 200) on unavailability
 * and reserve 404 for genuine absence.
 */

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import SectionRule from "./SectionRule";
import SourceNote from "./SourceNote";

export default function DataUnavailable({
  what,
  backHref,
  backLabel,
}: {
  /** What the reader was trying to open, e.g. "profil poslance" or "sněmovní tisk". */
  what: string;
  backHref: string;
  backLabel: string;
}) {
  return (
    <main className="min-h-screen bg-paper font-sans text-ink">
      <div className="mx-auto max-w-3xl px-6 py-20">
        <SourceNote tone="signal">data dočasně nedostupná</SourceNote>
        <h1 className="mt-3 text-4xl font-black uppercase leading-[0.95] tracking-tight">
          {what} teď nelze načíst<span className="text-signal">.</span>
        </h1>
        <div className="mt-4 max-w-md">
          <SectionRule />
        </div>
        <p className="mt-4 text-base leading-relaxed text-steel">
          Záznam nejspíš existuje — jen k němu teď nemáme přístup: databáze grafu je
          jednopřipojení&shy;ová a právě ji drží jiný proces (analytický skript nebo druhá
          instance aplikace). Zkuste to znovu za chvíli.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-steel">
          Tohle <strong className="text-ink">není</strong> sdělení, že hledaný záznam
          neexistuje — neexistující záznam vrací 404.
        </p>
        <Link
          href={backHref}
          className="mt-8 inline-flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-cobalt transition-colors hover:text-signal"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> {backLabel}
        </Link>
      </div>
    </main>
  );
}
