"use client";

/*
 * Fallback pro `<Suspense>` kolem rubriky „Dnešní zápis", dokud běží odečet
 * deníku. Říká, co se děje — tiché prázdno by se nedalo odlišit od dne, který
 * žádný zápis nenese.
 *
 * Vlastní soubor a KLIENT schválně, přesně jako RebellionInstancesPending:
 * fallback hranice `<Suspense>` nesmí sám čekat. Kdyby byl `async` a čekal na
 * `getTranslations()`, čekala by na něj i ta hranice, kvůli které tu vůbec je.
 * `useTranslations` je synchronní.
 *
 * Rám (pruh, titulek, odkaz na deník) je záměrně týž jako u naplněné rubriky,
 * takže se stránka pod čtenářem po dopluta neposune.
 */

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useTranslations } from "next-intl";

export default function DenikTeaserPending() {
  const t = useTranslations("landing");
  return (
    <section aria-label={t("denik.regionLabel")} className="border-t-4 border-ink">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-xs font-bold uppercase tracking-widest text-signal-deep">
              {t("denik.eyebrowToday")}
            </p>
            <h2 className="mt-1 text-3xl font-black uppercase tracking-tight sm:text-4xl">
              {t("denik.title")}<span className="text-signal">.</span>
            </h2>
          </div>
          <Link
            href="/denik"
            className="group inline-flex items-center gap-1 font-mono text-xs font-bold uppercase tracking-widest text-signal-deep hover:underline"
          >
            {t("denik.readLink")}{" "}
            <ArrowUpRight
              className="h-3 w-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              aria-hidden
            />
          </Link>
        </div>
        <p className="mt-4 max-w-2xl text-sm text-steel-aa">{t("denik.loading")}</p>
      </div>
    </section>
  );
}
