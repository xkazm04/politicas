// Server-only loader for /dashboard/exponat/[id] — DETERMINISTIC RE-DERIVATION,
// zero writes. The exhibit address carries kind + (fact id) + content hash; this
// loader re-runs the SAME read-only pipeline the velín uses (getDashboardData →
// buildStateSlice → buildDatedFacts), re-computes the hash and compares it with
// the one in the address. It never stores an exhibit anywhere: the address IS
// the exhibit, and two requests for the same address over the same graph pass
// produce byte-identical content.
//
// Status contract (the route maps these to HTTP semantics):
//   invalid      — the id does not decode: genuinely no such exhibit → 404.
//   unavailable  — the graph store is unreachable or carries no slice; the
//                  record may exist, so NOT a 404 (same rule as DataUnavailable).
//   gone         — a fact exhibit whose fact today's ledger no longer derives
//                  (new facts pushed it out of the window, or the data changed).
//                  Disclosed on the page; nothing similar is substituted.
//   ok           — content re-derived; `fresh` says whether the address hash
//                  still matches today's content.

import "server-only";
import { getDashboardData } from "./getDashboardData";
import {
  decodeExhibitId,
  encodeExhibitId,
  hashFact,
  hashSlice,
  type ExhibitViewModel,
} from "./exhibit";

export type ExhibitResult = { status: "invalid" } | { status: "unavailable" } | ExhibitViewModel;

export async function getExhibitData(rawId: string): Promise<ExhibitResult> {
  const params = decodeExhibitId(rawId);
  if (!params) return { status: "invalid" };

  const data = await getDashboardData();
  if (!data || !data.slice) return { status: "unavailable" };

  const { slice, feed, builtOn, provenance } = data;

  if (params.kind === "rez") {
    const currentHash = hashSlice(slice);
    return {
      status: "ok",
      kind: "rez",
      // Canonical address for THIS content — the copy-link affordance offers it,
      // so a stale address self-heals into a fresh one when re-shared.
      id: encodeExhibitId({ kind: "rez", hash: currentHash }),
      urlHash: params.hash,
      currentHash,
      fresh: currentHash === params.hash,
      graph: slice.graph,
      rule: slice.rule,
      builtOn,
      pass: provenance.pass,
    };
  }

  const fact = feed?.facts.find((f) => f.id === params.factId) ?? null;
  if (!fact) {
    return { status: "gone", kind: "fakt", id: rawId, urlHash: params.hash, builtOn };
  }
  const currentHash = hashFact(fact);
  return {
    status: "ok",
    kind: "fakt",
    id: encodeExhibitId({ kind: "fakt", factId: fact.id, hash: currentHash }),
    urlHash: params.hash,
    currentHash,
    fresh: currentHash === params.hash,
    fact,
    builtOn,
    pass: provenance.pass,
  };
}
