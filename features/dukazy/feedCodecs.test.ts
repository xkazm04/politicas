// Deník důkazů — pins the feed serializations (batch 2C): guid/permalink
// stability (a public API), XML escaping, RSS structure, and the JSON Feed
// round-trip through the strict parser.

import { describe, expect, it } from "vitest";
import type { EvidenceEntry } from "./deriveFeed";
import {
  entryGuid,
  entrySummaryCs,
  entryUrl,
  evidenceFeedToJson,
  evidenceFeedToRss,
  parseEvidenceFeedJson,
} from "./feedCodecs";

const entry = (over: Partial<EvidenceEntry>): EvidenceEntry => ({
  id: "a1",
  anchor: "z-a1",
  kind: "tie",
  decision: "confirm",
  decisionCs: "vazba ověřena",
  decidedAt: "2026-07-20T10:00:00.000Z",
  subjectCs: "Jan Novák ↔ Alfa s.r.o.",
  reviewer: "recenzent",
  priorState: "pending_review",
  links: [{ label: "ARES VR", href: "https://ares.gov.cz/x?ico=1&b=2" }],
  internalHref: "/poslanec/6543",
  sourceCs: "zdroj: review_audit · kg_edge linked_to",
  ...over,
});

const CTX = { baseUrl: "https://politicas.example", generatedAt: "2026-07-30T12:00:00.000Z" };

describe("permalink primitives", () => {
  it("guid is namespaced and the url targets the #z-<id> anchor", () => {
    const e = entry({});
    expect(entryGuid(e)).toBe("politicas:dukazy:a1");
    expect(entryUrl(CTX.baseUrl, e)).toBe("https://politicas.example/dukazy#z-a1");
  });

  it("summary speaks gated copy and cites the source", () => {
    const s = entrySummaryCs(entry({}));
    expect(s).toContain("vazba ověřena");
    expect(s).toContain("předchozí stav: pending_review");
    expect(s).toContain("zdroj: review_audit");
  });
});

describe("RSS codec", () => {
  it("emits one item per entry with stable non-permalink guids", () => {
    const xml = evidenceFeedToRss([entry({ id: "a1", anchor: "z-a1" }), entry({ id: "b2", anchor: "z-b2" })], CTX);
    expect(xml.match(/<item>/g)?.length).toBe(2);
    expect(xml).toContain('<guid isPermaLink="false">politicas:dukazy:a1</guid>');
    expect(xml).toContain("<link>https://politicas.example/dukazy#z-b2</link>");
    expect(xml).toContain("<language>cs</language>");
    expect(xml).toContain("<pubDate>Mon, 20 Jul 2026 10:00:00 GMT</pubDate>");
  });

  it("escapes XML-hostile subjects instead of breaking the document", () => {
    const xml = evidenceFeedToRss(
      [entry({ subjectCs: `Novák & synové <s.r.o.> "uvozovky"` })],
      CTX,
    );
    expect(xml).toContain("Novák &amp; synové &lt;s.r.o.&gt; &quot;uvozovky&quot;");
    expect(xml).not.toContain("<s.r.o.>");
  });

  it("omits pubDate for an unparseable timestamp rather than publishing a wrong one", () => {
    const xml = evidenceFeedToRss([entry({ decidedAt: "" })], CTX);
    expect(xml).not.toContain("<pubDate>");
  });

  it("renders an honest empty channel for an empty journal", () => {
    const xml = evidenceFeedToRss([], CTX);
    expect(xml).toContain("<channel>");
    expect(xml).not.toContain("<item>");
  });
});

describe("JSON codec — round-trip", () => {
  it("serialize → parse preserves ids, urls, titles, dates and authors", () => {
    const entries = [entry({ id: "a1", anchor: "z-a1" }), entry({ id: "tisk-812", anchor: "z-tisk-812", kind: "forensic" })];
    const feed = parseEvidenceFeedJson(evidenceFeedToJson(entries, CTX));
    expect(feed.version).toBe("https://jsonfeed.org/version/1.1");
    expect(feed.home_page_url).toBe("https://politicas.example/dukazy");
    expect(feed.feed_url).toBe("https://politicas.example/dukazy/feed.json");
    expect(feed.items.map((i) => i.id)).toEqual(["politicas:dukazy:a1", "politicas:dukazy:tisk-812"]);
    expect(feed.items[0].url).toBe("https://politicas.example/dukazy#z-a1");
    expect(feed.items[0].date_published).toBe("2026-07-20T10:00:00.000Z");
    expect(feed.items[0].authors).toEqual([{ name: "recenzent" }]);
    expect(feed.items[0].external_url).toBe("https://ares.gov.cz/x?ico=1&b=2");
  });

  it("omits external_url when the entry has no registry links", () => {
    const feed = parseEvidenceFeedJson(evidenceFeedToJson([entry({ links: [] })], CTX));
    expect(feed.items[0].external_url).toBeUndefined();
  });

  it("the parser rejects payloads that are not a politicas evidence feed", () => {
    expect(() => parseEvidenceFeedJson("[]")).toThrow();
    expect(() => parseEvidenceFeedJson(JSON.stringify({ version: "https://jsonfeed.org/version/1.1" }))).toThrow();
    expect(() =>
      parseEvidenceFeedJson(
        JSON.stringify({
          version: "https://jsonfeed.org/version/1.1",
          title: "x",
          home_page_url: "y",
          feed_url: "z",
          items: [{ id: 1 }],
        }),
      ),
    ).toThrow();
  });

  it("never serializes anything but gated fields (no reviewer notes key)", () => {
    const json = evidenceFeedToJson([entry({})], CTX);
    expect(json).not.toContain('"note"');
    expect(json).not.toContain("priorState"); // internal field name stays internal
  });
});
