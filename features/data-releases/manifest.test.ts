import { describe, expect, it } from "vitest";
import { CARDINALITY_FLOORS, floorVerdicts } from "@/lib/db/readiness";
import type { IngestRunRow } from "@/lib/db/types";
import {
  deriveChangelog,
  deriveReleaseManifest,
  versionFromIso,
  type ReleaseStats,
} from "./manifest";

// Pomocník: ingest běh s rozumnými defaulty.
const run = (over: Partial<IngestRunRow> & { id: number }): IngestRunRow => ({
  source: "psp-poslanci",
  startedAt: "2026-07-29T10:00:00.000Z",
  finishedAt: "2026-07-29T10:05:00.000Z",
  status: "ok",
  sourceUrl: null,
  sourceLastModified: null,
  rowsWritten: 100,
  note: null,
  ...over,
});

// Statistiky, které splňují všechny prahy (aby degraded=false byl výchozí).
const healthyStats = (): ReleaseStats => ({
  kindCounts: (Object.keys(CARDINALITY_FLOORS) as Array<keyof typeof CARDINALITY_FLOORS>).map((kind) => ({
    kind,
    count: CARDINALITY_FLOORS[kind] + 10,
  })),
  edgeRelCounts: { linked_to: 42, supplies: 2000 },
  kgNodeTotal: 2500,
  kgEdgeTotal: 2042,
  voteBallotTotal: 402_800,
  ingestRuns: [
    run({ id: 1, finishedAt: "2026-07-28T09:00:00.000Z" }),
    run({ id: 2, finishedAt: "2026-07-30T09:00:00.000Z" }),
  ],
  ledgerHeads: {
    reviewChain: { chainPos: 3, rowHash: "ab".repeat(32), id: "audit-3", decidedAt: "2026-07-29T12:00:00.000Z", length: 4 },
    sealedRuns: [
      { runId: 1, source: "psp-poslanci", status: "ok", merkleRoot: "cd".repeat(32), leafCount: 100, sealedAt: "2026-07-28T09:06:00.000Z", finishedAt: "2026-07-28T09:00:00.000Z" },
      { runId: 2, source: "psp-hlasovani", status: "ok", merkleRoot: "ef".repeat(32), leafCount: 200, sealedAt: "2026-07-30T09:06:00.000Z", finishedAt: "2026-07-30T09:00:00.000Z" },
    ],
  },
});

describe("versionFromIso", () => {
  it("řeže YYYY.MM.DD z ISO okamžiku", () => {
    expect(versionFromIso("2026-07-30T09:00:00.000Z")).toBe("2026.07.30");
    expect(versionFromIso("2026-07-30")).toBe("2026.07.30");
  });
  it("neparsovatelný vstup → null, nikdy vymyšlená verze", () => {
    expect(versionFromIso("nesmysl")).toBeNull();
  });
});

describe("floorVerdicts", () => {
  it("chybějící kind = 0 → pod prahem; pořadí je pevné (klíče FLOORS)", () => {
    const verdicts = floorVerdicts({ person: 207 });
    expect(verdicts.map((v) => v.kind)).toEqual(Object.keys(CARDINALITY_FLOORS));
    expect(verdicts.find((v) => v.kind === "person")).toMatchObject({ count: 207, ok: true });
    expect(verdicts.find((v) => v.kind === "contract")).toMatchObject({ count: 0, ok: false });
  });
  it("přesně na prahu je splněno", () => {
    const v = floorVerdicts({ person: CARDINALITY_FLOORS.person }).find((x) => x.kind === "person");
    expect(v?.ok).toBe(true);
  });
});

