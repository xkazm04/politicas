import type { Metadata } from "next";
import { notFound } from "next/navigation";
import MpCaseFilePage from "@/features/money/MpCaseFilePage";
import { getMoneyMpDetail } from "@/features/money/getMpDetail";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ pspId: string }>;
}): Promise<Metadata> {
  const { pspId } = await params;
  return {
    title: `Spis poslance ${pspId} · FollowTheMoney`,
    description: "Plný důkazní řetězec vazeb poslanec↔firma — smlouvy, dotace, dary, korroborace v ARES VR.",
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
