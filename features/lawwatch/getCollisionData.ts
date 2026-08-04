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
// 63 pairs have been close-read across batches 001–008; this loader surfaces the 44
// non-incidental ones, GROUPED BY (statute, §) rather than by bill-pair — batch-003's handoff
// recorded the lesson that several are genuine N-way clusters (the §35ba/§35c 586/1992 complex
// spans 4 bills; batch-004 added 117/1995 §30(1) across tisky 112/121/198 and 243/2000 §3
// across 28/140/141; batch-008 added a 4-bill cluster on 40/2009 §88 odst. 2 písm. c) across
// tisky 7/111/207/213).
//
// Batch-009 wired batch-008's 12 pairs, which had been sitting unrendered. That was NOT the
// "one filename away" job the batch-008 reflection assumed: batch-008's payload writes its
// classifications in a DIFFERENT vocabulary (`confirmed` / `coordination_risk`) than the four
// earlier payloads (`confirmed-collision` / `coordination-risk`), so adding the filename alone
// would have silently dropped all 12 pairs at the filter below — a failure that looks exactly
// like "no new findings" and reports nothing. `normalizeClassification` now maps both spellings.
//
// Czech-first (kernel step 6, the presentation gate): every `reasoning` string in every payload
// was written in English by the analyst army and rendered verbatim to Czech readers — measured
// 44/44 by lib/analysis/language-gate.ts. `collision-reasoning-cz.json` carries the Czech
// rewrite keyed by `<file>::<pairId>`; the gate withholds anything still English rather than
// shipping it, exactly as getLawData.ts does for the forensic verdicts (pass 33).
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

import { czechCopyOrNull } from "@/lib/analysis/language-gate";
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
  /** Czech analyst prose, or null when only an English original exists and the language gate
   * withheld it. Never a machine translation, never a partial. */
  reasoning: string | null;
  /** True when a reasoning exists but was withheld for not being Czech — lets the surface say
   * so honestly instead of rendering a blank card. */
  reasoningWithheld: boolean;
  sourceBatch: number; // 1–5 or 8, which batch produced this close-read
  sourceMethod: string; // one-line method note for the SourceNote
  /** ISO timestamp the finding entered the archive — the source payload's own
   * `generatedAt` (for batch-001/002 prior pairs: the deterministic pre-check
   * report that first flagged them, collision-report.json). Null when the
   * artifact carries no parseable date — never invented. Feeds the radar
   * chronology (moonshot 4B). */
  detectedAt: string | null;
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
  batchesRun: number; // distinct close-read batches represented here
  /** How many rendered pairs still have no Czech analyst prose, so the surface can disclose the
   * gap instead of quietly showing fewer words. */
  czechPendingCount: number;
}

const PAYLOADS_DIR = "docs/data-analysis/case-law/payloads";

/** Raw shape shared by collision-close-reads.json and collision-close-reads-batch004.json
 * (batch-003's file additionally carries a `group` field on each pair — unused here). */
interface RawPair {
  pairId: string;
  billA: number;
  billB: number;
  lawRef: string;
  classification: string; // normalized to "confirmed-collision" | "coordination-risk" | "incidental"
  sharedParagraph: string;
  evidence?: { billAExcerpt?: string; billBExcerpt?: string };
  reasoning?: string;
  /** Which payload this pair came from — the Czech-rewrite key is `<sourceFile>::<pairId>`,
   * and pairIds are NOT unique across payloads (4-121 exists in both batch-004 and batch-005
   * on different statutes), so the file must be part of the key. */
  sourceFile?: string;
  /** The payload file's own `generatedAt` — when this finding entered the archive. */
  detectedAt?: string | null;
}

/** Payload `generatedAt` values are either full ISO timestamps or date-only
 * ("2026-07-27"); both parse. Anything else → null, never a guessed date. */
function asIsoDate(v: unknown): string | null {
  return typeof v === "string" && Number.isFinite(Date.parse(v)) ? v : null;
}

/** Payloads disagree on how they spell a classification. batch-008 writes `confirmed` and
 * `coordination_risk`; batches 001–005 write `confirmed-collision` and `coordination-risk`.
 * Both mean the same thing, and an unmapped spelling is silently filtered out downstream —
 * so the mapping lives here, once, at the single point every payload is read through. */
function normalizeClassification(raw: string): string {
  switch (raw) {
    case "confirmed":
      return "confirmed-collision";
    case "coordination_risk":
      return "coordination-risk";
    case "incidental-overlap":
      return "incidental";
    default:
      return raw;
  }
}

/** Czech rewrites of the analyst prose, keyed `<payload file>::<pairId>`.
 * See docs/data-analysis/case-law/payloads/collision-reasoning-cz.json. */
