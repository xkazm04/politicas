"use client";

/**
 * Důkazní paket (/penize/[pspId]/paket) — spis poslance zkompilovaný jedním
 * kliknutím do citovatelného dokumentu: VÝHRADNĚ lidsky ověřené vazby, k nim
 * časová osa, rejstříkové odkazy, provenance kontroly a hotové citační bloky.
 * Citační brána je absolutní a její vyloučení se přiznávají přímo na paketu
 * („N nálezů čeká na ověření — nezahrnuto"). Výpočetní kandidáti střetů
 * (/penize/strety) sem z definice nikdy nevstupují.
 *
 * TISK: paket je proměnlivě dlouhý, vícestránkový dokument — pevný jednoarchový
 * A4 rám PosterFrame (overflow hidden) mu NEsedí. Skládá se proto vlastní
 * tisková cesta UVNITŘ plochy: usePosterMode() zapne existující tiskovou vrstvu
 * (chrom aplikace zmizí přes visibility) a lokální <style> k ní ADITIVNĚ přidá
 * viditelnost [data-packet-doc] — dokument teče přes stránky přirozeně.
 * Žádná animace na ploše → reduced-motion je vyřešen tím, že není co tlumit.
 */

import { useState } from "react";
import Link from "next/link";
import { Copy, ExternalLink, Printer } from "lucide-react";
import { useLocale } from "next-intl";
import { useFormat } from "@/lib/i18n/useFormat";
import SourceNote from "@/features/shared/components/SourceNote";
import { usePosterMode } from "@/features/shared/poster/usePosterMode";
import { compactCzk, tieClassInfo } from "./moneyTypes";
import { pendingExclusionNoteCs, rejectedExclusionNoteCs, type EvidencePacket, type PacketEvent, type PacketTie } from "./packet";

const EVENT_LABEL: Record<PacketEvent["kind"], { cs: string; en: string }> = {
  "role-start": { cs: "vznik role", en: "role starts" },
  contract: { cs: "podpis smlouvy", en: "contract signed" },
  review: { cs: "lidská kontrola", en: "human review" },
  "role-end": { cs: "konec role", en: "role ends" },
};

