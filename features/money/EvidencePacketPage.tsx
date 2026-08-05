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
import { useLocale, useTranslations } from "next-intl";
import { useFormat } from "@/lib/i18n/useFormat";
import SourceNote from "@/features/shared/components/SourceNote";
import { usePosterMode } from "@/features/shared/poster/usePosterMode";
import { compactCzk, tieClassInfo } from "./moneyTypes";
import type { EvidencePacket, PacketEvent, PacketTie } from "./packet";

const EVENT_LABEL_KEY: Record<PacketEvent["kind"], string> = {
  "role-start": "packet.eventRoleStart",
  contract: "packet.eventContract",
  review: "packet.eventReview",
  "role-end": "packet.eventRoleEnd",
};

export default function EvidencePacketPage({ data }: { data: EvidencePacket | null }) {
  const locale = useLocale();
  const en = locale === "en";
  const t = useTranslations("money");
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
              {t("packet.print")}
            </button>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-10" data-packet-doc>
        {!data ? (
          <div className="border-2 border-dashed border-hairline p-8">
            <SourceNote>{t("shared.sourceKnowledgeGraph")}</SourceNote>
            <p className="mt-3 text-lg">{t("packet.noTies")}</p>
          </div>
        ) : (
          <PacketDoc data={data} en={en} locale={locale} />
        )}
      </div>
    </main>
  );
}

