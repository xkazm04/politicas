// Kolizní radar — pins the feed serializations (moonshot 4B): guid/permalink
// stability (a public API: `politicas:radar:<id>` → `/zakony/kolize#r-<id>`),
// RSS structure with honest pubDate omission for undated entries, XML escaping,
// and the JSON Feed round-trip through the SHARED strict parser
// (parseEvidenceFeedJson — one format across dukazy/denik/radar).

import { describe, expect, it } from "vitest";
import type { RadarEntry } from "./deriveRadar";
import {
  RADAR_FEED_TITLE,
  parseEvidenceFeedJson,
  radarEntryGuid,
  radarEntrySummaryCs,
  radarEntryUrl,
  radarFeedToJson,
  radarFeedToRss,
} from "./radarFeedCodecs";

const entry = (over: Partial<RadarEntry>): RadarEntry => ({
  id: "kolize-586-1992-35ba-120-244",
  anchor: "r-kolize-586-1992-35ba-120-244",
  kind: "kolize",
  detectedAt: "2026-07-24T19:27:59.819Z",
  titleCs: "tisk 120 × tisk 244 — § 35ba odst. 1, zákon č. 586/1992 Sb.",
  detailCs: "Dva souběžně projednávané tisky novelizují § 35ba odst. 1 zákona č. 586/1992 Sb. (potvrzená kolize textu). Nález legislativního procesu, ne etický nález.",
  sourceCs: "zdroj: deterministická §-předkontrola + ruční porovnání textů, dávka 3",
  authorCs: "case ③ — legislativní forenzika",
  lawRef: "586/1992",
  lawTitle: null,
  paragraph: "35ba odst. 1",
  bills: [120, 244],
  clusterAnchor: "k-586-1992-35ba",
  requiresVerification: false,
  ...over,
});

const CTX = { baseUrl: "https://politicas.example", generatedAt: "2026-07-30T12:00:00.000Z" };

describe("permalink primitives", () => {
  it("guid is namespaced and the url targets the #r-<id> anchor on /zakony/kolize", () => {
    const e = entry({});
    expect(radarEntryGuid(e)).toBe("politicas:radar:kolize-586-1992-35ba-120-244");
    expect(radarEntryUrl(CTX.baseUrl, e)).toBe(
      "https://politicas.example/zakony/kolize#r-kolize-586-1992-35ba-120-244",
    );
  });

  it("summary speaks the gated sentence and cites the source", () => {
    const s = radarEntrySummaryCs(entry({}));
    expect(s).toContain("Nález legislativního procesu");
    expect(s).toContain("zdroj: deterministická §-předkontrola");
  });
});

describe("RSS codec", () => {
  it("emits one item per entry with stable non-permalink guids and cs language", () => {
    const xml = radarFeedToRss([entry({}), entry({ id: "priznak-77", anchor: "r-priznak-77", kind: "priznak", detectedAt: null })], CTX);
    expect(xml.match(/<item>/g)?.length).toBe(2);
    expect(xml).toContain('<guid isPermaLink="false">politicas:radar:kolize-586-1992-35ba-120-244</guid>');
    expect(xml).toContain("<link>https://politicas.example/zakony/kolize#r-priznak-77</link>");
    expect(xml).toContain("<language>cs</language>");
    expect(xml).toContain("<pubDate>Fri, 24 Jul 2026 19:27:59 GMT</pubDate>");
  });

  it("omits pubDate for undated entries instead of inventing a date", () => {
    const xml = radarFeedToRss([entry({ detectedAt: null })], CTX);
    expect(xml).not.toContain("<pubDate>");
    expect(xml).toContain("<lastBuildDate>"); // channel date still present
  });

  it("escapes XML-hostile copy instead of breaking the document", () => {
    const xml = radarFeedToRss([entry({ titleCs: 'tisk 1 & tisk 2 — <§ "x">' })], CTX);
    expect(xml).toContain("tisk 1 &amp; tisk 2 — &lt;§ &quot;x&quot;&gt;");
    expect(xml).not.toContain('<§ "x">');
  });
});

describe("JSON Feed codec", () => {
  it("round-trips through the shared strict parser with ids, urls and titles intact", () => {
    const entries = [entry({}), entry({ id: "priznak-77", anchor: "r-priznak-77", kind: "priznak", detectedAt: null, authorCs: "case ① — majetkové vazby" })];
    const parsed = parseEvidenceFeedJson(radarFeedToJson(entries, CTX));
    expect(parsed.title).toBe(RADAR_FEED_TITLE);
    expect(parsed.home_page_url).toBe("https://politicas.example/zakony/kolize");
    expect(parsed.feed_url).toBe("https://politicas.example/zakony/kolize/feed.json");
    expect(parsed.language).toBe("cs");
    expect(parsed.items.map((i) => i.id)).toEqual([
      "politicas:radar:kolize-586-1992-35ba-120-244",
      "politicas:radar:priznak-77",
    ]);
    expect(parsed.items[0].url).toBe(radarEntryUrl(CTX.baseUrl, entries[0]));
    expect(parsed.items[0].date_published).toBe("2026-07-24T19:27:59.819Z");
    expect(parsed.items[1].date_published).toBe(""); // undated stays honestly empty
    expect(parsed.items[1].authors).toEqual([{ name: "case ① — majetkové vazby" }]);
    expect(parsed.items[0].content_text).toBe(radarEntrySummaryCs(entries[0]));
  });
});
