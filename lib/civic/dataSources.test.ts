import { describe, expect, it } from "vitest";
import { SOURCES } from "./data";
import csMessages from "../../messages/cs.json";
import enMessages from "../../messages/en.json";

/**
 * features/landing/components/DataSources.tsx renders SOURCES purely for its
 * length/iteration — every visible string is pulled from the translation
 * catalog by POSITIONAL INDEX (`tc(\`sources.${i}.name\`)`), decoupled from
 * the SOURCES array itself. If a future edit adds/removes/reorders a SOURCES
 * entry without mirroring the exact same change in both message catalogs,
 * card content silently shifts out of alignment (card 4 shows source 5's
 * description) with no error anywhere. This test converts that silent drift
 * into a loud, immediate failure — pin the invariant the component actually
 * depends on.
 */
describe("DataSources index alignment (features/landing/components/DataSources.tsx)", () => {
  it("SOURCES length matches the cs.json sources translation catalog", () => {
    const csSources = (csMessages as { content: { sources: Record<string, unknown> } }).content.sources;
    expect(Object.keys(csSources)).toHaveLength(SOURCES.length);
  });

  it("SOURCES length matches the en.json sources translation catalog", () => {
    const enSources = (enMessages as { content: { sources: Record<string, unknown> } }).content.sources;
    expect(Object.keys(enSources)).toHaveLength(SOURCES.length);
  });

  it("every SOURCES index has a matching key in both catalogs", () => {
    const csSources = (csMessages as { content: { sources: Record<string, unknown> } }).content.sources;
    const enSources = (enMessages as { content: { sources: Record<string, unknown> } }).content.sources;
    for (let i = 0; i < SOURCES.length; i++) {
      expect(csSources[String(i)], `cs.json missing content.sources.${i}`).toBeDefined();
      expect(enSources[String(i)], `en.json missing content.sources.${i}`).toBeDefined();
    }
  });
});
