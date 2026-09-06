// Server-only loader for `/volby/obec/[ico]` — one obec as zadavatel (komunální ballot),
// its kraj as zadavatel (krajské), and the national list summaries.
//
// The obec is resolved against the 6 254-row static registry (`getMunicipality`), not the
// graph: an ico the registry does not know is `not-found` (a 404), even if the graph held
// a company with that ico — a company is not an obec. The obec↔authority join is IČO
// EQUALITY ONLY: the obec's příspěvkovky and city companies are the national `nejasne`
// count, disclosed as `unlinked.nejasneNational`, never localised to this obec.

import "server-only";
import { getMunicipality } from "@/features/budget/mirrorData";
import { KRAJE } from "@/features/budget/data/registryData.generated";
import { reportLoaderFailure } from "@/lib/db/loaderGuard";
import { storeReady } from "@/lib/db/readiness";
import { getStore } from "@/lib/db/store";
import { krajByNuts } from "@/lib/analysis/volby/kraje";
import type { ObecData } from "@/lib/analysis/volby/types";
import { loadTenderLayer } from "./tenderLayer";
import { NOT_FOUND, authorityCard, billsByMp, chamberForVolby, listSummaries, ok, volbyProvenance, type VolbyResult } from "./volbyLoader";

/** Jediný tvar, který obec má: osm číslic. Routa i loader čtou TUHLE funkci —
 *  do 2026-09-07 měla každá vlastní regulární výraz. */
export const isObecIco = (raw: string): boolean => /^\d{8}$/.test(raw);

export async function getObecData(ico: string): Promise<VolbyResult<ObecData>> {
  if (!isObecIco(ico)) return NOT_FOUND;
  const obec = getMunicipality(ico);
  if (!obec) return NOT_FOUND;
  try {
    const store = await getStore();
    if (!store) return null;
    if (!(await storeReady(store, ["person", "company"]))) return null;

    const layer = await loadTenderLayer(store);
    const chamber = await chamberForVolby(store);
    const bills = await billsByMp(store);

    const nuts = KRAJE[obec.krajIndex]?.nuts ?? null;
    const kraj = nuts ? krajByNuts(nuts) : null;
    const komunalni = authorityCard(layer, obec.ic, "komunalni", obec.name, `/volby/obec/${obec.ic}`);
    const krajCard = kraj ? authorityCard(layer, kraj.krajIco, "krajske", kraj.name, `/volby/kraj/${kraj.slug}`) : null;
    const nejasne = layer.census.find((c) => c.arena === "nejasne");

    return ok({
      obec: { ico: obec.ic, name: obec.name, county: obec.county, krajSlug: kraj?.slug ?? "", population: obec.population },
      komunalni,
      unlinked: { nejasneNational: nejasne?.authorities ?? 0, note: "nepropojeno" },
      krajCard,
      lists: chamber ? listSummaries(chamber, bills) : [],
      provenance: volbyProvenance({
        layer,
        chamber,
        bills,
        extraSources: ["registr obcí (features/budget, MONITOR)", "lib/analysis/volby/kraje.ts (crosswalk)"],
        extraCounts: {
          obecLots: layer.authorities.get(obec.ic)?.lots.length ?? 0,
          obecInTenderGraph: layer.authorities.has(obec.ic) ? 1 : 0,
          krajResolved: kraj ? 1 : 0,
        },
      }),
    });
  } catch (err) {
    reportLoaderFailure("getObecData", err);
    return null;
  }
}
