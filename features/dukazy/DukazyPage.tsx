/**
 * Deník důkazů (/dukazy) — the review console's public face: every rozhodnutí,
 * které prošlo lidskou branou, jako datovaný, kotvený, citovatelný záznam.
 * Sází se jako soudní věstník: strohé řádky, datum vlevo, výrok, subjekt,
 * odkazy na primární registry, citace zdroje na každém záznamu.
 *
 * Serverová komponenta — žádná interaktivita kromě odkazů; zvýraznění cílové
 * kotvy (`#z-<id>`) řeší CSS `:target` varianta, ne JavaScript.
 *
 * Copy je záměrně česky přímo zde (ne přes messages/*.json): katalog překladů
 * je mimo plochu batch-2C — precedens /plakat (batch 1D).
 */

import Link from "next/link";
import { ArrowUpRight, ExternalLink } from "lucide-react";
import SectionHeading from "@/features/shared/components/SectionHeading";
import SectionRule from "@/features/shared/components/SectionRule";
import SourceNote from "@/features/shared/components/SourceNote";
import { czechDate, czechInt } from "@/lib/format";
import type { EvidenceEntry } from "./deriveFeed";
import type { DukazyData } from "./getDukazyData";

/** Výrok nese barvu stavu: ověřeno = inkoust (pravomocné), zamítnuto =
 *  signal-deep (AA na textu i ploše), doplnění = obrys (neuzavřené),
 *  forenzní podpis = okr. */
const DECISION_TONE: Record<EvidenceEntry["decision"], string> = {
  confirm: "bg-ink text-paper",
  reject: "bg-signal-deep text-paper",
  "needs-more": "border border-ink text-ink",
  "forensic-verified": "bg-ochre text-ink",
};

function EntryRow({ e }: { e: EvidenceEntry }) {
  return (
    <article
      id={e.anchor}
      className="grid scroll-mt-24 gap-x-6 gap-y-2 border-b border-hairline py-5 target:bg-paper-strong sm:grid-cols-[7rem_1fr]"
    >
      <div className="flex flex-col gap-1">
        <time dateTime={e.decidedAt} className="font-mono text-sm font-bold tabular-nums">
          {czechDate(e.decidedAt)}
        </time>
        {/* Kotva záznamu — stabilní veřejná adresa rozhodnutí. */}
        <a
          href={`#${e.anchor}`}
          className="font-mono text-xs uppercase tracking-widest text-steel-aa hover:text-signal-deep hover:underline"
          aria-label={`Trvalý odkaz na záznam ${e.id}`}
        >
          #{e.anchor.length > 14 ? `${e.anchor.slice(0, 13)}…` : e.anchor}
        </a>
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className={`px-2 py-0.5 font-mono text-xs font-bold uppercase tracking-widest ${DECISION_TONE[e.decision]}`}>
            {e.decisionCs}
          </span>
          <span className="font-mono text-xs uppercase tracking-widest text-steel-aa">rozhodl: {e.reviewer}</span>
          {e.priorState && (
            <span className="font-mono text-xs uppercase tracking-widest text-steel-aa">
              předchozí stav: {e.priorState}
            </span>
          )}
        </div>
        <p className="text-base font-bold leading-snug">
          {e.internalHref ? (
            <Link href={e.internalHref} className="hover:text-signal-deep hover:underline">
              {e.subjectCs}
            </Link>
          ) : (
            e.subjectCs
          )}
        </p>
        {e.links.length > 0 && (
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {e.links.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-mono text-xs uppercase tracking-widest text-cobalt hover:underline"
                >
                  {l.label} <ExternalLink className="h-3 w-3" aria-hidden />
                </a>
              </li>
            ))}
          </ul>
        )}
        <SourceNote>{e.sourceCs}</SourceNote>
      </div>
    </article>
  );
}

