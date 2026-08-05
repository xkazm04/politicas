// Invarianty batch-014 census loaderu pro sekci „Závislosti na doprovodných
// tiscích" (/zakony). `server-only` je pod vitestem stub (viz vitest.config.ts),
// takže getDependencyData() lze volat přímo nad REÁLNÝMI payloady v
// docs/data-analysis/case-law/payloads — testy hlídají pravidla (výběr
// úryvku, slabý-důkaz pravidlo, M18 dedup), ne obsah payloadu samotný, ale
// (e) navíc pinuje i dnešní reálné počty, protože batch-015-audit.md je cituje
// jmenovitě a jejich tichá změna by měla test rozbít.
//
// Čistá jádra (buildDependencyView, resolveCompanionLink) žijí v
// ./buildDependencyView.ts bez "server-only" importu — stejný střih jako
// deriveRadar.ts — a testují se i samostatně na syntetických fixture, aby
// dedup a link-rozhodnutí nezávisely na dnešním obsahu korpusu.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { gate, getDependencyData } from "./getDependencyData";
import {
  buildDependencyView,
  resolveCompanionLink,
  type GateFn,
  type RawTriagePayload,
} from "./buildDependencyView";

const TRIAGE_FILE = "docs/data-analysis/case-law/payloads/batch-014-dependency-triage.json";
const CENSUS_FILE = "docs/data-analysis/case-law/payloads/batch-014-dependency-census.json";

/** Same placeholder shape the loader anchors excerpts on — duplicated here
 * (not imported) so this test validates the RAW DATA independent of the
 * loader's own excerpt-cutting implementation. */
const PLACEHOLDER_RE = /(?:…|\.\.\.)\s*\/\s*\d{4}\s*Sb\b/;

/** Identity gate for synthetic fixtures below — no Czech/jargon check, so
 * dedup/link tests aren't coupled to lib/analysis. */
const passthroughGate: GateFn = (v) => (typeof v === "string" && v.length > 0 ? v : null);

