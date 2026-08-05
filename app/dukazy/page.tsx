import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { defaultLocale, isLocale } from "@/lib/i18n/config";
import DukazyPage from "@/features/dukazy/DukazyPage";
import { getDukazyData } from "@/features/dukazy/getDukazyData";

/*
 * /dukazy — Deník důkazů (batch 2C): veřejný věstník rozhodnutí lidské brány.
 * Tenká routa: načte feed a předá ho presentační komponentě. Copy včetně
 * metadat žije od 2026-08-05 v messages/{cs,en}.json pod `dukazy.*`; routa
 * ohlašuje oba strojové formáty věstníku (ty zůstávají jednojazyčné).
 */

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("dukazy");
  return {
    title: t("meta.title"),
    description: t("meta.description"),
    alternates: {
      types: {
        "application/rss+xml": "/dukazy/feed.xml",
        "application/feed+json": "/dukazy/feed.json",
      },
    },
  };
}

export default async function DukazyRoute() {
  const rawLocale = await getLocale();
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  // review_audit se mění každým rozhodnutím revizora — čte se za requestu,
  // null → čestný stav „nečitelné, ne prázdné" (viz getDukazyData).
  const data = await getDukazyData();
  return <DukazyPage data={data} locale={locale} />;
}
