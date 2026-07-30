// Deník republiky — přibití strojových podob (moonshot 3A): stabilita guid a
// kotvy dne (veřejné API), XML escaping, RSS struktura a JSON round-trip přes
// SDÍLENÝ validátor Deníku důkazů (`parseEvidenceFeedJson`) — jeden formát,
// jeden čtecí kód pro oba deníky.

import { describe, expect, it } from "vitest";
import type { DenikEntry } from "./deriveDenik";
import {
  DENIK_FEED_TITLE,
  denikEntryGuid,
  denikEntrySummaryCs,
  denikEntryUrl,
  denikFeedToJson,
  denikFeedToRss,
  parseEvidenceFeedJson,
} from "./feedCodecs";

const entry = (over: Partial<DenikEntry> = {}): DenikEntry => ({
  id: "contract:smlouva:1",
  date: "2026-07-20",
  kind: "contract",
  titleCs: "podepsána smlouva — Alfa & Beta s.r.o.: Dodávka <IT>",
  czk: 1_200_000,
  pending: true,
  timeBasis: "ucinne",
  source: "registr smluv — smlouvy.gov.cz",
  tone: "signal",
  entities: [{ key: "firma:00000100", label: "Alfa & Beta s.r.o.", href: null }],
  internalHref: null,
  ...over,
});

const ctx = { baseUrl: "https://politicas.cz", generatedAt: "2026-07-28T06:00:00.000Z" };

describe("veřejné adresy záznamu", () => {
  it("guid je politicas:denik:<id> a url je kotva dne #d-<datum>", () => {
    const e = entry();
    expect(denikEntryGuid(e)).toBe("politicas:denik:contract:smlouva:1");
    expect(denikEntryUrl(ctx.baseUrl, e)).toBe("https://politicas.cz/denik#d-2026-07-20");
  });

  it("shrnutí přiznává čekající vazbu a vždy cituje zdroj", () => {
    expect(denikEntrySummaryCs(entry())).toBe(
      "podepsána smlouva — Alfa & Beta s.r.o.: Dodávka <IT>. Vazba čeká na lidskou kontrolu. Zdroj: registr smluv — smlouvy.gov.cz.",
    );
    expect(denikEntrySummaryCs(entry({ pending: false }))).not.toContain("čeká");
  });
});

describe("RSS 2.0", () => {
  it("escapuje XML, nese guid isPermaLink=false, link na kotvu dne a pubDate", () => {
    const xml = denikFeedToRss([entry()], ctx);
    expect(xml).toContain("Alfa &amp; Beta s.r.o.");
    expect(xml).toContain("Dodávka &lt;IT&gt;");
    expect(xml).not.toContain("Dodávka <IT>");
    expect(xml).toContain(`<guid isPermaLink="false">politicas:denik:contract:smlouva:1</guid>`);
    expect(xml).toContain("<link>https://politicas.cz/denik#d-2026-07-20</link>");
    expect(xml).toContain("<pubDate>Mon, 20 Jul 2026 00:00:00 GMT</pubDate>");
    expect(xml).toContain("<language>cs</language>");
  });

  it("filtr entity se propisuje do adresy kanálu — URL je odběr", () => {
    const xml = denikFeedToRss([], { ...ctx, entityKey: "poslanec:6543" });
    expect(xml).toContain("<link>https://politicas.cz/denik?entita=poslanec%3A6543</link>");
  });
});

describe("JSON Feed 1.1 — round-trip sdíleným validátorem", () => {
  it("serialize → parse zachová ids/urls/titles a kanálová metadata", () => {
    const entries = [
      entry(),
      entry({ id: "review:r1", date: "2026-07-21", kind: "review", titleCs: "vazba ověřena — X ↔ Y", pending: false }),
    ];
    const parsed = parseEvidenceFeedJson(denikFeedToJson(entries, ctx));
    expect(parsed.title).toBe(DENIK_FEED_TITLE);
    expect(parsed.home_page_url).toBe("https://politicas.cz/denik");
    expect(parsed.feed_url).toBe("https://politicas.cz/denik/feed.json");
    expect(parsed.items.map((i) => i.id)).toEqual([
      "politicas:denik:contract:smlouva:1",
      "politicas:denik:review:r1",
    ]);
    expect(parsed.items.map((i) => i.url)).toEqual([
      "https://politicas.cz/denik#d-2026-07-20",
      "https://politicas.cz/denik#d-2026-07-21",
    ]);
    expect(parsed.items[0].title).toBe(entries[0].titleCs);
    expect(parsed.items[0].date_published).toBe("2026-07-20");
    // autor záznamu je jeho registr — deník nemá revizora u každého řádku.
    expect(parsed.items[0].authors).toEqual([{ name: "registr smluv — smlouvy.gov.cz" }]);
  });

  it("filtrovaný feed nese filtr v home_page_url i feed_url", () => {
    const parsed = parseEvidenceFeedJson(denikFeedToJson([], { ...ctx, entityKey: "firma:00000100" }));
    expect(parsed.home_page_url).toBe("https://politicas.cz/denik?entita=firma%3A00000100");
    expect(parsed.feed_url).toBe("https://politicas.cz/denik/feed.json?entita=firma%3A00000100");
  });
});
