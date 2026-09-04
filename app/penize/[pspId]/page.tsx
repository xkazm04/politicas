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
  // Jen číslice: `Number("1e3")`, `Number("0x10")` i `Number(" 5")` jsou celá
  // čísla, takže jeden poslanec měl několik adres — kanonická je ta, kterou
  // staví každý odkaz v aplikaci (prosté celé číslo). Totéž pravidlo drží
  // /poslanec/[id] a /penize/[pspId]/paket.
  if (!/^\d+$/.test(pspIdRaw)) notFound();
  const pspId = Number(pspIdRaw);

  const data = await getMoneyMpDetail(pspId);
  return <MpCaseFilePage data={data} />;
}