describe("getDependencyData — reálné payloady", () => {
  const data = getDependencyData();

  it("(e) počty odpovídají batch-014 payloadu: 18 companion / 23 unclear / 67 celkem", () => {
    expect(data).not.toBeNull();
    expect(data!.companionCount).toBe(18);
    expect(data!.unclearCount).toBe(23);
    expect(data!.totalTriaged).toBe(67);
    expect(data!.selfReferenceCount).toBe(26);
    expect(data!.withheldHitCount).toBe(0);
    expect(data!.misalignedDroppedCount).toBe(0);
  });

  it("(d) M18 dedup: 18 companion hitů se sbalí na 10 řádků (batch-015-audit.md M18 — 10 distinct pairs)", () => {
    // dedupedRowCount is the disclosed post-dedup row count, and must equal
    // the number of rows actually rendered (sum of one row per bills[].hits).
    const renderedRows = data!.bills.reduce((n, b) => n + b.hits.length, 0);
    expect(data!.dedupedRowCount).toBe(10);
    expect(renderedRows).toBe(10);
    // every raw companion_dependency hit is accounted for exactly once across
    // the deduped rows' dupeCount — none silently dropped, none double-kept.
    const totalDupeCount = data!.bills.reduce((n, b) => n + b.hits.reduce((m, h) => m + h.dupeCount, 0), 0);
    expect(totalDupeCount).toBe(18);
  });

  it("tisk 153 collapses its six byte-identical companion hits into one row with dupeCount 6", () => {
    const bill153 = data!.bills.find((b) => b.cislo === 153);
    expect(bill153).toBeDefined();
    expect(bill153!.hits).toHaveLength(1);
    expect(bill153!.hits[0].dupeCount).toBe(6);
    expect(bill153!.hits[0].likelyCompanionTisk).toBe(69);
  });

  it("tisky 210, 53 a 64 collapse their two hits each into dupeCount 2", () => {
    for (const cislo of [210, 53, 64]) {
      const bill = data!.bills.find((b) => b.cislo === cislo);
      expect(bill, `tisk ${cislo}`).toBeDefined();
      expect(bill!.hits, `tisk ${cislo}`).toHaveLength(1);
      expect(bill!.hits[0].dupeCount, `tisk ${cislo}`).toBe(2);
    }
  });

  it("(b) slabý důkaz odpojuje POUZE 250→62 (batch-015-audit.md B11)", () => {
    const weakHits = data!.bills.flatMap((b) => b.hits.filter((h) => h.weakEvidence).map((h) => ({ cislo: b.cislo, h })));
    expect(weakHits).toHaveLength(1);
    expect(weakHits[0].cislo).toBe(250);
    expect(weakHits[0].h.likelyCompanionTisk).toBeNull();
    expect(weakHits[0].h.companionSubject).toContain("62");
    // every other companion hit keeps its numeric tisk (none accidentally unlinked)
    const otherHits = data!.bills.flatMap((b) => b.hits.filter((h) => !h.weakEvidence));
    expect(otherHits.length).toBeGreaterThan(0);
    for (const h of otherHits) {
      expect(h.companionSubject).not.toBeNull();
    }
  });

  it("(a) all 18 raw companion-dependency excerpts contain the placeholder, in both … and ... forms", () => {
    const triage = JSON.parse(readFileSync(TRIAGE_FILE, "utf8")) as {
      bills: { cislo: number; hits: { class: string; context?: string }[] }[];
    };
    const census = JSON.parse(readFileSync(CENSUS_FILE, "utf8")) as {
      rows: { cislo: number; hits: { context?: string }[] }[];
    };
    const censusByCislo = new Map(census.rows.map((r) => [r.cislo, r.hits]));

    let checked = 0;
    let ellipsisGlyphCount = 0;
    let tripleDotCount = 0;
    for (const b of triage.bills) {
      const censusHits = censusByCislo.get(b.cislo);
      b.hits.forEach((h, i) => {
        if (h.class !== "companion_dependency") return;
        checked++;
        const ctx = (censusHits && censusHits[i]?.context) ?? h.context;
        expect(ctx, `tisk ${b.cislo} hit ${i}`).toBeTruthy();
        const m = PLACEHOLDER_RE.exec(ctx!);
        expect(m, `tisk ${b.cislo} hit ${i}: "${ctx}"`).not.toBeNull();
        if (m![0].includes("…")) ellipsisGlyphCount++;
        if (m![0].includes("...")) tripleDotCount++;
      });
    }
    expect(checked).toBe(18);
    expect(ellipsisGlyphCount).toBeGreaterThan(0);
    expect(tripleDotCount).toBeGreaterThan(0);
  });

  it("(c) a real out-of-corpus companion (tisk 777 on bill 206) resolves unlinked", () => {
    const bill206 = data!.bills.find((b) => b.cislo === 206);
    expect(bill206).toBeDefined();
    expect(bill206!.hits[0].likelyCompanionTisk).toBe(777);
    const corpusWithout777 = (t: number) => t !== 777;
    const link = resolveCompanionLink(bill206!.hits[0].likelyCompanionTisk, corpusWithout777);
    expect(link).toEqual({ kind: "out-of-corpus", tisk: 777 });
  });
});

describe("resolveCompanionLink — pure link decision (batch-015-audit.md M17)", () => {
  it("(c) a companion tisk absent from the corpus resolves out-of-corpus, not linked", () => {
    const link = resolveCompanionLink(777, () => false);
    expect(link).toEqual({ kind: "out-of-corpus", tisk: 777 });
  });

  it("a companion tisk present in the corpus resolves linked", () => {
    const link = resolveCompanionLink(69, () => true);
    expect(link).toEqual({ kind: "linked", tisk: 69 });
  });

  it("no companion tisk (null) resolves to none, regardless of the corpus check", () => {
    expect(resolveCompanionLink(null, () => true)).toEqual({ kind: "none" });
    expect(resolveCompanionLink(null, () => false)).toEqual({ kind: "none" });
  });
});

