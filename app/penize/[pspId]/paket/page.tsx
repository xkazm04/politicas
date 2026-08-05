import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import EvidencePacketPage from "@/features/money/EvidencePacketPage";
import { getEvidencePacket } from "@/features/money/getEvidencePacket";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ pspId: string }>;
}): Promise<Metadata> {
  const { pspId } = await params;
  const t = await getTranslations("meta");
  return {
    title: t("moneyPacketTitle", { pspId }),
    description: t("moneyPacketDescription"),
  };
}

export default async function EvidencePacketRoute({
  params,
}: {
  params: Promise<{ pspId: string }>;
}) {
  const { pspId: pspIdRaw } = await params;
  const pspId = Number(pspIdRaw);
  if (!Number.isInteger(pspId)) notFound();

  const data = await getEvidencePacket(pspId);
  return <EvidencePacketPage data={data} />;
}
