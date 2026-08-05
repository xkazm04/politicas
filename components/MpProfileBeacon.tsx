"use client";

/*
 * Aktivační maják profilu poslance — jediná zodpovědnost: po zobrazení
 * /poslanec/[id] poslat Plausible událost „mp-profile-view" (jednou na
 * mount / změnu id). Vykresluje nic; bez NEXT_PUBLIC_PLAUSIBLE_DOMAIN je
 * trackEvent tichý no-op (lib/analytics.ts).
 *
 * ZAPOJENÍ (seams pass): v app/poslanec/[id]/page.tsx přidat
 *   <MpProfileBeacon mpId={id} />
 * vedle <ProfilePage …/> — maják musí být per-route, ne v layoutu.
 */

import { useEffect } from "react";
import { trackEvent } from "@/lib/analytics";

export default function MpProfileBeacon({ mpId }: { mpId: string }) {
  useEffect(() => {
    trackEvent("mp-profile-view", { mp: mpId });
  }, [mpId]);
  return null;
}
