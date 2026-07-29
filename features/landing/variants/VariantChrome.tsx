"use client";

/**
 * Společná hlava a pata pro varianty úvodní strany.
 *
 * Landing je `isBareRoute()` — levá lišta aplikace ho nezabaluje, takže si
 * značku a patu kreslí sám (viz docs/DESIGN.md §5: uvnitř zabalené stránky by
 * to byla chyba, tady je to povinnost).
 *
 * Pata nese jedinou větu, kterou musí unést každá varianta: co je zdroj a čím
 * se skóre počítá. Varianty se smějí lišit vším ostatním, tímhle ne.
 */

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useFormat } from "@/lib/i18n/useFormat";
import SourceNote from "@/features/shared/components/SourceNote";
import type { LandingData } from "../getLandingData";

export default function VariantChrome({
  data,
  children,
}: {
  data: LandingData;
  children: React.ReactNode;
}) {
  const t = useTranslations("landingVariants");
  const f = useFormat();

  return (
    <main className="min-h-screen overflow-x-clip bg-paper font-sans text-ink">
      <header className="border-b border-hairline">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <span className="text-xl font-black uppercase tracking-tight">Politicas</span>
          <nav className="flex flex-wrap gap-4 font-mono text-xs uppercase tracking-widest">
            <Link href="/zebricek" className="hover:text-signal-deep">
              {t("navRanking")}
            </Link>
            <Link href="/hlasovani" className="hover:text-signal-deep">
              {t("navVotes")}
            </Link>
            <Link href="/penize" className="hover:text-signal-deep">
              {t("navMoney")}
            </Link>
            <Link href="/zakony" className="hover:text-signal-deep">
              {t("navLaws")}
            </Link>
          </nav>
        </div>
      </header>

      {children}

      <footer className="border-t-4 border-ink">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <SourceNote>
            {t("footerMethod", {
              count: data.summary.count,
              parts: data.components.length,
              pass: data.provenancePass ?? "—",
            })}
          </SourceNote>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {data.components.map((c) => (
              <li key={c.key} className="flex items-baseline justify-between gap-3 border-b border-hairline pb-1">
                <span className="min-w-0 truncate text-sm">{c.label}</span>
                <span className="shrink-0 font-mono text-xs tabular-nums text-steel-aa">
                  ×&nbsp;{f.int(c.weight)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </footer>
    </main>
  );
}
