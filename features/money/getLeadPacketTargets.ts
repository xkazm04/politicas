// Server-only: deterministický join kauza → poslanec pro tlačítko „sestavit
// důkazní paket" na /penize/kauzy. Ruční spis (LeadDossier) nenese pspId —
// jediný tvrdý klíč je IČO firmy, a graf už drží hranu person --linked_to-->
// company. Tenhle loader ji čte POUZE přes index (kgNeighbours na uzlu firmy,
// nikdy celorelační sken) a vrací poslance, kterým lze paket sestavit.
//
// Pravidlo drop-don't-guess: kauza bez IČO, IČO bez uzlu v grafu nebo firma
// bez linked_to hrany → žádný odkaz. Nikdy se nejmenuje podle jména subjektu
// (fuzzy match jmen je hádání, ne join). Selhání čehokoliv degraduje na
// prázdný výsledek — odkaz je navigační pohodlí, ne tvrzení, a jeho absence
// nesmí shodit kauzy.

import "server-only";
import { reportLoaderFailure } from "@/lib/db/loaderGuard";
import { storeReady } from "@/lib/db/readiness";
import { getStore } from "@/lib/db/store";
import { KG_READ_CAP } from "@/lib/db/readCap";
import { canonicalIco, companyNodeId } from "./companyId";
import { pspIdFromNodeId } from "./moneyLoader";

export interface PacketTarget {
  pspId: number;
  name: string;
}

/** IČO → poslanci s doloženou linked_to vazbou na tu firmu (pspId vzestupně).
 *  Plain objekt (ne Map) — jde přes hranici server → klient. */
export async function getLeadPacketTargets(icos: string[]): Promise<Record<string, PacketTarget[]>> {
  const out: Record<string, PacketTarget[]> = {};
  try {
    const store = await getStore();
    if (!store) return out;
    if (!(await storeReady(store, ["person", "company"]))) return out;

    for (const ico of [...new Set(icos)].filter(Boolean)) {
      /* IČO ze SPISU je ruční zápis, ne uzel grafu — a graf klíčuje firmu na
       * osmimístný tvar (memory/ico-node-id-canonical-form.md). Nekanonizovaný
       * segment tu vyráběl TICHÝ FALEŠNÝ ZÁPOR: `company:ico:2867681` v grafu
       * není, kgNeighbours vrátí prázdno a kauza mlčky přijde o odkaz na paket,
       * jako by na firmu žádný poslanec navázaný nebyl. Kanonizuje se týmž
       * pravidlem, na kterém stojí routa /penize/firma/[ico] — a IČO, které
       * IČO být nemůže, se přeskočí, nikdy „neopraví". */
      const canonical = canonicalIco(ico);
      if (!canonical) continue;
      const companyId = companyNodeId(canonical);
      const read = await store.kgNeighbours({ id: companyId, rels: ["linked_to"], limit: KG_READ_CAP });
      const nodeById = new Map(read.nodes.map((n) => [n.id, n]));
      const targets: PacketTarget[] = [];
      const seen = new Set<number>();
      // person --linked_to--> company: poslanec je src, firma dst.
      for (const e of read.edges) {
        if (e.dst !== companyId) continue;
        const pspId = pspIdFromNodeId(e.src);
        const person = nodeById.get(e.src);
        if (pspId == null || !person || seen.has(pspId)) continue; // unresolved → drop, never guess
        seen.add(pspId);
        targets.push({ pspId, name: person.label });
      }
      targets.sort((a, b) => a.pspId - b.pspId);
      if (targets.length > 0) out[ico] = targets;
    }
    return out;
  } catch (err) {
    reportLoaderFailure("getLeadPacketTargets", err);
    return out;
  }
}