describe("deriveReleaseManifest", () => {
  it("verzi řeže nejnovější dokončený úspěšný běh", () => {
    const m = deriveReleaseManifest(healthyStats());
    expect(m.version).toBe("2026.07.30");
    expect(m.cutAt).toBe("2026-07-30T09:00:00.000Z");
    expect(m.degraded).toBe(false);
  });

  it("selhané a běžící běhy verzi nevydávají; bez úspěchu je verze null", () => {
    const stats = healthyStats();
    stats.ingestRuns = [
      run({ id: 1, status: "failed", finishedAt: "2026-07-30T09:00:00.000Z" }),
      run({ id: 2, status: "running", finishedAt: null }),
    ];
    const m = deriveReleaseManifest(stats);
    expect(m.version).toBeNull();
    expect(m.cutAt).toBeNull();
    expect(m.lineage.failedRuns).toBe(1);
  });

  it("libovolný práh pod čarou → degraded", () => {
    const stats = healthyStats();
    stats.kindCounts = stats.kindCounts.map((k) =>
      k.kind === "contract" ? { ...k, count: CARDINALITY_FLOORS.contract - 1 } : k,
    );
    expect(deriveReleaseManifest(stats).degraded).toBe(true);
  });

  it("DETERMINISMUS: pořadí vstupních polí nemění otisk manifestu", () => {
    const a = deriveReleaseManifest(healthyStats());
    const shuffled = healthyStats();
    shuffled.kindCounts = [...shuffled.kindCounts].reverse();
    shuffled.ledgerHeads.sealedRuns = [...shuffled.ledgerHeads.sealedRuns].reverse();
    const b = deriveReleaseManifest(shuffled);
    expect(b.manifestHash).toBe(a.manifestHash);
    expect(b).toEqual(a);
  });

  it("jiný obsah ⇒ jiný otisk", () => {
    const a = deriveReleaseManifest(healthyStats());
    const stats = healthyStats();
    stats.voteBallotTotal += 1;
    expect(deriveReleaseManifest(stats).manifestHash).not.toBe(a.manifestHash);
  });

  it("normalizace: kinds/edgeRels abecedně, sealedRuns runId sestupně", () => {
    const m = deriveReleaseManifest(healthyStats());
    const kinds = m.counts.kinds.map((k) => k.kind);
    expect(kinds).toEqual([...kinds].sort());
    const rels = m.counts.edgeRels.map((r) => r.rel);
    expect(rels).toEqual([...rels].sort());
    expect(m.integrity.sealedRuns.map((r) => r.runId)).toEqual([2, 1]);
  });
});

describe("deriveChangelog", () => {
  const runs: IngestRunRow[] = [
    run({ id: 1, source: "a", finishedAt: "2026-07-28T09:00:00.000Z", rowsWritten: 10 }),
    run({ id: 2, source: "b", finishedAt: "2026-07-30T08:00:00.000Z", rowsWritten: 20 }),
    run({ id: 3, source: "c", finishedAt: "2026-07-30T11:00:00.000Z", rowsWritten: 30 }),
    run({ id: 4, source: "d", status: "failed", finishedAt: "2026-07-28T12:00:00.000Z", rowsWritten: 0 }),
    // Nedokončený běh se řadí podle startu.
    run({ id: 5, source: "e", status: "running", startedAt: "2026-07-29T07:00:00.000Z", finishedAt: null, rowsWritten: 0 }),
  ];

  it("dny od nejnovějšího, uvnitř dne běhy od nejnovějšího", () => {
    const log = deriveChangelog(runs);
    expect(log.map((d) => d.date)).toEqual(["2026-07-30", "2026-07-29", "2026-07-28"]);
    expect(log[0].runs.map((r) => r.id)).toEqual([3, 2]);
    expect(log[0].version).toBe("2026.07.30");
    expect(log[0].rowsWritten).toBe(50);
  });

  it("den se selháním není zeleně; čistě úspěšný den ano", () => {
    const log = deriveChangelog(runs);
    expect(log.find((d) => d.date === "2026-07-28")?.allOk).toBe(false);
    expect(log.find((d) => d.date === "2026-07-30")?.allOk).toBe(true);
  });

  it("deterministické pro týž vstup v jiném pořadí", () => {
    expect(deriveChangelog([...runs].reverse())).toEqual(deriveChangelog(runs));
  });

  it("prázdný vstup → prázdný vlak, žádný vymyšlený den", () => {
    expect(deriveChangelog([])).toEqual([]);
  });
});