export default function EvidencePacketPage({ data }: { data: EvidencePacket | null }) {
  const locale = useLocale();
  const en = locale === "en";
  const { printPoster } = usePosterMode();

  return (
    <main className="min-h-screen overflow-x-clip bg-paper font-sans text-ink">
      {/* Aditivní tisková pravidla — skládají se s vrstvou data-poster-mode v
          globals.css (ta schová chrom), tady se jen zviditelní dokument.
          Žádné barvy, jen viditelnost a tok. */}
      <style>{`
        @media print {
          html[data-poster-mode] [data-packet-doc],
          html[data-poster-mode] [data-packet-doc] * { visibility: visible; }
          html[data-poster-mode] [data-packet-doc] { position: absolute; top: 0; left: 0; width: 100%; }
        }
      `}</style>

      <header className="border-b-4 border-ink print:hidden">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
          <span className="font-mono text-xs uppercase tracking-widest text-steel">/ penize / paket</span>
          {data && (
            <button
              type="button"
              onClick={printPoster}
              className="inline-flex items-center gap-2 bg-signal-deep px-4 py-2 font-mono text-xs font-bold uppercase tracking-widest text-paper transition-colors hover:bg-ink"
            >
              <Printer className="h-3.5 w-3.5" aria-hidden />
              {en ? "Print packet" : "Tisk paketu"}
            </button>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-10" data-packet-doc>
        {!data ? (
          <div className="border-2 border-dashed border-hairline p-8">
            <SourceNote>{en ? "source: knowledge graph" : "zdroj: znalostní graf"}</SourceNote>
            <p className="mt-3 text-lg">
              {en
                ? "No materialized money ties found for this MP — there is nothing to compile a packet from."
                : "Pro tohoto poslance nemá znalostní graf žádnou materializovanou vazbu — není z čeho paket sestavit."}
            </p>
          </div>
        ) : (
          <PacketDoc data={data} en={en} locale={locale} />
        )}
      </div>
    </main>
  );
}

function PacketDoc({ data, en, locale }: { data: EvidencePacket; en: boolean; locale: string }) {
  const f = useFormat();
  const excludedTotal = data.exclusions.pending + data.exclusions.rejected;

  return (
    <>
      <SourceNote tone="signal">
        {en
          ? `evidence packet · verified material only · pass ${data.pass}`
          : `důkazní paket · pouze ověřený materiál · pass ${data.pass}`}
      </SourceNote>
      <h1 className="mt-3 text-4xl font-black uppercase leading-[0.95] tracking-tight sm:text-5xl">
        {en ? "Evidence packet" : "Důkazní paket"}
        <span className="text-signal">.</span>
      </h1>
      <p className="mt-2 font-mono text-xs uppercase tracking-widest text-steel">
        {data.name}
        {data.club ? ` · ${data.club}` : ""} · {en ? "compiled" : "sestaveno"} {f.date(data.compiledAt)} ·{" "}
        {en ? "content hash" : "otisk obsahu"} {data.hashAlgorithm} {data.hash}
      </p>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-steel">
        {en
          ? "One click compiled this MP's case file into a citable dossier. The citation gate is absolute: only ties a human reviewer verified enter the packet — everything pending or rejected is excluded, and the exclusion is stated below. Computed collision candidates (/penize/strety) never enter a packet: they are unverified by definition."
          : "Jedno kliknutí zkompilovalo spis poslance do citovatelného dokumentu. Citační brána je absolutní: do paketu vstupují jen vazby ověřené lidskou kontrolou — vše čekající nebo zamítnuté je vyloučeno a vyloučení je přiznáno níže. Výpočetní kandidáti střetů (/penize/strety) do paketu nevstupují nikdy: z definice jde o neověřený materiál."}
      </p>
      <Link
        href={`/penize/${data.pspId}`}
        className="mt-3 inline-flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-cobalt transition-colors hover:text-signal print:hidden"
      >
        {en ? "back to the case file" : "zpět na spis poslance"} →
      </Link>

      {/* ── přiznaná vyloučení — první věc na paketu po hlavičce ─────────── */}
      {excludedTotal > 0 && (
        <div className="mt-8 border-l-4 border-ochre bg-ochre/10 px-4 py-3">
          <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-ink">
            {en ? "excluded by the citation gate" : "vyloučeno citační bránou"}
          </p>
          <ul className="mt-1 space-y-0.5">
            {data.exclusions.pending > 0 && (
              <li className="text-sm leading-relaxed text-ink">
                {en
                  ? `${data.exclusions.pending} finding(s) awaiting verification — not included`
                  : pendingExclusionNoteCs(data.exclusions.pending)}
              </li>
            )}
            {data.exclusions.rejected > 0 && (
              <li className="text-sm leading-relaxed text-ink">
                {en
                  ? `${data.exclusions.rejected} finding(s) rejected in review — not included`
                  : rejectedExclusionNoteCs(data.exclusions.rejected)}
              </li>
            )}
          </ul>
        </div>
      )}

      {data.ties.length === 0 ? (
        <div className="mt-10 border-2 border-dashed border-hairline p-8">
          <p className="text-lg">
            {en
              ? "The packet contains no verified finding. No tie of this MP has passed human review yet — the gate excluded everything, as stated above."
              : "Paket neobsahuje žádný ověřený nález. Žádná vazba tohoto poslance zatím neprošla lidskou kontrolou — brána vyloučila vše, jak je přiznáno výše."}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-steel">
            {en
              ? "This is the honest state, not an error: a packet may only cite verified material."
              : "To je poctivý stav, ne chyba: paket smí citovat jen ověřený materiál."}
          </p>
        </div>
      ) : (
        <>
          {/* ── ověřené vazby ─────────────────────────────────────────────── */}
          <section className="mt-12">
            <h2 className="border-b-4 border-ink pb-2 text-xl font-black uppercase tracking-tight">
              {en ? "Verified ties" : "Ověřené vazby"}{" "}
              <span className="font-mono text-sm font-bold text-steel">({f.int(data.ties.length)})</span>
            </h2>
            <p className="mt-2 font-mono text-[11px] uppercase tracking-wider text-steel">
              {en
                ? "order: batch-005 review order (reviewRank ascending)"
                : "pořadí: kontrolní pořadí batch-005 (reviewRank vzestupně)"}
            </p>
            <div className="mt-4 space-y-6">
              {data.ties.map((tie) => (
                <PacketTieRow key={tie.companyId} tie={tie} en={en} locale={locale} />
              ))}
            </div>
            {(data.contractsOmitted > 0 || data.undatedContracts > 0) && (
              <p className="mt-4 font-mono text-[11px] uppercase tracking-wider text-steel">
                {data.contractsOmitted > 0 &&
                  (en
                    ? `${f.int(data.contractsOmitted)} further contracts beyond the top-N slice are not itemized here (aggregates include them). `
                    : `${f.int(data.contractsOmitted)} dalších smluv nad řez top-N tu není rozepsáno (souhrny je zahrnují). `)}
                {data.undatedContracts > 0 &&
                  (en
                    ? `${f.int(data.undatedContracts)} listed contract(s) carry no signature date and are absent from the timeline.`
                    : `${f.int(data.undatedContracts)} z uvedených smluv nenese datum podpisu a v časové ose chybí.`)}
              </p>
            )}
          </section>

          {/* ── časová osa ────────────────────────────────────────────────── */}
          {data.timeline.length > 0 && (
            <section className="mt-12">
              <h2 className="border-b-4 border-ink pb-2 text-xl font-black uppercase tracking-tight">
                {en ? "Timeline" : "Časová osa"}
              </h2>
              <ul className="mt-4 divide-y divide-hairline border-t border-hairline">
                {data.timeline.map((ev, i) => (
                  <li key={`${ev.date}-${ev.kind}-${ev.companyId}-${i}`} className="flex items-baseline gap-4 py-2">
                    <span className="shrink-0 font-mono text-xs font-bold tabular-nums">{f.date(ev.date)}</span>
                    <span className="shrink-0 border border-ink px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider">
                      {en ? EVENT_LABEL[ev.kind].en : EVENT_LABEL[ev.kind].cs}
                    </span>
                    <span className="min-w-0 truncate text-sm text-steel">
                      {ev.company} · {ev.detail}
                    </span>
                    {ev.amountCzk != null && (
                      <span className="ml-auto shrink-0 font-mono text-xs font-bold tabular-nums">
                        {compactCzk(ev.amountCzk, locale)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* ── citační bloky ─────────────────────────────────────────────── */}
          <section className="mt-12">
            <h2 className="border-b-4 border-ink pb-2 text-xl font-black uppercase tracking-tight">
              {en ? "Ready to cite" : "K citaci"}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-steel">
              {en
                ? "Each block is a self-contained, sourced sentence (in Czech — it cites Czech registries) safe to paste into an article. It states the tie class rule and the verification date; it never states an accusation."
                : "Každý blok je samostatná, ozdrojovaná věta bezpečná k vložení do článku. Nese pravidlo třídy vazby i datum ověření; nikdy netvrdí obvinění."}
            </p>
            <div className="mt-4 space-y-4">
              {data.ties.map((tie) => (
                <CiteBlock key={tie.companyId} tie={tie} en={en} />
              ))}
            </div>
          </section>
        </>
      )}

      <div className="mt-14 border-t-4 border-ink pt-6">
        <SourceNote>
          {en
            ? `source: ${data.source} · human gate /penize/kontrola · content hash ${data.hashAlgorithm} ${data.hash} — a circulating copy is verifiable against this page`
            : `zdroj: ${data.source} · lidská brána /penize/kontrola · otisk obsahu ${data.hashAlgorithm} ${data.hash} — kolující kopie je ověřitelná proti této stránce`}
        </SourceNote>
        <p className="mt-4 max-w-2xl text-sm italic leading-relaxed text-steel">
          {en
            ? "The packet re-derives from the live graph on every request: a tie rejected after you printed this page disappears from the next compilation and joins the stated exclusions."
            : "Paket se odvozuje z živého grafu při každém požadavku: vazba zamítnutá poté, co jste tuhle stránku vytiskli, z příští kompilace zmizí a přibude mezi přiznaná vyloučení."}
        </p>
      </div>
    </>
  );
}

function PacketTieRow({ tie, en, locale }: { tie: PacketTie; en: boolean; locale: string }) {
  const info = tieClassInfo(tie.tieClass);
  const reach = tie.contractCzk + tie.subsidiesCzk;
  return (
    <article id={tie.anchor} className="scroll-mt-24 border-2 border-ink">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b-2 border-ink bg-paper-strong px-5 py-3">
        <div>
          <h3 className="text-lg font-black uppercase tracking-tight">{tie.company}</h3>
          <p className="mt-0.5 font-mono text-[11px] uppercase tracking-wider text-steel">
            IČO {tie.ico}
            {tie.role ? ` · ${tie.role}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="border-2 border-cobalt px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-cobalt">
            {en ? "verified" : "ověřeno"}
          </span>
          <span className="border-2 border-hairline px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-steel">
            {en ? info.labelEn : info.labelCs}
          </span>
          <a
            href={`#${tie.anchor}`}
            className="font-mono text-[10px] uppercase tracking-widest text-steel transition-colors hover:text-signal"
          >
            #{tie.anchor}
          </a>
        </div>
      </div>
      <div className="grid gap-4 px-5 py-4 sm:grid-cols-[1.4fr_1fr]">
        <div>
          <p className="text-sm leading-relaxed text-ink">
            {reach > 0 ? (
              <>
                {en ? "Reachable public money: " : "Dosažitelné veřejné peníze: "}
                <span className="font-mono font-bold tabular-nums">{compactCzk(reach, locale)}</span>{" "}
                {en
                  ? `(${tie.contractCount} contracts${tie.subsidiesCzk > 0 ? " + subsidies" : ""})`
                  : `(${tie.contractCount} smluv${tie.subsidiesCzk > 0 ? " + dotace" : ""})`}
              </>
            ) : en ? (
              "No reachable public money recorded for this company."
            ) : (
              "U této firmy graf neeviduje dosažitelné veřejné peníze."
            )}
          </p>
          {/* P29 pravidlo U čísla — u stewarda povinně. */}
          <p className="mt-1 text-xs leading-relaxed text-steel">{en ? info.descEn : info.descCs}</p>
          {(tie.reviewNote || tie.lastDecision) && (
            <div className="mt-3 border-l-2 border-hairline pl-3">
              {tie.reviewNote && (
                <p className="text-sm leading-relaxed text-steel">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-ink">
                    {en ? "review note" : "poznámka kontroly"}:{" "}
                  </span>
                  {tie.reviewNote}
                </p>
              )}
              {tie.lastDecision && (
                <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-steel">
                  {en ? "decision" : "rozhodnutí"}: {tie.lastDecision}
                  {tie.lastReviewer ? ` · ${tie.lastReviewer}` : ""}
                  {tie.lastReviewedAt ? ` · ${tie.lastReviewedAt.slice(0, 10)}` : ""}
                </p>
              )}
            </div>
          )}
          <p className="mt-3 font-mono text-[10px] leading-relaxed uppercase tracking-wider text-steel">
            {en ? "source" : "zdroj"}: {tie.source || "—"}
          </p>
        </div>
        <div className="border-l-2 border-hairline pl-4">
          <p className="font-mono text-[10px] uppercase tracking-widest text-steel">
            {en ? "verify in registry" : "ověřit v rejstříku"}
          </p>
          <div className="mt-2 flex flex-col gap-1.5">
            {[
              { label: en ? "ARES subject" : "ARES subjekt", href: tie.links.aresSubject },
              { label: "ARES VR", href: tie.links.aresVr },
              { label: en ? "commercial register" : "obchodní rejstřík", href: tie.links.justiceVr },
              { label: en ? "contracts register" : "registr smluv", href: tie.links.registrSmluv },
            ].map((l) => (
              <a
                key={l.label}
                href={l.href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-cobalt transition-colors hover:text-signal"
              >
                <ExternalLink className="h-3 w-3" /> {l.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}

function CiteBlock({ tie, en }: { tie: PacketTie; en: boolean }) {
  const [copied, setCopied] = useState<"idle" | "done" | "failed">("idle");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(tie.citeCs);
      setCopied("done");
    } catch {
      // clipboard nedostupná (http, permissions) — řekneme to, nezamlčíme
      setCopied("failed");
    }
  };
  return (
    <figure className="border border-ink">
      <blockquote className="px-4 py-3 font-mono text-xs leading-relaxed text-ink">{tie.citeCs}</blockquote>
      <figcaption className="flex items-center justify-between gap-3 border-t border-hairline px-4 py-2 print:hidden">
        <span className="font-mono text-[10px] uppercase tracking-widest text-steel">
          {tie.company} · #{tie.anchor}
        </span>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-cobalt transition-colors hover:text-signal"
        >
          <Copy className="h-3 w-3" aria-hidden />
          {copied === "done"
            ? en
              ? "copied"
              : "zkopírováno"
            : copied === "failed"
              ? en
                ? "copy failed — select manually"
                : "kopírování se nezdařilo — vyberte ručně"
              : en
                ? "copy citation"
                : "kopírovat citaci"}
        </button>
      </figcaption>
    </figure>
  );
}
