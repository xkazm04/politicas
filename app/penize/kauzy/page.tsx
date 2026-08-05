import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import KauzyPage from "@/features/money/KauzyPage";
import { getLeadDossiers } from "@/features/money/getLeadDossiers";
import { getLeadPacketTargets } from "@/features/money/getLeadPacketTargets";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return {
    title: t("kauzyTitle"),
    description: t("kauzyDescription"),
  };
}

export default async function KauzyRoute() {
  const data = await getLeadDossiers();
  // Deterministický join kauza → poslanec (přes IČO firmy a linked_to hranu
  // grafu) — cíle tlačítka „sestavit důkazní paket". Kauza bez IČO nebo bez
  // vazby v grafu odkaz nedostane (drop-don't-guess).
  const packetTargets = await getLeadPacketTargets(
    data.dossiers.flatMap((d) => (d.company ? [d.company.ico] : [])),
  );
  return <KauzyPage data={data} packetTargets={packetTargets} />;
}
