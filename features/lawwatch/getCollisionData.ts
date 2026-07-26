// Server-only: the "kolize tisků" (bill-collision) loader for /zakony/kolize.
//
// Case ③ (law-forensics) batches 001–004 ran a deterministic §-overlap pre-check
// (scripts/case-loops/law/collision-check.ts, batch-004 gained a `--v2` partitioned
// mode that scopes each bill's §-set to the statute its own novelization instructions
// actually target — see docs/data-analysis/case-law/payloads/collision-report-v2.json)
// followed by an LLM close-read of every surviving candidate pair, driver-verified by
// direct grep of the cited instruction strings against the cached psp.cz novelization
// text (P49: grep verifies presence, never a second model read).
//
// 38 pairs were close-read across 4 batches: 17 confirmed-collision, 9 coordination-risk,
// 12 incidental (noise — same §-number, different statute, or a citation-only artifact).
// This loader surfaces the 26 non-incidental pairs, GROUPED BY (statute, §) rather than
// by bill-pair — batch-003's handoff recorded the lesson that several are genuine N-way
// clusters (the §35ba/§35c 586/1992 complex now spans 4 bills; two new 3-way clusters
// landed in batch-004: 117/1995 §30(1) across tisky 112/121/198, 243/2000 §3 across
// 28/140/141).
//
// These are FORENSIC LEADS, never verdicts: two bills independently proposing
// incompatible or order-sensitive edits to the same statutory provision is a
// legislative-DRAFTING-PROCESS finding, not an ethics or corruption finding. Nothing
// here implies wrongdoing — render as flagged/derived, per the law-verdict gate
// discipline (pending_review-style framing), never as settled fact.
//
// Degrades to null if no store is configured or neither payload file is readable — the
// route then hides the real section rather than fabricating anything.

import "server-only";
import { asUnion } from "@/lib/db/narrow";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { reportLoaderFailure } from "@/lib/db/loaderGuard";
import { getStore } from "@/lib/db/store";

export const COLLISION_CLASSIFICATIONS = ["confirmed-collision", "coordination-risk"] as const;
export type CollisionClassification = (typeof COLLISION_CLASSIFICATIONS)[number];

export interface CollisionEvidence {
  billAExcerpt: string | null;
  billBExcerpt: string | null;
}

export interface CollisionPairView {
  pairId: string;
  billA: number;
  billB: number;
  classification: CollisionClassification;
  sharedParagraph: string;
  evidence: CollisionEvidence;
  reasoning: string | null;
  sourceBatch: number; // 1–5, which batch produced this close-read
  postRegenTopology: boolean; // true for batch-005 pairs found via the regenerated (not-yet-live) amends topology
  sourceMethod: string; // one-line method note for the SourceNote
}

export interface CollisionBillRef {
  /** The public sněmovní-tisk print number (psp.cz `t=`/`ct=` param) — this is what every
   * close-read payload's billA/billB and every "tisk N" reference in this case's docs means.
   * It is NOT the graph's internal `bill:tisk:<id>` node-id suffix, which is a separate,
   * unrelated internal id (verified: tisk 4's node id is `bill:tisk:43111`, props.cislo = 4). */
  cislo: number;
  title: string | null; // resolved from the graph's bill node label; null if store unavailable
}

export interface CollisionClusterView {
  key: string; // "586/1992§35c"
  lawRef: string; // "586/1992"
  lawTitle: string | null; // resolved from the graph's law node esbirka_title; may be null
  paragraph: string; // representative "§ N" label for the cluster
  classification: CollisionClassification; // strongest classification among the cluster's pairs
  bills: CollisionBillRef[];
  pairs: CollisionPairView[];
}

