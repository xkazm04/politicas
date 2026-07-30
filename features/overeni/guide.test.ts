import { describe, expect, it } from "vitest";
import { resolveClaimRef } from "@/lib/claims/registry";
import { detectRef } from "./refDetect";
import { figuraVerdict } from "./verdict";
import { GUIDE_EXAMPLES, GUIDE_STEPS } from "./guide";

describe("návod — příklady zůstávají platné", () => {
  it("každý příklad detekce rozpozná jako deklarovanou rodinu", () => {
    for (const ex of GUIDE_EXAMPLES) {
      const det = detectRef(ex.input);
      expect(det.family, `příklad „${ex.label}"`).toBe(ex.family);
    }
  });

  it("figury z příkladů jsou v rejstříku a projdou bránou jako ověřené", () => {
    const figury = GUIDE_EXAMPLES.filter((ex) => ex.family === "figura");
    expect(figury.length).toBeGreaterThan(0);
    for (const ex of figury) {
      const det = detectRef(ex.input);
      if (det.family !== "figura") throw new Error(`příklad „${ex.label}" není figura`);
      const verdict = figuraVerdict(det, resolveClaimRef(det.ref));
      expect(verdict.kind, `příklad „${ex.label}"`).toBe("verified");
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

  it("kroky návodu jsou čtyři a číslované vzestupně", () => {
    expect(GUIDE_STEPS.map((s) => s.no)).toEqual([1, 2, 3, 4]);
    for (const step of GUIDE_STEPS) {
      expect(step.title.length).toBeGreaterThan(0);
      expect(step.body.length).toBeGreaterThan(0);
    }
  });
});
