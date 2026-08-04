"use client";

/*
 * Fallback pro `<Suspense>` kolem jmenovitých rebelií, dokud se hlasovací
 * záznam čte. Říká, co se děje — tiché prázdno by se nedalo odlišit od
 * poslance, který nikdy nerebeloval.
 *
 * Vlastní soubor a KLIENT schválně. Zbytek spisu se 2026-08-04 překlopil na
 * serverové komponenty, ale fallback Suspense boundary nesmí sám čekat: kdyby
 * byl `async` a čekal na `getTranslations()`, čekala by na něj i ta hranice,
 * kvůli které tu boundary vůbec je. `useTranslations` je synchronní.
 */

import { useTranslations } from "next-intl";

export default function RebellionInstancesPending() {
  const t = useTranslations("profile");
  return (
    <p className="mt-6 max-w-3xl border-l-4 border-hairline pl-4 text-[13px] leading-relaxed text-steel">
      {t("rebelInstancesPending")}
    </p>
  );
}