export default function DukazyPage({ data }: { data: DukazyData | null }) {
  return (
    <main className="min-h-screen overflow-x-clip bg-paper font-sans text-ink">
      <header className="border-b-4 border-ink">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <span className="font-mono text-xs uppercase tracking-widest text-steel-aa">/ dukazy</span>
          {/* Strojově čitelné podoby věstníku — veřejné API deníku. */}
          <div className="flex items-center gap-4">
            <a
              href="/dukazy/feed.xml"
              className="font-mono text-xs font-bold uppercase tracking-widest text-signal-deep hover:underline"
            >
              RSS
            </a>
            <a
              href="/dukazy/feed.json"
              className="font-mono text-xs font-bold uppercase tracking-widest text-signal-deep hover:underline"
            >
              JSON
            </a>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-10">
        <SourceNote tone="signal">veřejný věstník lidské brány</SourceNote>
        <h1 className="mt-3 text-4xl font-black uppercase leading-[0.95] tracking-tight sm:text-5xl">
          Deník důkazů
          <span className="text-signal">.</span>
        </h1>
        <div className="mt-4 max-w-md">
          <SectionRule />
        </div>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-steel-aa">
          Každé rozhodnutí, které projde lidskou kontrolou — ověření či zamítnutí vazby poslanec ↔ firma,
          žádost o doplnění podkladů, podepsaný forenzní posudek — se tady stává veřejným, datovaným
          a trvale odkazovatelným záznamem. Brána sama je publikační událost.
        </p>

        {/* Metodika zveřejnění — co deník říká a co záměrně neříká. */}
        <div className="mt-8 max-w-2xl border-l-4 border-ink bg-paper-strong px-4 py-3">
          <p className="font-mono text-[11px] font-bold uppercase tracking-widest">metodika zveřejnění</p>
          <p className="mt-1 text-sm leading-relaxed text-steel-aa">
            Zveřejňuje se výrok, subjekt, datum, role revizora a odkazy na primární registry — nikdy
            pracovní poznámky revizora. „Vyžádáno doplnění podkladů&ldquo; není verdikt: vazba dál čeká na
            kontrolu. Ověřitelnost záznamu (audit trail a hlavy trezoru) drží{" "}
            <Link href="/admin" className="font-mono text-xs uppercase tracking-widest text-cobalt hover:underline">
              provozní konzole /admin
            </Link>
            .
          </p>
        </div>

        <section className="mt-14 border-t-4 border-ink pt-10">
          <SectionHeading
            index={1}
            title="Rozhodnutí"
            aside={
              data && (
                <SourceNote>
                  zdroj: review_audit ({czechInt(data.auditRows)} řádků) + kg_node bill.forensic_*
                </SourceNote>
              )
            }
          />

          {data == null ? (
            <div className="mt-8 border-2 border-dashed border-hairline p-8">
              <p className="text-lg">
                Záznamy teď nelze načíst — úložiště je v tomto prostředí nedostupné. Tahle stránka
                nemůže říct, jestli nějaká rozhodnutí existují; deník není prázdný, jen nečitelný.
              </p>
            </div>
          ) : data.entries.length === 0 ? (
            <div className="mt-8 border-2 border-dashed border-hairline p-8">
              <p className="text-lg">
                Deník je zatím prázdný<span className="text-signal">.</span> Lidskou branou dosud
                neprošlo žádné rozhodnutí — první ověřená či zamítnutá vazba se tu objeví ve chvíli,
                kdy ji revizor rozhodne v konzoli{" "}
                <Link href="/penize/kontrola" className="font-mono text-sm uppercase tracking-widest text-cobalt hover:underline">
                  /penize/kontrola
                </Link>
                .
              </p>
              <div className="mt-3">
                <SourceNote>zdroj: review_audit — 0 řádků; žádný záznam není zamlčen</SourceNote>
              </div>
            </div>
          ) : (
            <div className="mt-8 border-t-2 border-ink">
              {data.entries.map((e) => (
                <EntryRow key={e.id} e={e} />
              ))}
            </div>
          )}

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              href="/penize/kontrola"
              className="group inline-flex items-center gap-1 font-mono text-xs font-bold uppercase tracking-widest text-signal-deep hover:underline"
            >
              revizní konzole{" "}
              <ArrowUpRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden />
            </Link>
            <SourceNote>kotvy záznamů: #z-&lt;id&gt; · id = řádek review_audit / sněmovní tisk</SourceNote>
          </div>
        </section>
      </div>
    </main>
  );
}
