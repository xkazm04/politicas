"use client"; // error boundaries must be Client Components

/*
 * Chybová hranice pro celý strom pod kořenovým layoutem — tedy pro každou
 * plochu aplikace, která nemá vlastní bližší error.tsx. Na rozdíl od
 * global-error.tsx se vykresluje UVNITŘ layoutu (levá lišta zůstává), takže
 * čtenář má pořád kudy odejít jinam. Chyba v samotném kořenovém layoutu sem
 * nedosáhne — od toho je app/global-error.tsx.
 *
 * Hlášení: Sentry.captureException, stejně jako v chokepointu loaderů
 * (lib/db/loaderGuard.ts). Bez NEXT_PUBLIC_SENTRY_DSN se Sentry vůbec
 * neinicializuje a captureException je tichý no-op.
 *
 * A PRÁVĚ PROTO tahle plocha do 2026-08-13 lhala. `errors.route.body` končilo
 * větou „Hlášení jsme odeslali." (en „A report has been sent.") — tvrzení,
 * které v tomhle repozitáři neplatí NIKDY: DSN tu není nastavené, takže se
 * neodeslalo nic. Hlavička nad tímhle odstavcem to popisovala správně už
 * tehdy; uživateli se to neřeklo. Věta je pryč a na její místo nastoupil
 * `digestNote`: identifikátor pádu je to JEDINÉ, co čtenář opravdu má, a
 * platí to stejně s DSN i bez něj. Podmiňovat copy na env by znamenalo mít dvě
 * verze pravdy a testovat tu, která zrovna neběží.
 *
 * Poctivost: tahle plocha NIC netvrdí o datech. Chyba vykreslování není totéž
 * co „záznam neexistuje" (404) ani „zdroj je dočasně nedostupný"
 * (features/shared/components/DataUnavailable.tsx) — a nesmí se za ně vydávat.
 */

import { useEffect } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import * as Sentry from "@sentry/nextjs";
import SectionRule from "@/features/shared/components/SectionRule";

export default function RouteError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  const t = useTranslations("errors");

  useEffect(() => {
    console.error("[route-error] vykreslení plochy selhalo", error);
    Sentry.captureException(error, { tags: { boundary: "route-error" } });
  }, [error]);

  return (
    <main className="min-h-screen bg-paper font-sans text-ink">
      <div className="mx-auto max-w-3xl px-6 py-20">
        <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-signal">
          {t("route.kicker")}
        </p>
        <h1 className="mt-3 text-4xl font-black uppercase leading-[0.95] tracking-tight sm:text-5xl">
          {t("route.title")}
          <span className="text-signal">.</span>
        </h1>
        <div className="mt-4 max-w-md">
          <SectionRule />
        </div>
        {/* `steel-aa` (4,90:1), ne `steel` (4,11:1): tenhle odstavec je drobný
            text pod prahem 18,66 px, takže na něj WCAG AA klade 4,5:1. */}
        <p className="mt-6 text-base leading-relaxed text-steel-aa">{t("route.body")}</p>
        {error.digest ? (
          <>
            <p className="mt-4 font-mono text-[11px] uppercase tracking-widest text-steel-aa">
              {t("route.digestLabel")} <span className="text-ink">{error.digest}</span>
            </p>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-steel-aa">
              {t("route.digestNote")}
            </p>
          </>
        ) : null}
        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => unstable_retry()}
            className="border-2 border-ink bg-ink px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-wider text-paper transition-colors hover:border-signal hover:bg-signal"
          >
            {t("route.retry")}
          </button>
          <Link
            href="/dashboard"
            className="border-2 border-ink px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-wider text-ink transition-colors hover:bg-paper-strong"
          >
            {t("route.backToDashboard")}
          </Link>
        </div>
      </div>
    </main>
  );
}
