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
import { ArrowRight, ScanLine, Stamp } from "lucide-react";
import Link from "next/link";
import CopyLinkButton from "@/features/shared/components/CopyLinkButton";
import ReportClaimLink from "@/features/shared/components/ReportClaimLink";
import SectionRule from "@/features/shared/components/SectionRule";
import SourceNote from "@/features/shared/components/SourceNote";
import { caseFileLinkFor } from "./caseFileLink";
import { claimRefPath } from "./claimRef";
import type { DecodedClaim, DecodedEndpoint, ProvenanceReceipt } from "./receipt";
import { relLabelKey } from "./receipt";
import ReceiptBody from "./ReceiptBody";

const CASE_FILE_LABEL_KEY: Record<"poslanec" | "firma", string> = {
  poslanec: "receipt.caseFile.poslanec",
  firma: "receipt.caseFile.firma",
};

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

/**
 * Citační patička — JEDNA pro doloženou i pro zaniklou účtenku.
 *
 * Zaniklá adresa ji potřebuje stejně (ne-li víc): čtenář, který přišel po
 * citaci, musí mít pořád co zkopírovat, kam poslat opravu a kde si nechat
 * adresu přezkoušet bránou. Druhá kopie patičky by se s touhle rozešla při
 * první opravě — proto sdílená.
 */
function CitationFooter({ encodedRef }: { encodedRef: string }) {
  const t = useTranslations("shared");
  const path = claimRefPath(encodedRef);
  return (
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
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <Link
          href={`/overeni?ref=${encodeURIComponent(path)}`}
          className="inline-flex items-center gap-1.5 border border-ink px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-wider text-ink transition-colors hover:bg-paper-strong hover:text-signal focus-visible:outline focus-visible:outline-2 focus-visible:outline-cobalt"
        >
          <ScanLine className="h-3.5 w-3.5" aria-hidden /> {t("receipt.page.verify")}
        </Link>
        {/* Kanonická adresa tvrzení byla jediná ze čtyř citačních ploch BEZ
            cesty pro námitku — a přitom je to ta, kterou čtenář cituje. */}
        <ReportClaimLink claimRef={encodedRef} />
      </div>
      <SourceNote className="mt-4">{t("receipt.page.footerSource")}</SourceNote>
    </footer>
  );
}

/** Koncový bod zaniklého tvrzení: štítek (nebo doslovné id), spis na naší
 *  ploše — JEN dokud uzel v grafu je — a přiznání, jestli tam ještě je. */
function GoneEndpoint({ endpoint }: { endpoint: DecodedEndpoint }) {
  const t = useTranslations("shared");
  // caseFileLinkFor rozhoduje z TVARU uloženého id (importované pravidlo, nikdy
  // druhá kopie); uzel, který dnešní graf nenese, spis nedostane vůbec — odkaz
  // by vedl na stránku, která sama odpoví „záznam nenalezen".
  const caseFile = endpoint.kind ? caseFileLinkFor({ id: endpoint.id, kind: endpoint.kind }) : null;
  return (
    <div className="min-w-0">
      <p className="truncate font-mono text-[11px] font-bold uppercase tracking-widest text-ink">
        {endpoint.label}
      </p>
      <p className="mt-0.5 break-all font-mono text-[11px] text-steel-aa">{endpoint.id}</p>
      <p className="mt-0.5 font-mono text-[11px] text-steel-aa">
        {endpoint.kind ? t("receipt.page.goneNodeHere") : t("receipt.page.goneNodeMissing")}
      </p>
      {caseFile && (
        <p className="mt-1">
          <Link
            href={caseFile.href}
            className="inline-flex items-center gap-1 font-mono text-xs text-cobalt underline decoration-hairline underline-offset-2 transition-colors hover:text-signal focus-visible:outline focus-visible:outline-2 focus-visible:outline-cobalt"
          >
            {t(CASE_FILE_LABEL_KEY[caseFile.target])}
            <ArrowRight className="h-3 w-3" aria-hidden />
          </Link>
        </p>
      )}
    </div>
  );
}

export function ReceiptGonePage({
  encodedRef,
  decoded,
}: {
  encodedRef: string;
  /** Co adresa TVRDILA (getReceiptData ji stejně luští). Bez ní by stránka
   *  čtenáře nechala stát nad base64 blobem — viz doc getReceiptData. */
  decoded: DecodedClaim;
}) {
  const t = useTranslations("shared");
  // Relace jde katalogem; neznámý token se vypíše doslova (týž vzor jako
  // ReceiptBody) — strojový token se nikdy nepovyšuje na větu.
  const relKey = decoded.rel ? relLabelKey(decoded.rel) : null;
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

        {/* ── co adresa tvrdila ─────────────────────────────────── */}
        <p className="mt-8 font-mono text-[11px] font-bold uppercase tracking-widest text-steel-aa">
          {t("receipt.page.goneClaimKicker")}
        </p>
        <p className="mt-2 text-lg font-black uppercase leading-snug tracking-tight text-ink">
          {decoded.subject.label}
          {decoded.kind === "edge" && decoded.object && (
            <>
              {" "}
              <span className="font-mono text-xs font-normal normal-case tracking-normal text-steel-aa">
                — {relKey ? t(relKey) : decoded.rel} —
              </span>{" "}
              {decoded.object.label}
            </>
          )}
          <span className="text-signal">.</span>
        </p>

        <div className={`mt-4 grid gap-4 ${decoded.object ? "sm:grid-cols-2" : ""}`}>
          <GoneEndpoint endpoint={decoded.subject} />
          {decoded.object && <GoneEndpoint endpoint={decoded.object} />}
        </div>

        <SourceNote className="mt-6">{t("receipt.page.goneRef", { ref: encodedRef })}</SourceNote>
      </div>

      <CitationFooter encodedRef={encodedRef} />
    </PageFrame>
  );
}

export default function ReceiptPage({ receipt }: { receipt: ProvenanceReceipt }) {
  return (
    <PageFrame>
      <div className="border-2 border-ink bg-paper px-5 py-8 sm:px-8 sm:py-10">
        <ReceiptBody receipt={receipt} />
      </div>

      <CitationFooter encodedRef={receipt.ref} />
    </PageFrame>
  );
}
