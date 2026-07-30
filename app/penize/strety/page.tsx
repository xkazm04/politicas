import type { Metadata } from "next";
import StretyPage from "@/features/money/collisions/StretyPage";
import { getCollisionCandidates } from "@/features/money/collisions/getCollisionCandidates";

export const metadata: Metadata = {
  title: "Střety u hlasování · FollowTheMoney",
  description:
    "Deterministicky vypočtené kandidáty střetů: hlasování poslance o tisku novelizujícím zákon, který upravuje kanál veřejných peněz firmy, kde v den hlasování podle rejstříku zastával roli. Časový překryv je fakt; každý kandidát vyžaduje lidské ověření, nic tady není obvinění.",
};

export default async function StretyRoute() {
  // Kandidáti se odvozují znovu při KAŽDÉM požadavku (žádné review-řádky,
  // žádná materializace) — null, když datová vrstva není dostupná.
  const data = await getCollisionCandidates();
  return <StretyPage data={data} />;
}
