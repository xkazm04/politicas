"use client";

/*
 * /zdroj/[ref] — trvalá účtenka jednoho tvrzení, celá stránka je doklad.
 *
 * Galerijní sazba vzoru Exponátu: hlavička s drobečkem, plakátový titul,
 * SectionRule, tělo účtenky (týž ReceiptBody jako v kapsli) v orámované kartě
 * a citační patička s trvalou adresou + kopírováním. Strojově čitelný tvar
 * (schema.org/ClaimReview) sází server vedle této komponenty — viz page.tsx.
 *
 * COPY JE V KATALOGU (2026-08-05): čtenářské věty žijí v messages/{cs,en}.json
 * pod `shared.receipt.*` a plocha je sází přes next-intl.
 */

import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { ScanLine, Stamp } from "lucide-react";
import Link from "next/link";
import CopyLinkButton from "@/features/shared/components/CopyLinkButton";
import SectionRule from "@/features/shared/components/SectionRule";
import SourceNote from "@/features/shared/components/SourceNote";
import { claimRefPath } from "./claimRef";
import type { ProvenanceReceipt } from "./receipt";
import ReceiptBody from "./ReceiptBody";

function PageFrame({ children }: { children: React.ReactNode }) {
  const t = useTranslations("shared");
  const reduceMotion = useReducedMotion();
  return (
    <main className="min-h-screen bg-paper font-sans text-ink">
      <header className="border-b-4 border-ink">
        <div className="flex items-center justify-between gap-4 px-6 py-3.5">
          <span className="font-mono text-xs uppercase tracking-widest text-steel-aa">
            {t("receipt.page.brand")}
          </span>
          <SourceNote className="hidden sm:block">{t("receipt.page.headerNote")}</SourceNote>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-6 pb-16">
        <div className="py-10">
          <p className="flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.25em] text-signal">
            <Stamp className="h-3.5 w-3.5" aria-hidden /> {t("receipt.page.kicker")}
          </p>
          <motion.h1
            initial={reduceMotion ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-2 text-4xl font-black uppercase leading-[0.95] tracking-tight sm:text-5xl"
          >
            {t("receipt.page.title")}
            <span className="text-signal">.</span>
          </motion.h1>
          <div className="mt-3 max-w-md">
            <SectionRule />
          </div>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-steel-aa">
            {t("receipt.page.lead")}
          </p>
        </div>
        {children}
      </div>
    </main>
  );
}

export function ReceiptGonePage({ encodedRef }: { encodedRef: string }) {
  const t = useTranslations("shared");
  return (
    <PageFrame>
      <div className="border-2 border-ink bg-paper px-5 py-10 sm:px-8 sm:py-12">
        <p className="max-w-2xl text-2xl font-black leading-snug tracking-tight sm:text-3xl">
          {t("receipt.page.goneTitle")}
          <span className="text-signal">.</span>
        </p>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-steel-aa">
          {t("receipt.page.goneBody")}
        </p>
        <SourceNote className="mt-6">{t("receipt.page.goneRef", { ref: encodedRef })}</SourceNote>
      </div>
    </PageFrame>
  );
}

export default function ReceiptPage({ receipt }: { receipt: ProvenanceReceipt }) {
  const t = useTranslations("shared");
  const path = claimRefPath(receipt.ref);
  return (
    <PageFrame>
      <div className="border-2 border-ink bg-paper px-5 py-8 sm:px-8 sm:py-10">
        <ReceiptBody receipt={receipt} />
      </div>

      <footer className="mt-10 border-t-4 border-ink pt-6">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.25em] text-signal">
          {t("receipt.page.citationKicker")}
        </p>
        <div className="mt-4">
          <CopyLinkButton path={path} errorContext="účtenka: kopírování odkazu selhalo" />
          <p className="mt-2 break-all font-mono text-xs text-steel-aa">{path}</p>
        </div>
        {/* Druhá polovina produktu: účtenka je doklad, brána je jeho přezkoušení.
            Adresa jde do /overeni jako `?ref=` — GET, takže i tenhle výsledek je
            sdílitelná adresa. */}
        <Link
          href={`/overeni?ref=${encodeURIComponent(path)}`}
          className="mt-4 inline-flex items-center gap-1.5 border border-ink px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-wider text-ink transition-colors hover:bg-paper-strong hover:text-signal focus-visible:outline focus-visible:outline-2 focus-visible:outline-cobalt"
        >
          <ScanLine className="h-3.5 w-3.5" aria-hidden /> {t("receipt.page.verify")}
        </Link>
        <SourceNote className="mt-4">{t("receipt.page.footerSource")}</SourceNote>
      </footer>
    </PageFrame>
  );
}