function PacketDoc({ data, en, locale }: { data: EvidencePacket; en: boolean; locale: string }) {
  const t = useTranslations("money");
  const f = useFormat();
  const excludedTotal = data.exclusions.pending + data.exclusions.rejected;

  return (
    <>
      <SourceNote tone="signal">{t("packet.eyebrow", { pass: data.pass })}</SourceNote>
      <h1 className="mt-3 text-4xl font-black uppercase leading-[0.95] tracking-tight sm:text-5xl">
        {t("packet.title")}
        <span className="text-signal">.</span>
      </h1>
      <p className="mt-2 font-mono text-xs uppercase tracking-widest text-steel">
        {data.name}
        {data.club ? ` · ${data.club}` : ""} · {t("packet.compiled")} {f.date(data.compiledAt)} ·{" "}
        {t("packet.contentHash")} {data.hashAlgorithm} {data.hash}
      </p>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-steel">{t("packet.intro")}</p>
      <Link
        href={`/penize/${data.pspId}`}
        className="mt-3 inline-flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-cobalt transition-colors hover:text-signal print:hidden"
      >
        {t("packet.backToCaseFile")} →
      </Link>

      {/* ── přiznaná vyloučení — první věc na paketu po hlavičce ─────────── */}
      {excludedTotal > 0 && (
        <div className="mt-8 border-l-4 border-ochre bg-ochre/10 px-4 py-3">
          <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-ink">
            {t("packet.excludedHeading")}
          </p>
          <ul className="mt-1 space-y-0.5">
            {data.exclusions.pending > 0 && (
              <li className="text-sm leading-relaxed text-ink">
                {t("packet.pendingExcluded", { count: data.exclusions.pending })}
              </li>
            )}
            {data.exclusions.rejected > 0 && (
              <li className="text-sm leading-relaxed text-ink">
                {t("packet.rejectedExcluded", { count: data.exclusions.rejected })}
              </li>
            )}
          </ul>
        </div>
      )}

      {data.ties.length === 0 ? (
        <div className="mt-10 border-2 border-dashed border-hairline p-8">
          <p className="text-lg">{t("packet.emptyTitle")}</p>
          <p className="mt-2 text-sm leading-relaxed text-steel">{t("packet.emptyNote")}</p>
        </div>
      ) : (
        <>
          {/* ── ověřené vazby ─────────────────────────────────────────────── */}
          <section className="mt-12">
            <h2 className="border-b-4 border-ink pb-2 text-xl font-black uppercase tracking-tight">
              {t("packet.verifiedTies")}{" "}
              <span className="font-mono text-sm font-bold text-steel">({f.int(data.ties.length)})</span>
            </h2>
            <p className="mt-2 font-mono text-[11px] uppercase tracking-wider text-steel">
              {t("packet.orderNote")}
            </p>
            <div className="mt-4 space-y-6">
              {data.ties.map((tie) => (
                <PacketTieRow key={tie.companyId} tie={tie} en={en} locale={locale} />
              ))}
            </div>
            {(data.contractsOmitted > 0 || data.undatedContracts > 0) && (
              <p className="mt-4 font-mono text-[11px] uppercase tracking-wider text-steel">
                {data.contractsOmitted > 0 &&
                  `${t("packet.contractsOmitted", { count: f.int(data.contractsOmitted) })} `}
                {data.undatedContracts > 0 &&
                  t("packet.undatedContracts", { count: f.int(data.undatedContracts) })}
              </p>
            )}
          </section>

          {/* ── časová osa ────────────────────────────────────────────────── */}
          {data.timeline.length > 0 && (
            <section className="mt-12">
              <h2 className="border-b-4 border-ink pb-2 text-xl font-black uppercase tracking-tight">
                {t("packet.timeline")}
              </h2>
              <ul className="mt-4 divide-y divide-hairline border-t border-hairline">
                {data.timeline.map((ev, i) => (
                  <li key={`${ev.date}-${ev.kind}-${ev.companyId}-${i}`} className="flex items-baseline gap-4 py-2">
                    <span className="shrink-0 font-mono text-xs font-bold tabular-nums">{f.date(ev.date)}</span>
                    <span className="shrink-0 border border-ink px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider">
                      {t(EVENT_LABEL_KEY[ev.kind])}
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
              {t("packet.readyToCite")}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-steel">{t("packet.citeNote")}</p>
            <div className="mt-4 space-y-4">
              {data.ties.map((tie) => (
                <CiteBlock key={tie.companyId} tie={tie} />
              ))}
            </div>
          </section>
        </>
      )}

      <div className="mt-14 border-t-4 border-ink pt-6">
        <SourceNote>
          {t("packet.footerSource", {
            source: data.source,
            algo: data.hashAlgorithm,
            hash: data.hash,
          })}
        </SourceNote>
        <p className="mt-4 max-w-2xl text-sm italic leading-relaxed text-steel">
          {t("packet.rederiveNote")}
        </p>
      </div>
    </>
  );
}

function PacketTieRow({ tie, en, locale }: { tie: PacketTie; en: boolean; locale: string }) {
  const t = useTranslations("money");
  const tcom = useTranslations("common");
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
            {tcom("verified")}
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
                {t("packet.reachPrefix")}{" "}
                <span className="font-mono font-bold tabular-nums">{compactCzk(reach, locale)}</span>{" "}
                {tie.subsidiesCzk > 0
                  ? t("packet.reachContractsSubsidies", { count: tie.contractCount })
                  : t("packet.reachContracts", { count: tie.contractCount })}
              </>
            ) : (
              t("packet.noReach")
            )}
          </p>
          {/* P29 pravidlo U čísla — u stewarda povinně. */}
          <p className="mt-1 text-xs leading-relaxed text-steel">{en ? info.descEn : info.descCs}</p>
          {(tie.reviewNote || tie.lastDecision) && (
            <div className="mt-3 border-l-2 border-hairline pl-3">
              {tie.reviewNote && (
                <p className="text-sm leading-relaxed text-steel">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-ink">
                    {t("shared.reviewNote")}:{" "}
                  </span>
                  {tie.reviewNote}
                </p>
              )}
              {tie.lastDecision && (
                <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-steel">
                  {t("packet.decision")}: {tie.lastDecision}
                  {tie.lastReviewer ? ` · ${tie.lastReviewer}` : ""}
                  {tie.lastReviewedAt ? ` · ${tie.lastReviewedAt.slice(0, 10)}` : ""}
                </p>
              )}
            </div>
          )}
          <p className="mt-3 font-mono text-[10px] leading-relaxed uppercase tracking-wider text-steel">
            {t("shared.sourceLabel")}: {tie.source || "—"}
          </p>
        </div>
        <div className="border-l-2 border-hairline pl-4">
          <p className="font-mono text-[10px] uppercase tracking-widest text-steel">
            {t("shared.verifyInRegistry")}
          </p>
          <div className="mt-2 flex flex-col gap-1.5">
            {[
              { label: t("shared.registryAresSubject"), href: tie.links.aresSubject },
              { label: "ARES VR", href: tie.links.aresVr },
              { label: t("shared.registryCommercial"), href: tie.links.justiceVr },
              { label: t("shared.registryContracts"), href: tie.links.registrSmluv },
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

function CiteBlock({ tie }: { tie: PacketTie }) {
  const t = useTranslations("money");
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
            ? t("packet.copied")
            : copied === "failed"
              ? t("packet.copyFailed")
              : t("packet.copyCitation")}
        </button>
      </figcaption>
    </figure>
  );
}