export interface CollisionData {
  clusters: CollisionClusterView[];
  confirmedPairCount: number;
  coordinationRiskPairCount: number;
  clusterCount: number;
  nWayClusterCount: number; // clusters spanning ≥3 bills
  batchesRun: number; // 5
  /** batch-005 close-reads were surfaced from the REGENERATED amends topology (574→567 edges,
   * corrected post-Opus-audit) — candidate discovery itself depended on edges/law-nodes that are
   * NOT yet applied to the live graph (see docs/data-analysis/case-law/handoff.md). Every
   * individual pair rendered here still only cites bills/statutes that already exist live (the
   * pairs happen to all involve pre-existing law nodes), so nothing here is fabricated — but the
   * SET of candidates that got read was found using topology the live graph doesn't have yet.
   * Rendered as a clearly separate, labeled group; never merged silently into the batch 1-4 count. */
  postRegenPendingCount: number;
}

const PAYLOADS_DIR = "docs/data-analysis/case-law/payloads";

/** Raw shape shared by collision-close-reads.json and collision-close-reads-batch004.json
 * (batch-003's file additionally carries a `group` field on each pair — unused here). */
interface RawPair {
  pairId: string;
  billA: number;
  billB: number;
  lawRef: string;
  classification: string; // "confirmed-collision" | "coordination-risk" | "incidental" | "incidental-overlap"
  sharedParagraph: string;
  evidence?: { billAExcerpt?: string; billBExcerpt?: string };
  reasoning?: string;
}

function loadRawPairs(file: string): RawPair[] {
  try {
    const p = join(PAYLOADS_DIR, file);
    if (!existsSync(p)) return [];
    const raw = JSON.parse(readFileSync(p, "utf8")) as { pairs?: unknown };
    if (!Array.isArray(raw.pairs)) return [];
    return raw.pairs.flatMap((x) => {
      if (typeof x !== "object" || x === null) return [];
      const o = x as Record<string, unknown>;
      if (typeof o.pairId !== "string" || typeof o.billA !== "number" || typeof o.billB !== "number") return [];
      if (typeof o.lawRef !== "string" || typeof o.classification !== "string" || typeof o.sharedParagraph !== "string") return [];
      const evidence = (o.evidence ?? {}) as Record<string, unknown>;
      return [{
        pairId: o.pairId,
        billA: o.billA,
        billB: o.billB,
        lawRef: o.lawRef,
        classification: o.classification,
        sharedParagraph: o.sharedParagraph,
        evidence: {
          billAExcerpt: typeof evidence.billAExcerpt === "string" ? evidence.billAExcerpt : undefined,
          billBExcerpt: typeof evidence.billBExcerpt === "string" ? evidence.billBExcerpt : undefined,
        },
        reasoning: typeof o.reasoning === "string" ? o.reasoning : undefined,
      }];
    });
  } catch (err) {
    reportLoaderFailure("getCollisionData.payload", err);
    return []; // a malformed payload file must not break the page — skip, don't fabricate
  }
}

/** The two batch-001/002 prior-confirmed pairs predate the current pairs-array JSON shape
 * (they were the loop's very first close-reads, narrated in batch-001.md / batch-002.md
 * rather than machine-written). Their classification and § locus are exact — carried
 * forward from `docs/data-analysis/case-law/batch-001.md` §"tisk 244" and
 * `batch-002.md` §3 ("The tisk 111↔207 collision claim") — but no verbatim grep excerpt
 * was captured in that narrative form, so `evidence` is honestly left null rather than
 * inventing quoted text. Never delete the reasoning without checking those source .md files. */
