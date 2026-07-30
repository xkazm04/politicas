import type { Metadata } from "next";
import { notFound } from "next/navigation";
import EvidencePacketPage from "@/features/money/EvidencePacketPage";
import { getEvidencePacket } from "@/features/money/getEvidencePacket";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ pspId: string }>;
}): Promise<Metadata> {
  const { pspId } = await params;
  return {
    title: `Důkazní paket poslance ${pspId} · FollowTheMoney`,
    description:
      "Spis poslance zkompilovaný do citovatelného paketu — výhradně lidsky ověřené vazby, časová osa, rejstříkové odkazy a hotové citační bloky. Vyloučený neověřený materiál je přiznán.",
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
