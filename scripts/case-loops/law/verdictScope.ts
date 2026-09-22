/* Case ③ Law loop — the anti-fabrication scope a forensic verdict is gated against, ONE
 * definition (scan-sweep 2026-09-07).
 *
 * Until now it was computed three times and no two agreed: prepare-batch.ts shipped
 * company/person/law ids to the army (so an agent self-checking a `graph_fact` on a bill or
 * organ node saw it rejected), gate-verdicts.ts checked company/person/law/bill/organ (the
 * batch-003 "one scope" decision), and the write-time gate in scripts/data-analysis/
 * kg-forensics.ts accepts every node id in the graph. The pre-write pair — what the army is
 * told and what the gate enforces — now reads this module; the write-time gate is another
 * context and is named in the backlog.
 */
import { existsSync, readFileSync } from "node:fs";

/** Node kinds a `graph_fact` citation may point at (batch-003, matching the gate). */
export const VERDICT_ID_KINDS = ["company", "person", "law", "bill", "organ"] as const;

export const KNOWN_LAWS_REGISTRY = ".data/esbirka/known-laws.json";

export interface VerdictGateScope {
  /** `N/RRRR` refs of the graph's law nodes ∪ the e-Sbírka registry. */
  knownLawRefs: Set<string>;
  /** Ids of the citable kinds. */
  knownIds: Set<string>;
  /** Law refs that came from the graph alone (reported beside the registry-widened count). */
  graphLawCount: number;
}

type ScopeNode = { id: string; kind: string; props: unknown };

/** The e-Sbírka registry when cached, else null — injectable so the scope is testable. */
export function readKnownLawsRegistry(path = KNOWN_LAWS_REGISTRY): { refs: string[] } | null {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as { refs: string[] };
}

export function verdictGateScope(
  nodes: readonly ScopeNode[],
  readRegistry: () => { refs: string[] } | null = readKnownLawsRegistry,
): VerdictGateScope {
  const knownLawRefs = new Set(
    nodes.filter((n) => n.kind === "law").map((n) => String((n.props as Record<string, unknown> | null)?.ref ?? "")),
  );
  knownLawRefs.delete("");
  const graphLawCount = knownLawRefs.size;
  const registry = readRegistry();
  if (registry) for (const r of registry.refs) knownLawRefs.add(r);
  const kinds: readonly string[] = VERDICT_ID_KINDS;
  const knownIds = new Set(nodes.filter((n) => kinds.includes(n.kind)).map((n) => n.id));
  return { knownLawRefs, knownIds, graphLawCount };
}
