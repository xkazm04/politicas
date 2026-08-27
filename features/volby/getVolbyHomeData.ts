// Server-only loader for `/volby` — the lookup page's national context: the live arena
// census (authorities · lots · flagged share · CZK floor per arena), the 20 latest dated
// findings across authorities AND lists, and the six elected-list summaries.
//
// Degrades to `null` only on an outage (no store, floors unmet, a read threw — each
// reported). An EMPTY tender layer is not an outage: the census renders with zero rows
// and `latest: []`, and the page says „bez zakázek", never nothing.

import "server-only";
import { reportLoaderFailure } from "@/lib/db/loaderGuard";
import { storeReady } from "@/lib/db/readiness";
import { getStore } from "@/lib/db/store";
import type { VolbyHomeData } from "@/lib/analysis/volby/types";
import { loadTenderLayer } from "./tenderLayer";
import { allAuthorityFindings, billsByMp, chamberForVolby, listRollups, sortNewest, volbyProvenance } from "./volbyLoader";

export const LATEST_LIMIT = 20;

export async function getVolbyHomeData(): Promise<VolbyHomeData | null> {
  try {
    const store = await getStore();
    if (!store) return null;
    if (!(await storeReady(store, ["person", "company"]))) return null;

    const layer = await loadTenderLayer(store);
    const chamber = await chamberForVolby(store);
    const bills = await billsByMp(store);
    const rollups = chamber ? listRollups(chamber, bills) : [];

    const latest = sortNewest([
      ...allAuthorityFindings(layer),
      ...rollups.flatMap((r) => [...r.findingsByPspId.values()].flat()),
    ]).slice(0, LATEST_LIMIT);

    return {
      census: layer.census.map((c) => ({
        arena: c.arena,
        authorities: c.authorities,
        lots: c.lots,
        flaggedShare: c.flaggedShare,
        czkFloor: c.czkFloor,
      })),
      latest,
      lists: rollups.map((r) => r.summary),
      provenance: volbyProvenance({
        layer,
        chamber,
        bills,
        extraCounts: { latest: latest.length, authorityFindings: allAuthorityFindings(layer).length },
      }),
    };
  } catch (err) {
    reportLoaderFailure("getVolbyHomeData", err);
    return null;
  }
}