describe("buildDependencyView — pure dedup + shaping (synthetic fixtures)", () => {
  const payload = (bills: RawTriagePayload["bills"], counts?: RawTriagePayload["counts"]): RawTriagePayload => ({
    generatedAt: "2026-08-05T00:00:00.000Z",
    counts: counts ?? { self_reference: 0, companion_dependency: 0, unclear: 0 },
    bills,
  });

  it("(d) two hits in one bill sharing tisk + subject + weakEvidence collapse into one row, keeping the longer excerpt", () => {
    const raw = payload([
      {
        cislo: 1,
        hits: [
          { class: "companion_dependency", context: "short …/2026 Sb. ctx", companionSubject: "zákon X (tisk 9)", likelyCompanionTisk: 9 },
          {
            class: "companion_dependency",
            context: "a much longer surrounding excerpt around the …/2026 Sb. placeholder that carries more of the sentence",
            companionSubject: "zákon X (tisk 9)",
            likelyCompanionTisk: 9,
          },
        ],
      },
    ]);
    const view = buildDependencyView(raw, new Map(), passthroughGate);
    expect(view).not.toBeNull();
    expect(view!.bills).toHaveLength(1);
    expect(view!.bills[0].hits).toHaveLength(1);
    expect(view!.bills[0].hits[0].dupeCount).toBe(2);
    expect(view!.bills[0].hits[0].context).toContain("much longer surrounding excerpt");
    expect(view!.dedupedRowCount).toBe(1);
  });

  it("hits with the same subject but a DIFFERENT companion tisk do NOT collapse", () => {
    const raw = payload([
      {
        cislo: 1,
        hits: [
          { class: "companion_dependency", context: "ctx a …/2026 Sb.", companionSubject: "zákon X", likelyCompanionTisk: 9 },
          { class: "companion_dependency", context: "ctx b …/2026 Sb.", companionSubject: "zákon X", likelyCompanionTisk: 10 },
        ],
      },
    ]);
    const view = buildDependencyView(raw, new Map(), passthroughGate);
    expect(view!.bills[0].hits).toHaveLength(2);
    expect(view!.bills[0].hits.every((h) => h.dupeCount === 1)).toBe(true);
  });

  it("hits across DIFFERENT bills never collapse into each other", () => {
    const raw = payload([
      { cislo: 1, hits: [{ class: "companion_dependency", context: "ctx …/2026 Sb.", companionSubject: "zákon X", likelyCompanionTisk: 9 }] },
      { cislo: 2, hits: [{ class: "companion_dependency", context: "ctx …/2026 Sb.", companionSubject: "zákon X", likelyCompanionTisk: 9 }] },
    ]);
    const view = buildDependencyView(raw, new Map(), passthroughGate);
    expect(view!.bills).toHaveLength(2);
    expect(view!.bills[0].hits[0].dupeCount).toBe(1);
    expect(view!.bills[1].hits[0].dupeCount).toBe(1);
    expect(view!.dedupedRowCount).toBe(2);
  });

  it("(b) weak-evidence phrasing nulls likelyCompanionTisk even though the payload carries a number", () => {
    const raw = payload([
      {
        cislo: 1,
        hits: [
          {
            class: "companion_dependency",
            context: "ctx …/2026 Sb.",
            companionSubject: "možná tisk 62, ale bez explicitní textové vazby",
            likelyCompanionTisk: 62,
          },
        ],
      },
    ]);
    const view = buildDependencyView(raw, new Map(), passthroughGate);
    const hit = view!.bills[0].hits[0];
    expect(hit.weakEvidence).toBe(true);
    expect(hit.likelyCompanionTisk).toBeNull();
  });

  it("(e) companionCount/unclearCount/totalTriaged are read verbatim from payload.counts, independent of dedup", () => {
    const raw = payload(
      [
        {
          cislo: 1,
          hits: [
            { class: "companion_dependency", context: "ctx a …/2026 Sb.", companionSubject: "zákon X", likelyCompanionTisk: 9 },
            { class: "companion_dependency", context: "ctx b …/2026 Sb.", companionSubject: "zákon X", likelyCompanionTisk: 9 },
          ],
        },
      ],
      { self_reference: 5, companion_dependency: 2, unclear: 3 },
    );
    const view = buildDependencyView(raw, new Map(), passthroughGate);
    expect(view!.companionCount).toBe(2); // raw hit count, unaffected by dedup
    expect(view!.unclearCount).toBe(3);
    expect(view!.totalTriaged).toBe(10);
    expect(view!.dedupedRowCount).toBe(1); // the two hits collapsed into one row
  });

  it("a hit failing the gate on both fields is withheld and counted, never rendered or dedup-eligible", () => {
    const failGate: GateFn = () => null;
    const raw = payload([
      { cislo: 1, hits: [{ class: "companion_dependency", context: "ctx", companionSubject: "sub", likelyCompanionTisk: 9 }] },
    ]);
    const view = buildDependencyView(raw, new Map(), failGate);
    expect(view).toBeNull(); // no bills survive -> whole view withheld to null, same as loader's own null-on-empty contract
  });

  it("returns null when the payload carries no bills", () => {
    expect(buildDependencyView(payload([]), new Map(), passthroughGate)).toBeNull();
  });

  it("(M12) a bill present in both payloads whose hit counts DISAGREE is dropped wholesale, not mis-paired", () => {
    const raw = payload([
      {
        cislo: 1,
        hits: [
          { class: "companion_dependency", context: "ctx a …/2026 Sb.", companionSubject: "zákon X", likelyCompanionTisk: 9 },
          { class: "companion_dependency", context: "ctx b …/2026 Sb.", companionSubject: "zákon Y", likelyCompanionTisk: 10 },
        ],
      },
      {
        cislo: 2,
        hits: [{ class: "companion_dependency", context: "ctx c …/2026 Sb.", companionSubject: "zákon Z", likelyCompanionTisk: 11 }],
      },
    ]);
    // bill 1's triage payload carries 2 hits; its census entry carries only 1
    // — a genuine count disagreement, not mere absence of census coverage.
    const censusByCislo = new Map([
      [1, ["only one census context"]],
      [2, ["ctx c …/2026 Sb. census version"]],
    ]);
    const view = buildDependencyView(raw, censusByCislo, passthroughGate);
    expect(view).not.toBeNull();
    // bill 1 is dropped entirely — no row, not even a mis-paired one.
    expect(view!.bills.find((b) => b.cislo === 1)).toBeUndefined();
    // bill 2 (aligned: 1 triage hit, 1 census hit) still renders normally.
    expect(view!.bills.find((b) => b.cislo === 2)).toBeDefined();
    expect(view!.misalignedDroppedCount).toBe(2);
    expect(view!.dedupedRowCount).toBe(1);
  });

  it("(M12) a bill ABSENT from the census payload (no entry at all) is NOT treated as a disagreement — it falls back to the triage context", () => {
    const raw = payload([
      { cislo: 1, hits: [{ class: "companion_dependency", context: "triage-only ctx …/2026 Sb.", companionSubject: "zákon X", likelyCompanionTisk: 9 }] },
    ]);
    const view = buildDependencyView(raw, new Map(), passthroughGate); // no census entry for cislo 1 at all
    expect(view!.misalignedDroppedCount).toBe(0);
    expect(view!.bills[0].hits[0].context).toBe("triage-only ctx …/2026 Sb.");
  });
});

