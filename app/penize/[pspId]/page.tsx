import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import DataUnavailable from "@/features/shared/components/DataUnavailable";
import { moneyStoreReadable } from "@/features/money/moneyStoreReadable";
import MpCaseFilePage from "@/features/money/MpCaseFilePage";
import { getMoneyMpDetail } from "@/features/money/getMpDetail";
import { pspIdFromParam } from "@/lib/routing/pspIdParam";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ pspId: string }>;
}): Promise<Metadata> {
  const { pspId } = await params;
  const t = await getTranslations("meta");
  return {
    title: t("moneyMpTitle", { pspId }),
    description: t("moneyMpDescription"),
  };
}

export default async function MpCaseFileRoute({
  params,
}: {
  params: Promise<{ pspId: string }>;
}) {
  const { pspId: pspIdRaw } = await params;
  // Jen číslice — JEDNA definice pravidla (lib/routing/pspIdParam.ts), táž pro
  // /penize/[pspId]/paket; do 2026-09-07 ji každá routa opisovala a komentář
  // odkazoval na sousedy.
  const pspId = pspIdFromParam(pspIdRaw);
  if (pspId === null) notFound();

  const data = await getMoneyMpDetail(pspId);
  // A null read is "no tie" ONLY when the store could be read; otherwise it is an outage
  // and the page must not say the graph holds nothing for this MP.
  if (!data && !(await moneyStoreReadable())) {
    const t = await getTranslations("money");
    return (
      <DataUnavailable what={t("caseFile.unavailableWhat")} backHref="/penize" backLabel={t("caseFile.unavailableBack")} />
    );
  }
  return <MpCaseFilePage data={data} />;
}
