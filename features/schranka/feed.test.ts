import { describe, expect, it } from "vitest";
import {
  denikFeedToJson,
  denikFeedToRss,
  parseEvidenceFeedJson,
} from "@/features/denik/feedCodecs";
import { DELTA_ENTRIES_CAP, type EntityDelta } from "./deriveDeltas";
import {
  SCHRANKA_FEED_ITEMS,
  SCHRANKA_FEED_TITLE,
  schrankaFeedChannel,
  schrankaFeedDescription,
  schrankaFeedEntries,
  schrankaFeedQuery,
} from "./feed";

const row = (id: string, date: string, over: Record<string, unknown> = {}) => ({
  id,
  date,
  kind: "contract" as const,
  titleCs: `zápis ${id}`,
  pending: false,
  timeBasis: "ucinne" as const,
  source: "registr smluv — smlouvy.gov.cz",
  tone: "signal" as const,
  internalHref: null,
  ...over,
});

const delta = (key: string, entries: ReturnType<typeof row>[]): EntityDelta => ({
  key,
  label: key,
  href: null,
  denikHref: `/denik?entita=${key}`,
  total: entries.length,
  latestDate: entries[0]?.date ?? null,
  kinds: [{ kind: "contract", count: entries.length }],
  entries,
});

const KEYS = ["poslanec:6881", "firma:46347534"];
const CTX = { baseUrl: "https://politicas.cz", keys: KEYS, since: "2026-08-01" };

describe("schrankaFeedEntries — jeden řádek jednou", () => {
  it("smlouva sdílená firmou i poslancem se do feedu vydá JEDNOU", () => {
    const shared = row("contract:a", "2026-08-03");
    const items = schrankaFeedEntries([
      delta("poslanec:6881", [shared]),
      delta("firma:46347534", [shared, row("contract:b", "2026-08-02")]),
    ]);
    expect(items.map((i) => i.id)).toEqual(["contract:a", "contract:b"]);
  });

  it("řadí den sestupně, pak id — a je deterministický na pořadí vstupu", () => {
    const a = schrankaFeedEntries([
      delta("poslanec:1", [row("z", "2026-08-01"), row("a", "2026-08-01")]),
      delta("tisk:141", [row("m", "2026-08-05")]),
    ]);
    expect(a.map((i) => i.id)).toEqual(["m", "a", "z"]);
    const b = schrankaFeedEntries([
      delta("tisk:141", [row("m", "2026-08-05")]),
      delta("poslanec:1", [row("a", "2026-08-01"), row("z", "2026-08-01")]),
    ]);
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });

  it("strop řeže; nula znamená prázdno, ne pád", () => {
    const many = Array.from({ length: 5 }, (_, i) => row(`r${i}`, "2026-08-0" + (i + 1)));
    expect(schrankaFeedEntries([delta("poslanec:1", many)], 2)).toHaveLength(2);
    expect(schrankaFeedEntries([delta("poslanec:1", many)], 0)).toHaveLength(0);
  });

  it("výstup feedu se opravou plochy NEZMĚNIL — ani u druhů, které plocha zahazovala", () => {
    /* Feed `parseNovinkyResponse` nevolá: staví se ze serverových `DeltaEntry`,
     * takže `mandate` a `organRole` vydával celou dobu, zatímco plocha o nich
     * psala „nerozumím". Oprava je na strane plochy a tenhle pin drží, že se
     * druhá strana té divergence nehnula ani o bajt. */
    const items = schrankaFeedEntries([
      delta("poslanec:6881", [
        row("mandate:6881", "2026-08-04", { kind: "mandate", timeBasis: "zaznamenano", tone: "ink" }),
        row("organRole:6881:1", "2026-08-03", { kind: "organRole", tone: "cobalt" }),
      ]),
    ]);
    expect(JSON.stringify(items)).toBe(
      JSON.stringify([
        {
          id: "mandate:6881",
          date: "2026-08-04",
          titleCs: "zápis mandate:6881",
          pending: false,
          source: "registr smluv — smlouvy.gov.cz",
          internalHref: null,
        },
        {
          id: "organRole:6881:1",
          date: "2026-08-03",
          titleCs: "zápis organRole:6881:1",
          pending: false,
          source: "registr smluv — smlouvy.gov.cz",
          internalHref: null,
        },
      ]),
    );
  });
});

