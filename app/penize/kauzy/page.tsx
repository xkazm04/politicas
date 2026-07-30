import type { Metadata } from "next";
import KauzyPage from "@/features/money/KauzyPage";
import { getLeadDossiers } from "@/features/money/getLeadDossiers";
import { getLeadPacketTargets } from "@/features/money/getLeadPacketTargets";

export const metadata: Metadata = {
  title: "Kauzy · FollowTheMoney",
  description:
    "Ruční investigativní spisy (kauzy) — datovaná, citovaná stopa rozdělená na to, co zdroje dokládají a co ne. Vždy čeká na kontrolu, nikdy potvrzené obvinění.",
};

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
