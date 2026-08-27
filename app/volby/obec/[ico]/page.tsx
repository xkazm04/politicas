import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import ObecPage from "@/features/volby/ObecPage";
import { getObecData } from "@/features/volby/getObecData";
import DataUnavailable from "@/features/shared/components/DataUnavailable";

/*
 * /volby/obec/[ico] — obec jako subjekt komunálního lístku. Tenká routa.
 *
 * VÝPADEK NENÍ „NENALEZENO" (vzor app/poslanec/[id]): loader rozlišuje
 * `{ kind: "not-found" }` (IČO není obec v rejstříku → skutečná 404) od `null`
 * (store nedostupný → DataUnavailable, HTTP 200, noindex v metadatech, aby
 * robot při výpadku neuložil o obci nic).
 */

const ICO = /^\d{8}$/;

export async function generateMetadata({ params }: { params: Promise<{ ico: string }> }): Promise<Metadata> {
  const { ico } = await params;
  const t = await getTranslations("meta");
  if (!ICO.test(ico)) return { title: t("volbyNotFound") };
  const result = await getObecData(ico);
  if (result === null) return { title: t("volbyUnavailableTitle"), robots: { index: false } };
  if (result.kind === "not-found") return { title: t("volbyNotFound") };
  const obec = result.data.obec.name;
  return { title: t("volbyObecTitle", { obec }), description: t("volbyObecDescription", { obec }) };
}

export default async function ObecRoute({ params }: { params: Promise<{ ico: string }> }) {
  const { ico } = await params;
  if (!ICO.test(ico)) notFound(); // an 8-digit IČO is the only shape an obec has
  const result = await getObecData(ico);
  if (result === null) {
    const t = await getTranslations("volby");
    return <DataUnavailable what={t("unavailableWhat")} backHref="/volby" backLabel={t("unavailableBack")} />;
  }
  if (result.kind === "not-found") notFound();
  return <ObecPage data={result.data} />;
}
