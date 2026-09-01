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
  // Jen číslice — týž tvar adresy jako /penize/[pspId] a /poslanec/[id];
  // `Number("1e3")` by paket vydal pod druhou adresou.
  if (!/^\d+$/.test(pspIdRaw)) notFound();
  const pspId = Number(pspIdRaw);

  const data = await getEvidencePacket(pspId);
  return <EvidencePacketPage data={data} />;
}
