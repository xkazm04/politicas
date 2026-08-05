import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import MpCaseFilePage from "@/features/money/MpCaseFilePage";
import { getMoneyMpDetail } from "@/features/money/getMpDetail";

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
  const pspId = Number(pspIdRaw);
  if (!Number.isInteger(pspId)) notFound();

  const data = await getMoneyMpDetail(pspId);
  return <MpCaseFilePage data={data} />;
}