const PRIOR_PAIRS: RawPair[] = [
  {
    pairId: "120-244",
    billA: 120,
    billB: 244,
    lawRef: "586/1992",
    classification: "confirmed-collision",
    sharedParagraph: "35ba odst. 1",
    reasoning:
      "tisk 244 repeals the married-couple spousal credit and tisk 120 restructures the same " +
      "§35ba(1) a)–e) list — both bills issue renumbering instructions to §35ba that assume " +
      "DIFFERENT starting letterings. If tisk 120 enacts first, tisk 244's clause strikes the " +
      "wrong provision. First discovered case in the loop (batch-001) — the seed for the whole " +
      "collision-detection line of work; batch-003/004 close-reads confirmed tisk 4 and tisk 121 " +
      "also touch this §35ba/§35c complex, extending it to a 4-bill cluster.",
  },
  {
    pairId: "111-207",
    billA: 111,
    billB: 207,
    lawRef: "40/2009",
    classification: "coordination-risk",
    sharedParagraph: "88 odst. 2 písm. c)",
    reasoning:
      "Both government EU-transposition bills independently amend §88 odst. 2 písm. c) of the " +
      "trestní zákoník — the deterministic pre-check flagged the shared §88 header verbatim in " +
      "both bills' fetched texts (collision-report.json, no LLM in the loop). The two edits touch " +
      "DIFFERENT substrings of the same clause (tisk 111 renumbers a §168 cross-reference \"4, 5\"→" +
      "\"5, 6\"; tisk 207 renumbers a §283 cross-reference \"odst. 4\"→\"odst. 5\" and inserts rtuť " +
      "language) rather than clashing on the same text, so this is a softer coordination risk than " +
      "the same-text 120↔244 clash, not a guaranteed drafting error.",
  },
];

/** Best-effort leading paragraph token: "35c odst. 1" → "35c", "30, 31" → "30",
 * "56, 57, 58, 58a, 58b, 66 (also …)" → "56". Used only to GROUP pairs that already share
 * a lawRef — never to invent a classification or discard genuine per-pair detail (each
 * pair keeps its own full `sharedParagraph` string in the rendered card). */
function primaryParagraph(sharedParagraph: string): string {
  const m = /^(\d+[a-z]?)/.exec(sharedParagraph.trim());
  return m ? m[1] : sharedParagraph.trim();
}

