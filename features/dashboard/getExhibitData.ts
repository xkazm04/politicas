// Server-only loader for /dashboard/exponat/[id] — DETERMINISTIC RE-DERIVATION,
// zero writes. The exhibit address carries kind + (fact id) + content hash; this
// loader re-runs the SAME read-only pipeline the velín uses (getDashboardData →
// buildStateSlice → buildDatedFacts), re-computes the hash and compares it with
// the one in the address. It never stores an exhibit anywhere: the address IS
// the exhibit, and two requests for the same address over the same graph pass
// produce byte-identical content.
//
// THE LEDGER IS READ WITHOUT ITS WINDOW (`factLedger: "full"`). The velín's feed
// shows FEED_ROWS = 12 newest rows; resolving a citation against THAT window made
// every fact exhibit die once twelve newer facts existed — the page answered
// „gone" and /overeni „zaznam-nenalezen" about a row the same pass still derives.
// The window is a prefix of the full book (same inputs, same order), so a row
// behind it is not a different record: it resolves normally and says it is older
// than the front-page window. See features/dashboard/datedFacts.ts, rule 6.
//
// Status contract (the route maps these to HTTP semantics):
//   invalid      — the id does not decode: genuinely no such exhibit → 404.
//   unavailable  — the graph store is unreachable or carries no slice; the
//                  record may exist, so NOT a 404 (same rule as DataUnavailable).
//   gone         — a fact exhibit whose fact today's pass NO LONGER DERIVES (the
//                  data changed). Disclosed on the page; nothing similar is
//                  substituted. Falling out of the display window is NOT this.
//   ok           — content re-derived; `fresh` says whether the address hash
//                  still matches today's content, `beyondWindow` whether the row
//                  sits behind the front-page window.

import "server-only";
import { getDashboardData } from "./getDashboardData";
import {
  decodeExhibitId,
  factExhibitView,
  sliceExhibitView,
  type ExhibitViewModel,
} from "./exhibit";

export type ExhibitResult = { status: "invalid" } | { status: "unavailable" } | ExhibitViewModel;

export async function getExhibitData(rawId: string): Promise<ExhibitResult> {
  const params = decodeExhibitId(rawId);
  if (!params) return { status: "invalid" };

  const data = await getDashboardData({ factLedger: "full" });
  if (!data || !data.slice) return { status: "unavailable" };

  const { slice, feed, builtOn, provenance } = data;
  // `rawId` je CITOVANÁ adresa — doslova to, co čtenář drží. Nepřepisuje se na
  // dnešní kanonickou (tu nese `id`): afordance zastaralého exponátu se musí
  // ptát na tvrzení, které kdosi vydal, ne na dnešní obsah.
  const meta = { builtOn, pass: provenance.pass };

  if (params.kind === "rez") return sliceExhibitView(rawId, params, slice, meta);
  // Bez slice není feed (getDashboardData je staví spolu) — a slice je tu už
  // ověřený. Prázdná kniha se pak chová jako každá jiná: fakt v ní není ⇒ gone.
  return factExhibitView(rawId, params, feed ?? { facts: [], droppedImplausible: 0, considered: 0 }, meta);
}
