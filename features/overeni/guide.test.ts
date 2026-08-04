import { describe, expect, it } from "vitest";
import { resolveClaimRef } from "@/lib/claims/registry";
import { edgeClaimRef } from "@/features/shared/provenance/claimRef";
import { detectRef } from "./refDetect";
import { figuraVerdict, verdictHeadlineKey, zdrojVerdict } from "./verdict";
import { buildExamples, GUIDE_EXAMPLES, GUIDE_STEPS } from "./guide";

/** Hrana tak, jak ji vrátí getGuideExample ze store. */
const LIVE = {
  src: "psp:person:346",
  rel: "linked_to",
  dst: "company:ico:26187639",
  ref: edgeClaimRef("psp:person:346", "linked_to", "company:ico:26187639"),
};

describe("návod — příklady zůstávají platné", () => {
  it("každý příklad detekce rozpozná jako deklarovanou rodinu", () => {
    for (const ex of GUIDE_EXAMPLES) {
      const det = detectRef(ex.input);
      expect(det.family, `příklad „${ex.labelKey}"`).toBe(ex.family);
    }
  });

  it("figury z příkladů jsou v rejstříku a projdou bránou jako ověřené", () => {
    const figury = GUIDE_EXAMPLES.filter((ex) => ex.family === "figura");
    expect(figury.length).toBeGreaterThan(0);
    for (const ex of figury) {
      const det = detectRef(ex.input);
      if (det.family !== "figura") throw new Error(`příklad „${ex.labelKey}" není figura`);
      const verdict = figuraVerdict(det, resolveClaimRef(det.ref));
      expect(verdict.kind, `příklad „${ex.labelKey}"`).toBe("verified");
    }
  });

  it("příklad payloadu nese i strojovou hodnotu (porovnává se bajt po bajtu)", () => {
    const payload = GUIDE_EXAMPLES.find((ex) => ex.input.startsWith("<data"));
    expect(payload).toBeDefined();
    const det = detectRef(payload?.input ?? "");
    if (det.family === "figura") {
      expect(det.pasted?.value).not.toBeNull();
    } else {
      throw new Error("payload příklad se nedetekoval jako figura");
    }
  });

  it("živý příklad /zdroj/… se dekóduje zpět na TUTÉŽ hranu a brána ho ověří", () => {
    const ex = buildExamples(LIVE).find((e) => e.family === "zdroj");
    if (!ex) throw new Error("příklad účtenky chybí");
    expect(ex.live).toBe(true);

    // 1) detekce ho pozná jako účtenku a rozluští na přesně tu hranu,
    //    ze které byl postavený — žádná vymyšlená id.
    const det = detectRef(ex.input);
    if (det.family !== "zdroj" || det.ref.kind !== "edge") {
      throw new Error("živý příklad se nedetekoval jako hrana účtenky");
    }
    expect(det.ref).toEqual({ kind: "edge", src: LIVE.src, rel: LIVE.rel, dst: LIVE.dst });

    // 2) brána nad odpovědí loaderu pro TENTO záznam neodpoví „neznámý odkaz".
    const verdict = zdrojVerdict(det.encoded, {
      status: "ok",
      receipt: {
        kind: "edge",
        ref: det.encoded,
        subject: { id: LIVE.src, kind: "person", label: "osoba", citable: null, links: [] },
        rel: LIVE.rel,
        relLabel: "má vazbu na",
        object: { id: LIVE.dst, kind: "company", label: "firma", citable: null, links: [] },
        weight: null,
        provenance: { pass: null, method: null, ref: null, computedAt: null },
        gate: { status: "pending_review", reviewer: null, reviewedAt: null, note: null, audit: [] },
      },
    });
    expect(verdict.kind).toBe("verified");
    expect(verdictHeadlineKey(verdict)).not.toBe("verdict.headlineUnknown");
  });

  it("ilustrační příklad se NEVYDÁVÁ za živý a nezve ke zkopírování", () => {
    for (const ex of buildExamples(null)) {
      if (!ex.live) {
        // Ilustrační příklad se pozná už na KLÍČI — copy to pak říká v obou
        // jazycích (messages.test.ts hlídá, že věta nese slovo o ilustraci).
        expect(ex.noteKey, ex.labelKey).toContain("Illustrative");
        expect(ex.labelKey, ex.labelKey).toContain("Illustrative");
      }
    }
    // Bez store je příklad účtenky ilustrační, nikdy tichý slepý odkaz.
    const zdroj = buildExamples(null).find((e) => e.family === "zdroj");
    expect(zdroj?.live).toBe(false);
  });

  it("kroky návodu jsou čtyři a číslované vzestupně", () => {
    expect(GUIDE_STEPS.map((s) => s.no)).toEqual([1, 2, 3, 4]);
    for (const step of GUIDE_STEPS) {
      expect(step.titleKey).toBe(`guide.step${step.no}Title`);
      expect(step.bodyKey).toBe(`guide.step${step.no}Body`);
    }
  });
});
