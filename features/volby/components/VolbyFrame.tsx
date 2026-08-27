/*
 * Anatomie stránky /volby (docs/DESIGN.md §5): hlavička s drobečkem a
 * proveniencí → plakátový titulek + SectionRule + jedna úvodní věta → sekce.
 * Chrom (logo, jazyk, zpět) kreslí rail — tady nic z toho.
 */

import Link from "next/link";
import SectionRule from "@/features/shared/components/SectionRule";
import type { Provenance } from "@/lib/analysis/volby/types";
import type { VolbyIntl } from "../volbyIntl";
import ProvenanceLine from "./ProvenanceLine";

export default function VolbyFrame({
  title,
  lead,
  eyebrow,
  provenance,
  t,
  f,
  children,
}: {
  title: string;
  lead: string;
  /** Řádek nad titulkem (lístek, kraj, okres…). */
  eyebrow?: React.ReactNode;
  provenance: Provenance;
  t: VolbyIntl["t"];
  f: VolbyIntl["f"];
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-paper font-sans text-ink">
      <header className="border-b-4 border-ink">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-3">
          <Link href="/volby" className="font-mono text-[11px] font-bold uppercase tracking-widest text-steel-aa hover:text-signal">
            {t("breadcrumb")}
          </Link>
          <ProvenanceLine provenance={provenance} t={t} f={f} />
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-6 pb-20 pt-12">
        {eyebrow && <div className="font-mono text-[11px] font-bold uppercase tracking-widest text-steel-aa">{eyebrow}</div>}
        <h1 className="mt-2 text-5xl font-black uppercase leading-[0.95] tracking-tight sm:text-6xl">
          {title}
          <span className="text-signal">.</span>
        </h1>
        <div className="mt-5 max-w-3xl">
          <SectionRule />
        </div>
        <p className="mt-5 max-w-3xl text-[15px] leading-relaxed text-steel">{lead}</p>
        <div className="mt-14 space-y-14">{children}</div>
      </div>
    </main>
  );
}