function asStr(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

export async function getCollisionData(): Promise<CollisionData | null> {
  try {
    const batch5Pairs = loadRawPairs("collision-close-reads-batch005.json");
    const rawAll = [
      ...PRIOR_PAIRS,
      ...loadRawPairs("collision-close-reads.json"),
      ...loadRawPairs("collision-close-reads-batch004.json"),
      ...batch5Pairs,
    ].filter((p) => p.classification === "confirmed-collision" || p.classification === "coordination-risk");

    if (rawAll.length === 0) return null;

    // sourceBatch: prior pairs are batch 1/2 (their own pairId is the tell), the two JSON
    // files are batch 3 and batch 4, batch-005's own file is batch 5.
    const priorIds = new Set(PRIOR_PAIRS.map((p) => p.pairId));
    const batch3Pairs = loadRawPairs("collision-close-reads.json");
    const batch3Ids = new Set(batch3Pairs.map((p) => p.pairId));
    const batch5Ids = new Set(batch5Pairs.map((p) => p.pairId));
    const sourceBatchOf = (pairId: string): number => {
      if (priorIds.has(pairId)) return pairId === "120-244" ? 1 : 2;
      if (batch3Ids.has(pairId)) return 3;
      if (batch5Ids.has(pairId)) return 5;
      return 4;
    };

    // Union-find over (lawRef, primaryParagraph) — pairs sharing a statute+§ merge into
    // one cluster (the N-way case the kernel's patterns note requires).
    const keyOf = (p: RawPair) => `${p.lawRef}§${primaryParagraph(p.sharedParagraph)}`;
    const clusterKeys = new Map<string, RawPair[]>();
    for (const p of rawAll) {
      const k = keyOf(p);
      const arr = clusterKeys.get(k) ?? [];
      arr.push(p);
      clusterKeys.set(k, arr);
    }

    // Resolve bill titles and law titles from the graph — gracefully null if no store.
    // Bill nodes are looked up by props.cislo (the public print number), NOT by the node-id
    // suffix — see the CollisionBillRef doc comment for why.
    const store = await getStore();
    const billTitleByCislo = new Map<number, string>();
    const lawTitleByRef = new Map<string, string>();
    if (store) {
      const billNodes = await store.listKgNodes({ kind: "bill", limit: 100_000 });
      for (const n of billNodes) {
        const p = (n.props ?? {}) as Record<string, unknown>;
        if (typeof p.cislo === "number") billTitleByCislo.set(p.cislo, n.label);
      }
      const lawNodes = await store.listKgNodes({ kind: "law", limit: 100_000 });
      for (const n of lawNodes) {
        const p = (n.props ?? {}) as Record<string, unknown>;
        const ref = asStr(p.ref);
        const title = asStr(p.esbirka_title);
        if (ref && title) lawTitleByRef.set(ref, title);
      }
    }

    const billRef = (cislo: number): CollisionBillRef => ({
      cislo,
      title: billTitleByCislo.get(cislo) ?? null,
    });

    const clusters: CollisionClusterView[] = [...clusterKeys.entries()].map(([key, pairs]) => {
      const lawRef = pairs[0].lawRef;
      // representative paragraph label: the shortest sharedParagraph string among the
      // cluster's pairs tends to be the cleanest single-locus label (long ones carry
      // "(corroborated by …)" asides that belong to that specific pair's card, not the header).
      const paragraph = pairs
        .map((p) => p.sharedParagraph)
        .sort((a, b) => a.length - b.length)[0];
      const classification: CollisionClassification = pairs.some((p) => p.classification === "confirmed-collision")
        ? "confirmed-collision"
        : "coordination-risk";
      const billIds = [...new Set(pairs.flatMap((p) => [p.billA, p.billB]))].sort((a, b) => a - b);
      return {
        key,
        lawRef,
        lawTitle: lawTitleByRef.get(lawRef) ?? null,
        paragraph,
        classification,
        bills: billIds.map(billRef),
        pairs: pairs
          .map((p) => ({
            pairId: p.pairId,
            billA: p.billA,
            billB: p.billB,
            // out-of-vocab values degrade to the weaker claim, mirroring the
            // cluster-level rule above (only exact "confirmed-collision" escalates)
            classification: asUnion(p.classification, COLLISION_CLASSIFICATIONS, "coordination-risk"),
            sharedParagraph: p.sharedParagraph,
            evidence: {
              billAExcerpt: asStr(p.evidence?.billAExcerpt),
              billBExcerpt: asStr(p.evidence?.billBExcerpt),
            },
            reasoning: asStr(p.reasoning ?? null),
            sourceBatch: sourceBatchOf(p.pairId),
            postRegenTopology: sourceBatchOf(p.pairId) === 5,
            sourceMethod:
              sourceBatchOf(p.pairId) <= 2
                ? "deterministic §-overlap pre-check + LLM close-read (narrated, batch-001/002)"
                : sourceBatchOf(p.pairId) === 5
                  ? "deterministic partitioned pre-check on the REGENERATED (not-yet-live) amends topology, ranked by a money/coefficient-literal signal (P52), LLM close-read"
                  : "deterministic partitioned pre-check (--v2) + LLM close-read, grep-verified",
          }))
          .sort((a, b) => (a.classification === b.classification ? 0 : a.classification === "confirmed-collision" ? -1 : 1)),
      };
    });

    // Confirmed clusters first, then by bill count (N-way clusters lead), then by lawRef.
    clusters.sort((a, b) => {
      if (a.classification !== b.classification) return a.classification === "confirmed-collision" ? -1 : 1;
      if (b.bills.length !== a.bills.length) return b.bills.length - a.bills.length;
      return a.lawRef.localeCompare(b.lawRef);
    });

    const confirmedPairCount = rawAll.filter((p) => p.classification === "confirmed-collision").length;
    const coordinationRiskPairCount = rawAll.filter((p) => p.classification === "coordination-risk").length;
    const postRegenPendingCount = rawAll.filter((p) => batch5Ids.has(p.pairId)).length;

    return {
      clusters,
      confirmedPairCount,
      coordinationRiskPairCount,
      clusterCount: clusters.length,
      nWayClusterCount: clusters.filter((c) => c.bills.length >= 3).length,
      batchesRun: 5,
      postRegenPendingCount,
    };
  } catch (err) {
    reportLoaderFailure("getCollisionData", err);
    return null;
  }
}
