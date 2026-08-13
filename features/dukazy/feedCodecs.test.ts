// Deník důkazů — pins the feed serializations (batch 2C): guid/permalink
// stability (a public API), XML escaping, RSS structure, and the JSON Feed
// round-trip through the strict parser.

import { describe, expect, it } from "vitest";
import { formatInt } from "@/lib/format";
import type { EvidenceEntry } from "./deriveFeed";
import {
  FEED_DESCRIPTION,
  dukazyFeedDescription,
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
  chainPos: 7,
  rowHash: "b1946ac92492d2347c6235b4d2611184",
  receiptHref: "/zdroj/h.cHNwOnBlcnNvbjo2NTQz.bGlua2VkX3Rv.a2c6Y29tcGFueTowNDU0NDE1Mg",
  companyHref: "/penize/firma/04544152",
  sourceCs: "zdroj: review_audit · kg_edge linked_to",
  ...over,
});

const CTX = {
  baseUrl: "https://politicas.example",
  generatedAt: "2026-07-30T12:00:00.000Z",
  auditCap: 10_000,
};

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

/* ── popis kanálu přestal tvrdit absolutno ──────────────────────────────────── */

describe("popis kanálu — žádné absolutno nad useknutelným čtením", () => {
  it("základní popis netvrdí „každé rozhodnutí“ ani „každý posudek“", () => {
    expect(FEED_DESCRIPTION).not.toMatch(/každé rozhodnutí/);
    expect(FEED_DESCRIPTION).not.toMatch(/každý podepsaný/);
  });

  it("popis vyslovuje strop, se kterým se deník brány čte — z hodnoty, ne z literálu", () => {
    const cap = formatInt(10_000, "cs");
    expect(dukazyFeedDescription(10_000)).toContain(cap);
    expect(dukazyFeedDescription(25)).toContain("25");
    expect(dukazyFeedDescription(25)).not.toContain(cap);
  });

  it("obě podoby nesou strop a přilepené upozornění", () => {
    const notice = "Upozornění k tomuto vydání: test.";
    const cap = formatInt(10_000, "cs");
    const xml = evidenceFeedToRss([entry({})], { ...CTX, notice });
    expect(xml).toContain(cap);
    expect(xml).toContain("Upozornění k tomuto vydání: test.");

    const feed = parseEvidenceFeedJson(evidenceFeedToJson([entry({})], { ...CTX, notice }));
    expect(feed.description).toContain(cap);
    expect(feed.description).toContain("Upozornění k tomuto vydání: test.");
  });

  it("bez upozornění zůstává popis holý (mlčení = nic se neztratilo)", () => {
    const feed = parseEvidenceFeedJson(evidenceFeedToJson([entry({})], CTX));
    expect(feed.description).toBe(dukazyFeedDescription(10_000));
  });
});

/* ── řetěz a účtenka v obou strojových podobách ─────────────────────────────── */

describe("položka feedu nese, čím se dá rozhodnutí ověřit", () => {
  it("shrnutí nese pozici v řetězu, otisk řádku a absolutní adresu účtenky", () => {
    const s = entrySummaryCs(entry({}), CTX.baseUrl);
    expect(s).toContain("pozice 7");
    expect(s).toContain("b1946ac92492d2347c6235b4d2611184");
    expect(s).toContain(`${CTX.baseUrl}/zdroj/`);
  });

  it("nezřetězený řádek to ŘEKNE, místo aby si pozici vymyslel", () => {
    const s = entrySummaryCs(entry({ chainPos: null, rowHash: null }), CTX.baseUrl);
    expect(s).not.toContain("pozice");
    expect(s).toMatch(/před jeho zavedením/);
  });

  it("záznam bez kanonické účtenky odkaz nenese", () => {
    const s = entrySummaryCs(entry({ receiptHref: null }), CTX.baseUrl);
    expect(s).not.toContain("účtenka:");
  });

  it("podepsaný posudek o řetězu nic netvrdí — v review_audit není", () => {
    const s = entrySummaryCs(
      entry({ kind: "forensic", chainPos: null, rowHash: null, receiptHref: null }),
      CTX.baseUrl,
    );
    expect(s).not.toContain("řetěz brány");
  });

  it("obě podoby publikují týž řetěz a touž účtenku", () => {
    const xml = evidenceFeedToRss([entry({})], CTX);
    const feed = parseEvidenceFeedJson(evidenceFeedToJson([entry({})], CTX));
    expect(xml).toContain("b1946ac92492d2347c6235b4d2611184");
    expect(feed.items[0].content_text).toContain("b1946ac92492d2347c6235b4d2611184");
    expect(feed.items[0].content_text).toContain("pozice 7");
  });
});
