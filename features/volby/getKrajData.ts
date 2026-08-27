// Server-only loader for `/volby/kraj/[slug]` — the kraj as zadavatel (krajské ballot),
// the national list summaries, and the kraj's CURRENT MPs keyed by their elected list.
//
// The slug is resolved against the 14-row crosswalk (`krajBySlug`); an unknown slug is
// `not-found`. The kraj's MPs are the leaderboard entries whose psp.cz volební kraj
// label equals the crosswalk row's (`regionLabelFromPspName`), current holders only.

import "server-only";
import { reportLoaderFailure } from "@/lib/db/loaderGuard";
import { storeReady } from "@/lib/db/readiness";
import { getStore } from "@/lib/db/store";
import { krajBySlug, regionLabelFromPspName } from "@/lib/analysis/volby/kraje";
import type { KrajData } from "@/lib/analysis/volby/types";
import { loadTenderLayer } from "./tenderLayer";
import { NOT_FOUND, authorityCard, billsByMp, chamberForVolby, listSummaries, ok, volbyProvenance, type VolbyResult } from "./volbyLoader";

export async function getKrajData(slug: string): Promise<VolbyResult<KrajData>> {
  const kraj = krajBySlug(slug);
  if (!kraj) return NOT_FOUND;
  try {
    const store = await getStore();
    if (!store) return null;
    if (!(await storeReady(store, ["person", "company"]))) return null;

    const layer = await loadTenderLayer(store);
    const chamber = await chamberForVolby(store);
    const bills = await billsByMp(store);

    const region = regionLabelFromPspName(kraj.pspLabel);
    const mps = (chamber?.mps ?? [])
      .filter((m) => m.current && m.region === region && m.listSlug !== null)
      .map((m) => ({ pspId: m.pspId, name: m.name, listSlug: m.listSlug as string, club: m.clubAbbrev }));

    return ok({
      kraj,
      krajske: authorityCard(layer, kraj.krajIco, "krajske", kraj.name, `/volby/kraj/${kraj.slug}`),
      lists: chamber ? listSummaries(chamber, bills) : [],
      mps,
      provenance: volbyProvenance({
        layer,
        chamber,
        bills,
        extraSources: ["lib/analysis/volby/kraje.ts (crosswalk)"],
        extraCounts: {
          krajLots: layer.authorities.get(kraj.krajIco)?.lots.length ?? 0,
          krajInTenderGraph: layer.authorities.has(kraj.krajIco) ? 1 : 0,
          krajMps: mps.length,
        },
      }),
    });
  } catch (err) {
    reportLoaderFailure("getKrajData", err);
    return null;
  }
}
