"use client";

/**
 * Varianta C — náhradní výtvarný svět: „Rejstřík".
 *
 * Jediná varianta, která NEnavazuje na Konstrukt. Konstrukt je plakát: velké
 * verzálkové číslice, plné plochy, rudý akcent jako gesto. Tenhle svět je jeho
 * protiklad ve stejné paletě — úřední výpis. Strojopisná sazba všude, linkované
 * sloupce, číslované řádky, žádný displejový řez, akcent jen jako značka na
 * okraji řádku. Čte se jako doklad, ne jako kampaň.
 *
 * Co se NEMĚNÍ, protože to není výtvarná otázka: čeština, tokeny, a citace pod
 * každým číslem. Podle new-work.md si náhradní svět bere pravdu o produktu s
 * sebou a zahazuje jen vzhled.
 *
 * Tohle je záměrně ta varianta, která může prohrát — je tu proto, aby se
 * porovnání nedělalo jen mezi odstíny jednoho nápadu.
 */

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useFormat } from "@/lib/i18n/useFormat";
import Citation from "@/features/shared/components/Citation";
import type { LandingData } from "../getLandingData";
import VariantChrome from "./VariantChrome";

/** Jeden řádek výpisu — číslovaný, linkovaný, bez displejového řezu. */
function LedgerLine({
  n,
  children,
  mark = false,
}: {
  n: number;
  children: React.ReactNode;
  mark?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-stretch border-b border-hairline">
      <span className="w-10 shrink-0 border-r border-hairline bg-paper-strong px-2 py-2 text-right font-mono text-xs tabular-nums text-steel-aa">
        {String(n).padStart(2, "0")}
      </span>
      {mark && <span className="w-1 shrink-0 bg-signal" aria-hidden />}
      <div className="min-w-0 flex-1 px-3 py-2">{children}</div>
    </div>
  );
}

export default function VariantLedger({ data }: { data: LandingData }) {
  const t = useTranslations("landingVariants");
  const f = useFormat();

  return (
    <VariantChrome data={data}>
      <section className="mx-auto max-w-5xl px-6 py-12">
        {/* hlavička výpisu — jako záhlaví formuláře, ne jako hero */}
        <div className="border-2 border-ink">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-ink bg-paper-strong px-3 py-2">
            <span className="font-mono text-xs uppercase tracking-widest">{t("ledgerRecord")}</span>
            <span className="font-mono text-xs tabular-nums text-steel-aa">
              {t("ledgerStamp", { pass: data.provenancePass ?? "—" })}
            </span>
          </div>

          <dl className="grid sm:grid-cols-3">
            {[
              { k: t("countLabel"), v: f.int(data.summary.count) },
              { k: t("medianLabel"), v: f.dec(data.summary.median) },
              { k: t("sigmaLabel"), v: f.dec(data.summary.sigma) },
            ].map((row, i) => (
              <div
                key={row.k}
                className={`px-3 py-4 ${i > 0 ? "border-t border-hairline sm:border-l sm:border-t-0" : ""}`}
              >
                <dt className="font-mono text-xs uppercase tracking-widest text-steel-aa">{row.k}</dt>
                <dd className="mt-1 font-mono text-3xl tabular-nums">{row.v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <p className="mt-6 max-w-2xl font-mono text-sm leading-relaxed">{t("ledgerLead")}</p>
        <div className="mt-3">
          <Citation>{t("sourceIndex", { pass: data.provenancePass ?? "—" })}</Citation>
        </div>

        {/* výpis pořadí */}
        <div className="mt-10 border-2 border-ink">
          <div className="border-b border-ink bg-paper-strong px-3 py-2">
            <span className="font-mono text-xs uppercase tracking-widest">
              {t("ledgerSectionRanking", { shown: data.top.length, total: data.summary.count })}
            </span>
          </div>
          {data.top.map((mp, i) => (
            <LedgerLine key={mp.pspId} n={i + 1} mark={mp.tiedCount > 1}>
              <Link href={`/poslanec/${mp.pspId}`} className="flex min-w-0 items-baseline gap-3 hover:underline">
                <span className="min-w-0 flex-1 truncate font-mono text-sm">{mp.name}</span>
                <span className="shrink-0 font-mono text-xs text-steel-aa">{mp.clubAbbrev}</span>
                <span className="w-14 shrink-0 text-right font-mono text-sm tabular-nums">
                  {f.dec(mp.score)}
                </span>
              </Link>
            </LedgerLine>
          ))}
          <div className="px-3 py-2">
            <Link
              href="/zebricek"
              className="font-mono text-xs uppercase tracking-widest underline decoration-signal decoration-2 underline-offset-4 hover:text-signal-text"
            >
              {t("ctaRest", { rest: data.summary.count - data.top.length })}
            </Link>
          </div>
        </div>

        {/* složení sněmovny jako výpis, ne jako graf */}
        <div className="mt-10 border-2 border-ink">
          <div className="border-b border-ink bg-paper-strong px-3 py-2">
            <span className="font-mono text-xs uppercase tracking-widest">{t("ledgerSectionClubs")}</span>
          </div>
          {data.clubs.map((c, i) => (
            <LedgerLine key={c.abbrev} n={i + 1}>
              <div className="flex min-w-0 items-baseline gap-3">
                {/* barva strany je datový údaj */}
                <span
                  className="inline-block h-2 w-2 shrink-0"
                  style={{ background: c.color }}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate font-mono text-sm">{c.name}</span>
                <span className="w-14 shrink-0 text-right font-mono text-sm tabular-nums">
                  {f.int(c.seats)}
                </span>
              </div>
            </LedgerLine>
          ))}
        </div>
        <div className="mt-3">
          <Citation>{t("sourceChamber")}</Citation>
        </div>
      </section>
    </VariantChrome>
  );
}