function loadCzechReasoning(): Map<string, string> {
  try {
    const p = join(PAYLOADS_DIR, "collision-reasoning-cz.json");
    if (!existsSync(p)) return new Map();
    const raw = JSON.parse(readFileSync(p, "utf8")) as { reasoningCz?: unknown };
    if (typeof raw.reasoningCz !== "object" || raw.reasoningCz === null) return new Map();
    return new Map(
      Object.entries(raw.reasoningCz as Record<string, unknown>).filter(
        (e): e is [string, string] => typeof e[1] === "string" && e[1].length > 0,
      ),
    );
  } catch (err) {
    reportLoaderFailure("getCollisionData.czechReasoning", err);
    return new Map(); // the gate below then withholds — degrade to silence, never to English
  }
}

function loadRawPairs(file: string): RawPair[] {
  try {
    const p = join(PAYLOADS_DIR, file);
    if (!existsSync(p)) return [];
    const raw = JSON.parse(readFileSync(p, "utf8")) as { pairs?: unknown; generatedAt?: unknown };
    if (!Array.isArray(raw.pairs)) return [];
    const detectedAt = asIsoDate(raw.generatedAt);
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
        classification: normalizeClassification(o.classification),
        sourceFile: file,
        detectedAt,
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
/* The 120-244 prior pair (batch-001's first discovered collision, narrated in batch-001.md
 * with no captured excerpt) was SUPERSEDED in batch-011: the pair was independently re-read
 * with grep-verified verbatim excerpts and native-Czech reasoning, and now enters through
 * collision-close-reads-batch011-gA.json — whose reasoning discloses the batch-001 lineage.
 * Keeping both would render the same finding twice under two batches. */
const PRIOR_PAIRS: RawPair[] = [
  {
    pairId: "111-207",
    billA: 111,
    billB: 207,
    lawRef: "40/2009",
    classification: "coordination-risk",
    sharedParagraph: "88 odst. 2 písm. c)",
    // Czech since batch-011 — the English original sat withheld by the render-time language
    // gate (czechPendingCount 1) from the moment the gate landed in pass 33; the substance is
    // carried unchanged from batch-002.md §3.
    reasoning:
      "Oba vládní transpoziční tisky nezávisle novelizují § 88 odst. 2 písm. c) trestního " +
      "zákoníku — deterministická předkontrola zachytila sdílený nadpis § 88 doslovně v obou " +
      "stažených textech (collision-report.json, bez zapojení jazykového modelu). Obě úpravy se " +
      "ale dotýkají RŮZNÝCH úseků téhož ustanovení (tisk 111 přečíslovává odkaz na § 168 „4, 5“ → " +
      "„5, 6“; tisk 207 přečíslovává odkaz na § 283 „odst. 4“ → „odst. 5“ a vkládá formulaci o " +
      "rtuti), nestřetávají se tedy na stejném textu — jde o měkčí koordinační riziko, nikoli o " +
      "zaručenou legislativní chybu, jakou byl textově shodný střet 120↔244.",
  },
];

/** Best-effort leading paragraph token: "35c odst. 1" → "35c", "30, 31" → "30",
 * "56, 57, 58, 58a, 58b, 66 (also …)" → "56". Used only to GROUP pairs that already share
 * a lawRef — never to invent a classification or discard genuine per-pair detail (each
 * pair keeps its own full `sharedParagraph` string in the rendered card). */
function primaryParagraph(sharedParagraph: string): string {
  // `[a-z]?` allowed only ONE trailing letter, so a genuine multi-letter
  // paragraph suffix (e.g. "35ba") truncated to "35b" — silently merging what
  // should be a distinct paragraph into whatever cluster "35b" already
  // belongs to, in the app's most trust-sensitive forensic feature.
  const m = /^(\d+[a-z]*)/.exec(sharedParagraph.trim());
  return m ? m[1] : sharedParagraph.trim();
}

function asStr(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

/** Batch-001/002's prior pairs predate the dated pairs-array payloads; the artifact
 * that first flagged both is the deterministic pre-check report, whose own
 * `generatedAt` is the honest "entered the record" moment for them. */
function loadPrecheckDate(): string | null {
  try {
    const p = join(PAYLOADS_DIR, "collision-report.json");
    if (!existsSync(p)) return null;
    const raw = JSON.parse(readFileSync(p, "utf8")) as { generatedAt?: unknown };
    return asIsoDate(raw.generatedAt);
  } catch (err) {
    reportLoaderFailure("getCollisionData.precheckDate", err);
    return null; // undated is honest; a guessed date would not be
  }
}

export async function getCollisionData(): Promise<CollisionData | null> {
  try {
    const precheckDate = loadPrecheckDate();
    const batch5Pairs = loadRawPairs("collision-close-reads-batch005.json");
    const batch8Pairs = loadRawPairs("collision-close-reads-batch008.json");
    const batch9Pairs = loadRawPairs("collision-close-reads-batch009.json");
    const batch11Pairs = [
      ...loadRawPairs("collision-close-reads-batch011-gA.json"),
      ...loadRawPairs("collision-close-reads-batch011-gB.json"),
    ];
    const rawAll = [
      ...PRIOR_PAIRS.map((p) => ({ ...p, detectedAt: precheckDate })),
      ...loadRawPairs("collision-close-reads.json"),
      ...loadRawPairs("collision-close-reads-batch004.json"),
      ...batch5Pairs,
      ...batch8Pairs,
      ...batch9Pairs,
      ...batch11Pairs,
    ].filter((p) => p.classification === "confirmed-collision" || p.classification === "coordination-risk");

    if (rawAll.length === 0) return null;

    // sourceBatch: prior pairs are batch 1/2 (their own pairId is the tell), the two JSON
    // files are batch 3 and batch 4, batch-005's own file is batch 5.
    const priorIds = new Set(PRIOR_PAIRS.map((p) => p.pairId));
    const batch3Pairs = loadRawPairs("collision-close-reads.json");
    const batch3Ids = new Set(batch3Pairs.map((p) => p.pairId));
    const batch5Ids = new Set(batch5Pairs.map((p) => p.pairId));
    const batch8Ids = new Set(batch8Pairs.map((p) => p.pairId));
    const batch9Ids = new Set(batch9Pairs.map((p) => p.pairId));
    const batch11Ids = new Set(batch11Pairs.map((p) => p.pairId));
    const sourceBatchOf = (pairId: string): number => {
      if (priorIds.has(pairId)) return 2;
      if (batch11Ids.has(pairId)) return 11;
      if (batch3Ids.has(pairId)) return 3;
      if (batch9Ids.has(pairId)) return 9;
      if (batch8Ids.has(pairId)) return 8;
      if (batch5Ids.has(pairId)) return 5;
      return 4;
    };
    const czechReasoning = loadCzechReasoning();

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
          .map((p) => {
            // Czech rewrite first, then the gate on whatever we ended up with. An English
            // original is withheld, never machine-translated and never shown — the same
            // non-destructive discipline getLawData.ts applies to the forensic verdicts.
            const cz = p.sourceFile ? czechReasoning.get(`${p.sourceFile}::${p.pairId}`) : undefined;
            const reasoning = czechCopyOrNull(cz ?? p.reasoning ?? null);
            const hadReasoning = typeof (cz ?? p.reasoning) === "string" && (cz ?? p.reasoning)!.length > 0;
            return {
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
            reasoning,
            reasoningWithheld: hadReasoning && reasoning === null,
            detectedAt: p.detectedAt ?? null,
            sourceBatch: sourceBatchOf(p.pairId),
            sourceMethod:
              sourceBatchOf(p.pairId) <= 2
                ? "deterministický §-překryv + ruční porovnání textů (dávka 001/002)"
                : sourceBatchOf(p.pairId) === 9
                  ? "deterministický dělený §-překryv nad živou topologií, stratifikovaný vzorek testující signál „přepis proti dílčí náhradě“, ruční porovnání textů, každá citace ověřena vyhledáním v archivovaném textu"
                  : sourceBatchOf(p.pairId) === 8
                    ? "deterministický dělený §-překryv nad živou topologií 577 hran amends, ruční porovnání textů, ověřeno grepem"
                    : sourceBatchOf(p.pairId) === 5
                      ? "deterministický dělený §-překryv nad přegenerovanou topologií amends (od té doby nasazenou), ruční porovnání textů"
                      : "deterministický dělený §-překryv (--v2) + ruční porovnání textů, ověřeno grepem",
            };
          })
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
    const allPairs = clusters.flatMap((c) => c.pairs);

    return {
      clusters,
      confirmedPairCount,
      coordinationRiskPairCount,
      clusterCount: clusters.length,
      nWayClusterCount: clusters.filter((c) => c.bills.length >= 3).length,
      // batches 001, 002, 003, 004, 005, 008 — derived, so it cannot fall behind the payloads
      // the way the hardcoded `5` did once batch-008's file was added.
      batchesRun: new Set(allPairs.map((p) => p.sourceBatch)).size,
      czechPendingCount: allPairs.filter((p) => p.reasoningWithheld).length,
    };
  } catch (err) {
    reportLoaderFailure("getCollisionData", err);
    return null;
  }
}
