"use client";

/*
 * /admin — the operator's monitoring surface over the paused case-loop system
 * (docs/case-loops.md). Internal tool, stays on the Konstrukt system (brand
 * bar → poster title → numbered sections) but skips the public chrome
 * (language switcher, nav to other modules) — single local user, noindex.
 * Three sections: loop progress (how far are the money/effort/law loops),
 * review hub (everything pending_review, one place, deep-linked to the real
 * review surfaces), system state strip (graph totals + paused status).
 */

import Link from "next/link";
import SectionHeading from "@/features/shared/components/SectionHeading";
import SectionRule from "@/features/shared/components/SectionRule";
import LoopProgressGrid from "./components/LoopProgressGrid";
import ReviewHubSection from "./components/ReviewHubSection";
import SystemStateStrip from "./components/SystemStateStrip";
import TripwireSection from "./components/TripwireSection";
import VaultHeadsPanel from "./components/VaultHeadsPanel";
import type { AdminData } from "./adminTypes";

export default function AdminPage({ data }: { data: AdminData }) {
  const { loopProgress, vaultHeads, reviewHub, tripwires, systemState } = data;

  return (
    <main className="min-h-screen bg-paper font-sans text-ink">
      <header className="border-b-4 border-ink">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <Link href="/" className="flex items-center gap-3 transition-colors hover:text-signal">
            <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden>
              <rect width="32" height="32" className="fill-signal" />
              <circle cx="16" cy="16" r="9" className="fill-paper" />
              <rect x="14.5" y="4" width="3" height="24" className="fill-ink" />
            </svg>
            <span className="text-xl font-black uppercase tracking-tight">Politicas</span>
          </Link>
          <span className="font-mono text-xs uppercase tracking-widest text-steel">/ admin</span>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6">
        <div className="py-10">
          <h1 className="text-5xl font-black uppercase leading-[0.95] tracking-tight sm:text-6xl">
            Provoz<span className="text-signal">.</span>
          </h1>
          <div className="mt-4 max-w-xl">
            <SectionRule />
          </div>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-steel">
            Interní přehled běhu analytických smyček (peníze / docházka / zákony) a fronty lidské
            revize. Bez veřejného přístupu, bez indexace — jeden lokální operátor.
          </p>
        </div>

        <section className="border-t-4 border-ink pt-10">
          <SectionHeading index={1} title="Postup smyček" />
          <div className="mt-6">
            <LoopProgressGrid cases={loopProgress} />
          </div>
        </section>

        <section className="mt-16 border-t-4 border-ink pt-10">
          <SectionHeading index={2} title="Fronta revize" />
          <div className="mt-6">
            <ReviewHubSection data={reviewHub} />
          </div>
        </section>

        <section className="mt-16 border-t-4 border-ink pt-10">
          <SectionHeading index={3} title="Hlídky grafu" />
          <div className="mt-6">
            <TripwireSection data={tripwires} />
          </div>
        </section>

        <section className="mt-16 border-t-4 border-ink pt-10 pb-16">
          <SectionHeading index={4} title="Stav systému" />
          <div className="mt-6 grid gap-6 lg:grid-cols-[2fr_1fr]">
            <SystemStateStrip state={systemState} />
            <VaultHeadsPanel heads={vaultHeads} />
          </div>
        </section>
      </div>
    </main>
  );
}
