import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import ListPage from "@/features/volby/ListPage";
import { getListData } from "@/features/volby/getListData";
import DataUnavailable from "@/features/shared/components/DataUnavailable";
import { krajBySlug } from "@/lib/analysis/volby/kraje";

/*
 * /volby/snemovna/[slug] — jedna zvolená kandidátka; `?kraj=<slug>` připne
 * poslance toho kraje. Slug kandidátky umí ověřit jen loader (kandidátky
 * vznikají z mandátů PSP10) — proto tu výpadek a 404 rozlišuje jeho výsledek.
 * Neplatný `?kraj=` se tiše zahazuje: adresa kandidátky bez připnutí je
 * platná, chybný parametr ji nemá shazovat.
 */

type Search = Promise<{ [key: string]: string | string[] | undefined }>;

const krajParam = (raw: string | string[] | undefined): string | undefined => {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v && krajBySlug(v) ? v : undefined;
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const t = await getTranslations("meta");
  const result = await getListData(slug);
  if (result === null) return { title: t("volbyUnavailableTitle"), robots: { index: false } };
  if (result.kind === "not-found") return { title: t("volbyNotFound") };
  const list = result.data.list.label;
  return { title: t("volbyListTitle", { list }), description: t("volbyListDescription", { list }) };
}

export default async function ListRoute({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Search }) {
  const [{ slug }, search] = await Promise.all([params, searchParams]);
  const result = await getListData(slug, krajParam(search.kraj));
  if (result === null) {
    const t = await getTranslations("volby");
    return <DataUnavailable what={t("unavailableWhat")} backHref="/volby/snemovna" backLabel={t("snemovna.backToVolby")} />;
  }
  if (result.kind === "not-found") notFound();
  return <ListPage data={result.data} />;
}