describe("kanál schránky — adresa JE odběr a popis to říká", () => {
  it("feed_url i home_page_url nesou celý seznam sledovaných a práh", () => {
    const ch = schrankaFeedChannel({ ...CTX, format: "json" });
    expect(ch.feedUrl).toBe(
      "https://politicas.cz/schranka/feed.json?e=poslanec%3A6881&e=firma%3A46347534&od=2026-08-01",
    );
    expect(ch.homeUrl).toBe("https://politicas.cz/schranka");
    expect(ch.title).toBe(SCHRANKA_FEED_TITLE);
  });

  it("popis říká, kolik klíčů adresa nese, že nic není na serveru a že se klíče škrtají z telemetrie", () => {
    const d = schrankaFeedDescription(2, "2026-08-01");
    expect(d).toContain("2 sledované entity");
    expect(d).toContain("žádný účet");
    expect(d).toContain("nic uloženého na serveru");
    expect(d).toContain("telemetrie");
    expect(d).toContain("2026-08-01");
    // Prázdný seznam se přizná, nepředstírá se výběr.
    expect(schrankaFeedDescription(0, "2026-08-01")).toContain("žádnou sledovanou entitu");
  });

  it("popis přizná OBA stropy — čtečka jinak nepozná, že vidí výřez", () => {
    // Do 2026-08-12 jmenoval popis klíče, práh i škrtání z telemetrie, ale ani
    // jedno z čísel, která feed skutečně řežou: položky se odběrateli prostě
    // přestaly objevovat. Čísla se BEROU Z KONSTANT — přepsaná do věty by se
    // s kódem rozešla první změnou stropu.
    const d = schrankaFeedDescription(2, "2026-08-01");
    expect(d).toContain(`nejvýš ${SCHRANKA_FEED_ITEMS} položek`);
    expect(d).toContain(`nejvýš ${DELTA_ENTRIES_CAP} nejnovějších zápisů`);
    // A říká, kde chybějící zbytek je — mez bez pokračování je jen zavřené dveře.
    expect(d).toContain("deník té entity");
  });

  it("prázdný seznam bez prahu = prázdná query (adresa bez ocasu)", () => {
    expect(schrankaFeedQuery([], null)).toBe("");
  });

  it("guid má vlastní prefix — řádek o přepočtu indexu v deníku není", () => {
    const items = schrankaFeedEntries([
      delta("poslanec:6881", [
        row("recompute:42:poslanec:6881", "2026-08-04", {
          kind: "recompute",
          internalHref: "/metodika",
        }),
      ]),
    ]);
    const json = JSON.parse(
      denikFeedToJson(items, {
        baseUrl: "https://politicas.cz",
        generatedAt: "2026-08-04T00:00:00.000Z",
        channel: schrankaFeedChannel({ ...CTX, format: "json" }),
      }),
    );
    expect(json.items[0].id).toBe("politicas:schranka:recompute:42:poslanec:6881");
    // Trvalá adresa řádku je jeho vlastní stránka, ne kotva dne v deníku,
    // kde takový řádek není.
    expect(json.items[0].url).toBe("https://politicas.cz/metodika");
  });
});

describe("serializace — jeden kodek, platný výstup", () => {
  const items = schrankaFeedEntries([
    delta("poslanec:6881", [row("contract:a", "2026-08-03", { pending: true })]),
  ]);
  const ctx = {
    baseUrl: "https://politicas.cz",
    generatedAt: "2026-08-04T10:00:00.000Z",
    channel: schrankaFeedChannel({ ...CTX, format: "json" }),
  };

  it("JSON Feed projde SDÍLENÝM validátorem obou deníků (žádný vlastní tvar)", () => {
    const parsed = parseEvidenceFeedJson(denikFeedToJson(items, ctx));
    expect(parsed.title).toBe(SCHRANKA_FEED_TITLE);
    expect(parsed.items).toHaveLength(1);
    // Pending se nese do těla položky — feed nezamlčí, že řádek stojí na
    // vazbě čekající na kontrolu.
    expect(parsed.items[0].content_text).toContain("čeká na lidskou kontrolu");
  });

  it("RSS nese kanál schránky a escapuje", () => {
    const xml = denikFeedToRss(items, ctx);
    expect(xml).toContain("<?xml version=\"1.0\" encoding=\"UTF-8\"?>");
    expect(xml).toContain(`<title>${SCHRANKA_FEED_TITLE}</title>`);
    expect(xml).toContain("politicas:schranka:contract:a");
    expect(xml).toContain("<link>https://politicas.cz/schranka</link>");
    expect(xml).not.toContain("Deník republiky — Politicas");
  });
});
