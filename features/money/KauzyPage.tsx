"use client";

/**
 * Kauzy / rozpracované podněty (/penize/kauzy) — nejcitlivější obsah platformy:
 * dva ruční investigativní spisy (batch-005), zveřejněné verbatim-věrně.
 * Nikdy jeden verdikt — vždy dva sloupce, přesně jak je napsal recenzní
 * pas: „co zdroje dokládají" / „co zdroje nedokládají". Každé tvrzení nese
 * vlastní citaci. Vždy pending_review / annotation_only_proposal — nic tady
 * automaticky nepotvrzuje vazbu ani nesytí skóre.
 */

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { useLocale } from "next-intl";
import SourceNote from "@/features/shared/components/SourceNote";
import type { LeadDossiers } from "./getLeadDossiers";
import type { PacketTarget } from "./getLeadPacketTargets";
import type { LeadDossier } from "./moneyTypes";

export default function KauzyPage({
  data,
  packetTargets = {},
}: {
  data: LeadDossiers;
  /** IČO kauzy → poslanci s doloženou linked_to vazbou (deterministický join
   *  grafem, viz getLeadPacketTargets) — cíle tlačítka „sestavit důkazní paket". */
  packetTargets?: Record<string, PacketTarget[]>;
}) {
  const { dossiers, directoryUnreadable, unreadableFiles } = data;
  const locale = useLocale();
  const en = locale === "en";

  return (
    <main className="min-h-screen overflow-x-clip bg-paper font-sans text-ink">
      <header className="border-b-4 border-ink">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs uppercase tracking-widest text-steel">/ penize / kauzy</span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-10">
        <SourceNote tone="signal">{en ? "hand-curated leads · pending review" : "ruční investigativní spisy · čeká na kontrolu"}</SourceNote>
        <h1 className="mt-3 text-4xl font-black uppercase leading-[0.95] tracking-tight sm:text-5xl">
          {en ? "Cases" : "Kauzy"}
          <span className="text-signal">.</span>
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-steel">
          {en
            ? "Every claim below carries its own citation. Nothing here is a confirmed violation or an automated tie score — it is a dated research trail a human reviewer produced, split honestly into what the sources actually establish and what they do not."
            : "Každé tvrzení níž nese vlastní citaci. Nic z toho není potvrzené porušení zákona ani automatické skóre vazby — je to datovaná výzkumná stopa vytvořená člověkem, poctivě rozdělená na to, co zdroje skutečně dokládají, a co ne."}
        </p>

        {/* Blind and empty are different statements — a payload directory we could not
            read must never be published as "there are no kauzy". */}
        {unreadableFiles.length > 0 && (
          <div className="mt-8 border-l-4 border-ochre bg-ochre/10 px-4 py-3">
            <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-ink">
              {en ? "payloads that could not be read" : "spisy, které se nepodařilo přečíst"}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-steel">
              {en
                ? `${unreadableFiles.length} file(s) in the payload directory failed to read or parse and are missing from the list below: `
                : `${unreadableFiles.length} soubor(ů) v adresáři se nepodařilo přečíst nebo rozparsovat a v seznamu níž chybí: `}
              <span className="font-mono text-xs">{unreadableFiles.join(", ")}</span>
            </p>
          </div>
        )}

        {dossiers.length === 0 ? (
          <div className="mt-10 border-2 border-dashed border-hairline p-8">
            <p className="text-lg">
              {directoryUnreadable
                ? en
                  ? "The payload directory could not be read in this environment — this page cannot say whether there are any cases."
                  : "Adresář se spisy se v tomto prostředí nepodařilo přečíst — tahle stránka nemůže říct, jestli nějaké kauzy existují."
                : en
                  ? "No dossiers available in this environment."
                  : "V tomto prostředí nejsou dostupné žádné spisy."}
            </p>
          </div>
        ) : (
          <div className="mt-12 space-y-16">
            {dossiers.map((d) => (
              <DossierBlock
                key={d.leadId}
                d={d}
                en={en}
                targets={d.company ? (packetTargets[d.company.ico] ?? []) : []}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function DossierBlock({ d, en, targets }: { d: LeadDossier; en: boolean; targets: PacketTarget[] }) {
  return (
    <article className="border-t-4 border-ink pt-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-widest text-steel">{d.leadId}</p>
          <h2 className="mt-1 text-2xl font-black uppercase tracking-tight">{d.subject.name}</h2>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-steel">{d.subject.role}</p>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-steel">{d.subject.party}</p>
          {d.company && (
            <p className="mt-2 font-mono text-[11px] uppercase tracking-wider text-steel">
              {en ? "company" : "firma"}: {d.company.name} · IČO {d.company.ico}
            </p>
          )}
          {/* 4E: jedno kliknutí → důkazní paket. Odkaz existuje JEN když IČO
              kauzy deterministicky joinuje na poslance s linked_to vazbou v
              grafu (drop-don't-guess — nikdy fuzzy match podle jména). Paket
              sám pak pustí dál jen lidsky ověřený materiál. */}
          {targets.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
              {targets.map((t) => (
                <Link
                  key={t.pspId}
                  href={`/penize/${t.pspId}/paket`}
                  className="inline-flex items-center gap-1.5 border-2 border-ink px-2 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-ink transition-colors hover:border-signal hover:text-signal"
                >
                  {en ? "compile evidence packet" : "sestavit důkazní paket"} — {t.name} →
                </Link>
              ))}
              <span className="font-mono text-[10px] uppercase tracking-widest text-steel">
                {en
                  ? "verified material only, exclusions stated"
                  : "jen ověřený materiál, vyloučení přiznána"}
              </span>
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span className="border-2 border-ochre bg-ochre/15 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-ink">
            {en ? "pending review" : "čeká na kontrolu"}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-widest text-steel">
            {en ? "signal" : "signál"} {d.signalScore} · {en ? "confidence" : "spolehlivost"} {d.confidence}
          </span>
        </div>
      </div>

      {/* signal reasoning */}
      <p className="mt-4 max-w-3xl text-sm leading-relaxed text-steel">{d.signalWhy}</p>

      {/* two-column honest split — the product */}
      <div className="mt-8 grid gap-px border border-ink bg-ink sm:grid-cols-2">
        <div className="bg-paper p-5">
          <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-cobalt">
            {en ? "what sources sustain" : "co zdroje dokládají"}
          </p>
          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink">{d.whatSourcesSustain}</p>
        </div>
        <div className="bg-paper p-5">
          <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-signal">
            {en ? "what sources do NOT sustain" : "co zdroje nedokládají"}
          </p>
          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink">{d.whatSourcesDoNotSustain}</p>
        </div>
      </div>

      {/* claims */}
      <div className="mt-8">
        <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-steel">
          {en ? "claims, each cited" : "tvrzení, každé s citací"}
        </p>
        <ul className="mt-3 divide-y divide-hairline border-t border-hairline">
          {d.claims.map((c, i) => (
            <li key={i} className="py-3">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm leading-relaxed text-ink">{c.claim}</p>
                <span
                  className={`shrink-0 border px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${
                    c.sourceKind === "primary" ? "border-cobalt text-cobalt" : "border-hairline text-steel"
                  }`}
                >
                  {c.sourceKind}
                </span>
              </div>
              <a
                href={c.url}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-cobalt transition-colors hover:text-signal"
              >
                <ExternalLink className="h-3 w-3" /> {c.accessedAt}
              </a>
            </li>
          ))}
        </ul>
      </div>

      {/* media context */}
      {d.mediaContext.length > 0 && (
        <div className="mt-8">
          <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-steel">
            {en ? "media context" : "mediální kontext"}
          </p>
          <ul className="mt-3 space-y-3">
            {d.mediaContext.map((m, i) => (
              <li key={i} className="border-l-2 border-hairline pl-3">
                <a
                  href={m.url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-[11px] font-bold uppercase tracking-wider text-cobalt transition-colors hover:text-signal"
                >
                  {m.outlet}
                </a>
                <p className="mt-1 text-sm leading-relaxed text-steel">{m.gist}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* proposed annotation — labelled as a proposal, never applied automatically */}
      <div className="mt-8 border-l-4 border-ochre bg-ochre/10 px-4 py-3">
        <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-ink">
          {en ? "proposed annotation (not applied)" : "navržená anotace (nezapsáno)"}
        </p>
        <dl className="mt-2 space-y-1.5">
          {Object.entries(d.proposedAnnotation).map(([k, v]) => (
            <div key={k} className="text-sm leading-relaxed text-ink">
              <dt className="inline font-mono text-[10px] font-bold uppercase tracking-widest text-steel">{k}: </dt>
              <dd className="inline">{typeof v === "string" ? v : JSON.stringify(v)}</dd>
            </div>
          ))}
        </dl>
      </div>
    </article>
  );
}
