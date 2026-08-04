/*
 * The six contribution components as the READER meets them — key, published weight,
 * Czech label and the psp.cz dataset each one is computed from.
 *
 * PURE, and deliberately NOT inside `getLeaderboardData.ts`: this is reader-facing
 * Czech copy plus a citation per row, published to /zebricek, /kraj, the /referendum
 * embed widget and the printed poster. Living in a `server-only` module it could not
 * be imported by anything that renders on the client or by a test fixture — so the
 * six labels and the six source strings were RETYPED as literals in three test
 * fixtures (kraj.test.ts, lens.test.ts, referendum/embed.test.ts) and the component
 * ORDER was retyped a fourth time in `lens.ts` (`LENS_COMPONENT_ORDER`, with a comment
 * saying it could not import the real thing). A label change diverged them silently:
 * nothing compared the fixture's "Účast při hlasování" to the product's.
 *
 * One definition, imported at every end — the same discipline `resolveTieClass` gave
 * /penize and `reachableMoney` gave the money total. The weights are NOT restated
 * here either: they come from `lib/analysis/contribution.ts`, the formula's home, so
 * a weight change reflows the product instead of drifting away from it.
 *
 * Pinned by componentDefs.test.ts: the weights equal the formula's, they sum to 100,
 * and every label and source passes the Czech language gate.
 */

import { CONTRIBUTION_WEIGHTS } from "@/lib/analysis/contribution";

/** The six contribution components, in published-weight order — the breakdown axis. */
export const COMPONENT_DEFS = [
  { key: "participation", weight: CONTRIBUTION_WEIGHTS.participation, label: "Účast při hlasování", source: "psp.cz — poziční hlasy" },
  { key: "committee", weight: CONTRIBUTION_WEIGHTS.committee, label: "Práce ve výborech", source: "psp.cz — členství ve výborech" },
  { key: "legislative", weight: CONTRIBUTION_WEIGHTS.legislative, label: "Legislativní výstup", source: "psp.cz — tisky + interpelace" },
  { key: "speech", weight: CONTRIBUTION_WEIGHTS.speech, label: "Vystoupení v sále", source: "psp.cz — stenozáznamy" },
  { key: "attendance", weight: CONTRIBUTION_WEIGHTS.attendance, label: "Docházka", source: "psp.cz — omluvy" },
  { key: "leadership", weight: CONTRIBUTION_WEIGHTS.leadership, label: "Vedení orgánů", source: "psp.cz — funkce ve výborech" },
] as const;

export type ComponentKey = (typeof COMPONENT_DEFS)[number]["key"];

/** One component row in the shape the loaders publish (mutable, non-literal types). */
export interface ComponentDef {
  key: ComponentKey;
  weight: number;
  label: string;
  source: string;
}

/** The published defs as a plain array — what a loader puts in its payload and what a
 *  test fixture should use instead of retyping six rows. */
export const componentDefs = (): ComponentDef[] => COMPONENT_DEFS.map((c) => ({ ...c }));
