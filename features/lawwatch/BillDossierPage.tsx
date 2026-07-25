"use client";

/*
 * /zakony/[cislo] — the per-bill dossier (LawWatch restructure, batch 5). Split
 * out of the old accreted single-page LawWatchPage so every tisk is an
 * independently linkable/shareable page: full dossier body lives in
 * components/BillDetail.tsx, this file is the page shell (brand bar, poster
 * header, prev/next file nav — same idiom as /poslanec/[id]'s Spis).
 */

import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { BillDossier } from "./getLawData";
import BillDetail from "./components/BillDetail";
import SectionRule from "@/features/shared/components/SectionRule";
import SourceNote from "@/features/shared/components/SourceNote";
import LanguageSwitcher from "@/components/LanguageSwitcher";

export default function BillDossierPage({ dossier }: { dossier: BillDossier }) {
  const { bill, prevCislo, nextCislo } = dossier;

  return (
    <main className="min-h-screen overflow-x-clip bg-paper font-sans text-ink">
      <header className="border-b-4 border-ink">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-3 transition-colors hover:text-signal">
              <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden>
                <rect width="32" height="32" className="fill-signal" />
                <circle cx="16" cy="16" r="9" className="fill-paper" />
                <rect x="14.5" y="4" width="3" height="24" className="fill-ink" />
              </svg>
              <span className="text-xl font-black uppercase tracking-tight">Politicas</span>
            </Link>
            <span className="font-mono text-xs uppercase tracking-widest text-steel">/ zákony / tisk</span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/zakony"
              className="inline-flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-cobalt transition-colors hover:text-signal"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> zpět na tisky
            </Link>
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-6">
        <div className="py-10">
          <SourceNote tone="signal">sněmovní tisk · psp.cz</SourceNote>
          <h1 className="mt-3 text-4xl font-black uppercase leading-[0.95] tracking-tight sm:text-5xl">
            {bill.cislo != null ? `Sn. tisk ${bill.cislo}` : `Tisk ${bill.tiskId}`}
            <span className="text-signal">.</span>
          </h1>
          <div className="mt-4 max-w-xl">
            <SectionRule />
          </div>
        </div>

        <BillDetail bill={bill} />

        {/* ── Listování tisky ───────────────────────────────── */}
        <nav className="mb-20 mt-14 grid gap-px border border-ink bg-ink sm:grid-cols-2">
          {[
            { cislo: prevCislo, dir: "prev" as const, Icon: ArrowLeft, align: "text-left" },
            { cislo: nextCislo, dir: "next" as const, Icon: ArrowRight, align: "text-right sm:justify-items-end" },
          ].map(({ cislo, dir, Icon, align }) =>
            cislo != null ? (
              <Link
                key={dir}
                href={`/zakony/${cislo}`}
                className={`grid gap-1 bg-paper p-5 transition-colors hover:bg-paper-strong ${align}`}
              >
                <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-widest text-steel">
                  {dir === "prev" && <Icon className="h-3.5 w-3.5" />}
                  {dir === "prev" ? "předchozí tisk" : "další tisk"} · {cislo}
                  {dir === "next" && <Icon className="h-3.5 w-3.5" />}
                </span>
              </Link>
            ) : (
              <div key={dir} className={`grid gap-1 bg-paper p-5 opacity-40 ${align}`}>
                <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-steel">—</span>
              </div>
            ),
          )}
        </nav>
      </div>
    </main>
  );
}
