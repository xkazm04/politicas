import type { Metadata } from "next";
import KauzyPage from "@/features/money/KauzyPage";
import { getLeadDossiers } from "@/features/money/getLeadDossiers";

export const metadata: Metadata = {
  title: "Kauzy · FollowTheMoney",
  description:
    "Ruční investigativní spisy (kauzy) — datovaná, citovaná stopa rozdělená na to, co zdroje dokládají a co ne. Vždy čeká na kontrolu, nikdy potvrzené obvinění.",
};

export default async function KauzyRoute() {
  const dossiers = await getLeadDossiers();
  return <KauzyPage dossiers={dossiers} />;
}
