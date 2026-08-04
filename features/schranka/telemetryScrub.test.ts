import { describe, expect, it } from "vitest";
import * as Sentry from "@sentry/node";
import { scrubFollowTelemetry, scrubFollowUrl } from "./telemetryScrub";

const KEYS = ["poslanec:6881", "firma:46347534", "tisk:141"];

/** Všechny řetězce události — kontrola „nikde ani jeden klíč". Cyklické
 *  odkazy (SDK věší na událost i časovače) se přeskakují. */
function allStrings(value: unknown, seen = new Set<unknown>()): string[] {
  if (typeof value === "string") return [value];
  if (typeof value !== "object" || value === null || seen.has(value)) return [];
  seen.add(value);
  return Object.values(value as Record<string, unknown>).flatMap((v) => allStrings(v, seen));
}

describe("scrubFollowUrl — tvary, ve kterých adresa v telemetrii žije", () => {
  it("absolutní URL: klíče pryč, počet zůstává, ostatní parametry beze změny", () => {
    const out = scrubFollowUrl(
      "https://politicas.cz/schranka/novinky.json?e=poslanec:1&e=firma:46347534&od=2026-08-01",
    );
    expect(out).not.toContain("poslanec");
    expect(out).not.toContain("46347534");
    expect(out).toContain("e_count=2");
    expect(out).toContain("od=2026-08-01");
    expect(out.startsWith("https://politicas.cz/schranka/novinky.json?")).toBe(true);
  });

  it("relativní adresa i holý query string (oba tvary SDK vydává)", () => {
    expect(scrubFollowUrl("/schranka/feed.xml?e=poslanec:1")).toBe("/schranka/feed.xml?e_count=1");
    // `delete` + `set` posune počet na konec — pořadí parametrů telemetrie
    // neurčuje nic, obsah ano.
    expect(scrubFollowUrl("e=poslanec:1&e=tisk:141&od=2026-08-01")).toBe(
      "od=2026-08-01&e_count=2",
    );
  });

  it("cizí `e` (ne klíč entity) se NEMĚNÍ — telemetrie nesmí lhát o cizím dotazu", () => {
    expect(scrubFollowUrl("/neco?e=42")).toBe("/neco?e=42");
    expect(scrubFollowUrl("/schranka?ne=poslanec:1")).toBe("/schranka?ne=poslanec:1");
    expect(scrubFollowUrl("https://politicas.cz/schranka/novinky.json")).toBe(
      "https://politicas.cz/schranka/novinky.json",
    );
  });
});

describe("scrubFollowTelemetry — nad SKUTEČNOU událostí SDK", () => {
  it("beforeSendTransaction dostane adresu ve DVOU atributech a scrub vyčistí oba", async () => {
    const url = `http://localhost/schranka/novinky.json?${KEYS.map((k) => `e=${k}`).join("&")}&od=2026-08-01`;
    const raw: unknown[] = [];
    const scrubbed: unknown[] = [];

    Sentry.init({
      // Falešné DSN + transport do prázdna: událost se skutečně SESTAVÍ SDK
      // (o to tu jde), ale nikam neodejde. Živé DSN v repu není, takže
      // ověření je na úrovni události, ne odeslaného requestu — a tenhle
      // komentář je ta poctivá výhrada.
      dsn: "https://examplePublicKey@o0.ingest.sentry.io/0",
      tracesSampleRate: 1,
      transport: () => ({ send: async () => ({}), flush: async () => true }),
      beforeSendTransaction(event) {
        raw.push(JSON.parse(JSON.stringify(event.contexts?.trace?.data ?? {})));
        scrubbed.push(scrubFollowTelemetry(event));
        return null; // nic se neodesílá
      },
    });

    Sentry.startSpan(
      {
        name: "GET /schranka/novinky.json",
        attributes: { "url.full": url, "http.request.method": "GET" },
      },
      () => {},
    );
    await Sentry.flush(2000);

    expect(raw).toHaveLength(1);
    // Nejdřív DŮKAZ PROBLÉMU: SDK si adresu rozkopíruje do několika atributů.
    const before = raw[0] as Record<string, unknown>;
    const leaking = Object.entries(before).filter(
      ([, v]) => typeof v === "string" && v.includes("poslanec:6881"),
    );
    // MĚŘENO (@sentry/node 10.67): stačí předat `url.full` a SDK si adresu
    // rozkopíruje — v události pak leží ve DVOU atributech, z toho jeden
    // (`http.query`) jsme nikdy nenastavili. Právě proto se škrtá podle
    // parametru, ne podle jednoho očekávaného pole.
    expect(leaking.map(([k]) => k).sort()).toEqual(["http.query", "url.full"]);

    // A pak že po scrubu nezůstal ANI JEDEN klíč nikde v události.
    const strings = allStrings(scrubbed[0]);
    for (const key of KEYS) {
      expect(strings.some((s) => s.includes(key)), key).toBe(false);
    }
    expect(strings.some((s) => s.includes("e_count=3"))).toBe(true);
    // Cesta i transakce zůstávají — ladit se má co.
    expect(strings.some((s) => s.includes("/schranka/novinky.json"))).toBe(true);
  });
});

describe("scrubFollowTelemetry — ostatní místa události", () => {
  it("request.url, query_string, spans i breadcrumbs", () => {
    const event = scrubFollowTelemetry({
      transaction: "GET /schranka/feed.json",
      request: {
        url: "https://politicas.cz/schranka/feed.json?e=poslanec:1",
        query_string: "e=poslanec:1&e=firma:46347534",
      },
      contexts: { trace: { data: { "url.full": "https://politicas.cz/x?e=tisk:141" } } },
      spans: [{ data: { "http.url": "https://politicas.cz/y?e=poslanec:1" } }],
      breadcrumbs: [{ data: { url: "/schranka/novinky.json?e=firma:46347534" } }],
    });
    expect(JSON.stringify(event)).not.toMatch(/poslanec:1|firma:46347534|tisk:141/);
  });

  it("neznámý tvar události projde beze změny a bez výjimky", () => {
    expect(scrubFollowTelemetry({})).toEqual({});
    expect(scrubFollowTelemetry({ request: "ne", contexts: 5, spans: "ne" })).toEqual({
      request: "ne",
      contexts: 5,
      spans: "ne",
    });
  });
});