describe("buildDependencyView — through the REAL gate (batch-016-audit.md M13/M14/M15)", () => {
  const payload = (bills: RawTriagePayload["bills"], counts?: RawTriagePayload["counts"]): RawTriagePayload => ({
    generatedAt: "2026-08-05T00:00:00.000Z",
    counts: counts ?? { self_reference: 0, companion_dependency: 0, unclear: 0 },
    bills,
  });

  it("(M13) representative-row selection picks the RICHER raw excerpt even when both TRUNCATE to the same rendered length", () => {
    // Both raw strings exceed CONTEXT_MAX_CHARS (220) by enough margin that the
    // real `gate("excerpt")` truncation produces the SAME rendered length for
    // both — reproducing exactly the tie batch-016-audit.md M13 found on the
    // live payload (153: 221×5 + 220; 210/53/64: 221,221). Comparing that
    // GATED length (the old code) can never discriminate; comparing the RAW
    // pre-truncation length (the fix) correctly prefers the richer source.
    const shortRaw = `${"x".repeat(150)} MARKERA …/2026 Sb. tail ${"y".repeat(100)}`;
    const longRaw = `${"x".repeat(400)} MARKERB …/2026 Sb. tail ${"y".repeat(300)}`;

    const gatedShort = gate(shortRaw, "excerpt");
    const gatedLong = gate(longRaw, "excerpt");
    expect(gatedShort).not.toBeNull();
    expect(gatedLong).not.toBeNull();
    // sanity: the fixture really does reproduce the M13 tie condition.
    expect(gatedShort!.length).toBe(gatedLong!.length);
    expect(gatedShort).not.toBe(gatedLong);
    expect(shortRaw.length).toBeLessThan(longRaw.length);

    const raw = payload([
      {
        cislo: 1,
        hits: [
          { class: "companion_dependency", context: shortRaw, companionSubject: "zákon o digitální ekonomice (tisk 69)", likelyCompanionTisk: 69 },
          { class: "companion_dependency", context: longRaw, companionSubject: "zákon o digitální ekonomice (tisk 69)", likelyCompanionTisk: 69 },
        ],
      },
    ]);
    const view = buildDependencyView(raw, new Map(), gate);
    expect(view!.bills[0].hits).toHaveLength(1);
    expect(view!.bills[0].hits[0].dupeCount).toBe(2);
    // the OLD code, comparing tied gated lengths, always kept group[0]
    // (the shortRaw/MARKERA hit) — this fixture would fail under it.
    expect(view!.bills[0].hits[0].context).toContain("MARKERB");
    expect(view!.bills[0].hits[0].context).not.toContain("MARKERA");
  });

  it("(M14) two hits naming DIFFERENT companions do not collapse just because both subjects fail the Czech gate", () => {
    const czechContext = "toto ustanovení odkazuje na zákona č. …/2026 Sb., blíže neurčeno";
    // Deliberately English (fails isCzechSafe) so companionSubject renders
    // null and likelyCompanionTisk is nulled by the render-layer rule — the
    // exact condition M14 found colliding under the OLD (rendered-field) key.
    const englishSubjectA = "the companion bill without further evidence of a textual link";
    const englishSubjectB = "another related act with no explicit textual connection stated";
    const raw = payload([
      {
        cislo: 1,
        hits: [
          { class: "companion_dependency", context: czechContext, companionSubject: englishSubjectA, likelyCompanionTisk: 11 },
          { class: "companion_dependency", context: czechContext, companionSubject: englishSubjectB, likelyCompanionTisk: 12 },
        ],
      },
    ]);
    const view = buildDependencyView(raw, new Map(), gate);
    // sanity: both subjects really do fail the gate (both render null).
    expect(view!.bills[0].hits.every((h) => h.companionSubject === null)).toBe(true);
    expect(view!.bills[0].hits.every((h) => h.likelyCompanionTisk === null)).toBe(true);
    // the OLD key ([null, null, false] for both) would have collapsed these
    // into one row asserting "one dependency counted twice" — they must not.
    expect(view!.bills[0].hits).toHaveLength(2);
    expect(view!.bills[0].hits.every((h) => h.dupeCount === 1)).toBe(true);
  });

  it("(M15) weakEvidence is detected on the RAW subject even when the hedge phrase falls past the 220-char truncation cutoff", () => {
    const czechContext = "toto ustanovení odkazuje na zákona č. …/2026 Sb., blíže neurčeno";
    // Padding pushes the hedge phrase well past CONTEXT_MAX_CHARS (220); the
    // padding itself must stay Czech-safe and jargon-free so the subject as a
    // whole still clears the gate.
    const padding = "tisk ".repeat(60); // 300 Czech-safe chars
    const hedgeSuffix =
      "souběžná novela zákona č. 87/2023 Sb. o dozoru nad trhem s výrobky — možná tisk 62, ale bez explicitní textové vazby";
    const longHedgedSubject = `${padding}${hedgeSuffix}`;
    expect(longHedgedSubject.length).toBeGreaterThan(220);
    expect(longHedgedSubject.indexOf("bez explicitní textové vazby")).toBeGreaterThan(220);

    const raw = payload([
      {
        cislo: 1,
        hits: [{ class: "companion_dependency", context: czechContext, companionSubject: longHedgedSubject, likelyCompanionTisk: 62 }],
      },
    ]);
    const view = buildDependencyView(raw, new Map(), gate);
    const hit = view!.bills[0].hits[0];
    // sanity: the RENDERED (gated, truncated) subject really does cut the
    // hedge off — proving this fixture would have fooled the OLD code, which
    // tested WEAK_EVIDENCE_RE against that truncated string.
    const renderedSubject = gate(longHedgedSubject, "prose");
    expect(renderedSubject).not.toBeNull();
    expect(renderedSubject!).not.toMatch(/bez\s+explicitn[ěí]\s+textov[ěé]\s+vazby/i);
    // the loader must still detect the hedge and unlink the companion tisk.
    expect(hit.weakEvidence).toBe(true);
    expect(hit.likelyCompanionTisk).toBeNull();
  });
});
