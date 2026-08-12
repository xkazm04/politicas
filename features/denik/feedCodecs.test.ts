// Deník republiky — přibití strojových podob (moonshot 3A): stabilita guid a
// kotvy dne (veřejné API), XML escaping, RSS struktura a JSON round-trip přes
// SDÍLENÝ validátor Deníku důkazů (`parseEvidenceFeedJson`) — jeden formát,
// jeden čtecí kód pro oba deníky.

import { describe, expect, it } from "vitest";
import { FEED_ENTRIES, type DenikEntry } from "./deriveDenik";
import {
  DENIK_FEED_TITLE,
  denikEntryGuid,
  denikEntrySummaryCs,
  denikEntryUrl,
  denikFeedDescription,
  denikFeedToJson,
  denikFeedToRss,
  parseEvidenceFeedJson,
} from "./feedCodecs";
import { denikFeedNotice } from "./feedNotes";
import type { DenikCoverage, DenikLimits } from "./getDenikData";
// Čte se, nezasahuje se: schránka je druhý kanál nad tímhle kodekem a její
// bajty musí tenhle test uhlídat (viz poslední blok).
import { schrankaFeedChannel } from "@/features/schranka/feed";

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
  links: [],
  evidence: [],
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
    // pubDate je TÝŽ okamžik jako date_published v JSON podobě — pražská
    // půlnoc dne (20. 7. je letní čas, tedy +02:00 → 19. 7. 22:00 UTC).
    expect(xml).toContain("<pubDate>Sun, 19 Jul 2026 22:00:00 GMT</pubDate>");
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
    // JSON Feed 1.1 vyžaduje RFC 3339; do 2026-08-04 se emitoval holý den.
    expect(parsed.items[0].date_published).toBe("2026-07-20T00:00:00+02:00");
    // autor záznamu je jeho registr — deník nemá revizora u každého řádku.
    expect(parsed.items[0].authors).toEqual([{ name: "registr smluv — smlouvy.gov.cz" }]);
  });

  it("filtrovaný feed nese filtr v home_page_url i feed_url", () => {
    const parsed = parseEvidenceFeedJson(denikFeedToJson([], { ...ctx, entityKey: "firma:00000100" }));
    expect(parsed.home_page_url).toBe("https://politicas.cz/denik?entita=firma%3A00000100");
    expect(parsed.feed_url).toBe("https://politicas.cz/denik/feed.json?entita=firma%3A00000100");
  });
});

describe("date_published je RFC 3339 — ne holý den", () => {
  const RFC3339 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/;

  it("každá položka nese razítko, které projde tvarem RFC 3339", () => {
    const parsed = parseEvidenceFeedJson(
      denikFeedToJson(
        [
          entry({ id: "a", date: "2026-07-20" }),
          entry({ id: "b", date: "2026-01-04" }),
          entry({ id: "c", date: "2026-03-29" }),
        ],
        ctx,
      ),
    );
    expect(parsed.items.map((i) => i.date_published)).toEqual([
      "2026-07-20T00:00:00+02:00",
      "2026-01-04T00:00:00+01:00",
      // den přechodu na letní čas: o půlnoci ještě +01:00, neodhaduje se
      "2026-03-29T00:00:00+01:00",
    ]);
    for (const i of parsed.items) expect(i.date_published).toMatch(RFC3339);
  });

  it("den, který se nedá orazítkovat, se neodhaduje — prázdné datum, ne nesmysl", () => {
    const parsed = parseEvidenceFeedJson(denikFeedToJson([entry({ date: "2026-7-2" })], ctx));
    expect(parsed.items[0].date_published).toBe("");
    expect(denikFeedToRss([entry({ date: "2026-7-2" })], ctx)).not.toContain("<pubDate>");
  });
});

/* ── popis kanálu přiznává, co feed nenese ──────────────────────────────────── */

describe("popis kanálu přiznává STROP — feed není archiv", () => {
  it("jmenuje strop zápisů z konstanty, která řez opravdu dělá", () => {
    // Do 2026-08-12 popis žádnou mez nejmenoval, ačkoli obě routy krájejí
    // `slice(0, FEED_ENTRIES)`: odběrateli se položky prostě přestaly
    // objevovat. Číslo je DOSAZENÉ — přepsané do věty by se s kódem rozešlo
    // první změnou stropu (precedens popisu kanálu schránky).
    const d = denikFeedDescription();
    expect(d).toContain(`nejvýš ${FEED_ENTRIES} nejnovějších zápisů`);
    // A říká, že se řeže po ZÁPISECH, ne po dnech — sto zápisů je zpravidla
    // míň dnů, než ukazuje plocha, takže feed dozadu nesahá dál než ona.
    expect(d).toContain("po zápisech, ne po dnech");
    // Mez bez pokračování jsou jen zavřené dveře: kde zbytek je.
    expect(d).toContain("/denik");
  });

  it("popis se propíše do obou formátů", () => {
    expect(denikFeedToRss([], ctx)).toContain(`nejvýš ${FEED_ENTRIES} nejnovějších zápisů`);
    expect(parseEvidenceFeedJson(denikFeedToJson([], ctx)).description).toBe(denikFeedDescription());
  });
});

describe("upozornění o tmavé vrstvě a useknutém čtení", () => {
  const COVERAGE_OK: DenikCoverage = { money: true, law: true, reviews: true, changes: true };
  const LIMITS_CLEAN: DenikLimits = {
    contractCompanies: 57,
    companyCap: 500,
    companiesOverCap: 0,
    edgeCap: 5_000,
    companiesEdgeTruncated: 0,
    malformedIco: 0,
    changesFromGate: 0,
    changesUndisplayable: 0,
    auditCap: 10_000,
    auditTruncated: false,
    changeCap: 5_000,
    changesRead: 0,
    changesTruncated: false,
  };

  it("čisté čtení plného pokrytí mlčí — mez, která se nedotkla dat, není sdělení", () => {
    expect(denikFeedNotice(COVERAGE_OK, LIMITS_CLEAN)).toBeNull();
  });

  it("neznalost mlčí taky: bez pokrytí i bez mezí se netvrdí nic", () => {
    expect(denikFeedNotice(null, null)).toBeNull();
  });

  it("tmavá vrstva se JMENUJE — jinak je k nerozeznání od klidného týdne", () => {
    const notice = denikFeedNotice({ ...COVERAGE_OK, money: false, reviews: false }, LIMITS_CLEAN);
    expect(notice).toContain("peněžní vrstva");
    expect(notice).toContain("lidská brána");
    // Vrstvy, které čitelné JSOU, se nejmenují — to by byl šum, ne přiznání.
    expect(notice).not.toContain("legislativní vrstva");
    expect(notice).toContain("tenhle výpis nenese");
  });

  it("useknuté čtení nese POČTY i stropy, spočítané z mezí", () => {
    const notice = denikFeedNotice(COVERAGE_OK, {
      ...LIMITS_CLEAN,
      companiesEdgeTruncated: 5,
      auditTruncated: true,
      changesTruncated: true,
      changesUndisplayable: 2,
    });
    expect(notice).toContain("5 firem");
    expect(notice).toContain("2 záznamů grafu");
    // Oddělovač tisíců vlastní lib/format (je to nezlomitelná mezera, ne ASCII),
    // takže se porovnává na číslicích — tenhle test o sázení čísel nerozhoduje.
    const digits = (notice ?? "").replace(/\D/g, "");
    expect(digits).toContain("10000"); // strop lidské brány
    expect(digits).toContain("5000"); // strop proudu i smluv na firmu
  });

  it("přiznává ZTRÁTU, ne evidenci — nekanonické IČO ani deduplikace brány tam nepatří", () => {
    // `malformedIco` řádek neztrácí (jen mu chybí čip firmy) a `changesFromGate`
    // je záměrná deduplikace: obojí by ve větě o neúplnosti výpisu lhalo.
    expect(denikFeedNotice(COVERAGE_OK, { ...LIMITS_CLEAN, malformedIco: 9, changesFromGate: 4 })).toBeNull();
  });

  it("se přilepí k popisu kanálu, ne jako položka feedu", () => {
    const notice = denikFeedNotice({ ...COVERAGE_OK, money: false }, LIMITS_CLEAN);
    const parsed = parseEvidenceFeedJson(denikFeedToJson([entry()], { ...ctx, notice }));
    expect(parsed.description).toContain("peněžní vrstva");
    // Syntetická položka by v čtečce stála mezi datovanými fakty o státu a
    // tvářila se jako jedno z nich.
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0].id).toBe("politicas:denik:contract:smlouva:1");
    expect(denikFeedToRss([entry()], { ...ctx, notice })).toContain("peněžní vrstva");
  });

  it("bez upozornění je popis beze změny", () => {
    const bare = parseEvidenceFeedJson(denikFeedToJson([], ctx)).description;
    for (const notice of [null, undefined]) {
      expect(parseEvidenceFeedJson(denikFeedToJson([], { ...ctx, notice })).description).toBe(bare);
    }
  });
});

/* ── filtrovaný feed drží filtr i v adresách položek ────────────────────────── */

describe("položka filtrovaného feedu míří do FILTROVANÉHO dne", () => {
  // Do 2026-08-12 mířila každá položka na `/denik#d-<datum>`, tedy do
  // nefiltrované plochy — ta ukazuje posledních 30 dnů CELÉHO deníku, kdežto
  // feed jedné entity sahá svých sto zápisů mnohem dál. Odkaz vypadal správně
  // a u řídké entity nevedl nikam.
  it("nefiltrovaný feed má kotvu dne beze změny", () => {
    expect(denikEntryUrl("https://politicas.cz", entry())).toBe(
      "https://politicas.cz/denik#d-2026-07-20",
    );
    expect(denikEntryUrl("https://politicas.cz", entry(), null)).toBe(
      "https://politicas.cz/denik#d-2026-07-20",
    );
  });

  it("filtrovaný feed nese v adrese položky i filtr", () => {
    expect(denikEntryUrl("https://politicas.cz", entry(), "poslanec:6881")).toBe(
      "https://politicas.cz/denik?entita=poslanec%3A6881#d-2026-07-20",
    );
  });

  it("oba formáty datují a adresují týž řádek stejně", () => {
    const filtered = { ...ctx, entityKey: "firma:00000100" };
    const parsed = parseEvidenceFeedJson(denikFeedToJson([entry()], filtered));
    const url = "https://politicas.cz/denik?entita=firma%3A00000100#d-2026-07-20";
    expect(parsed.items[0].url).toBe(url);
    expect(denikFeedToRss([entry()], filtered)).toContain(`<link>${url}</link>`);
  });

  it("den, ze kterého kotvu složit nejde, spadne na nefiltrovanou — nikdy vymyšlená adresa", () => {
    expect(denikEntryUrl("https://politicas.cz", entry({ date: "2026-7-2" }), "poslanec:6881")).toBe(
      "https://politicas.cz/denik#d-2026-7-2",
    );
  });

  it("kanál s vlastní adresou položky (schránka) filtr neřeší — jeho pravidlo vyhrává", () => {
    const parsed = parseEvidenceFeedJson(
      denikFeedToJson([entry()], {
        ...ctx,
        entityKey: "poslanec:6881",
        channel: {
          title: "T",
          description: "D",
          homeUrl: "https://politicas.cz/schranka",
          feedUrl: "https://politicas.cz/schranka/feed.json",
          entryUrl: (e, baseUrl) => `${baseUrl}/vlastni/${e.id}`,
        },
      }),
    );
    expect(parsed.items[0].url).toBe("https://politicas.cz/vlastni/contract:smlouva:1");
  });
});

/* ── druhý kanál nad týmž serializérem se nesmí pohnout ─────────────────────── */

describe("Občanská schránka — kanál nad TÝMŽ kodekem zůstává bajt po bajtu stejný", () => {
  // Schránka si nepíše vlastní serializér: dodává jen kanálová metadata
  // (DenikFeedChannel). Každá změna kodeku je tedy změnou JEJÍHO feedu, i když
  // se v features/schranka nesáhne na řádek — proto ten pin stojí tady, u
  // kodeku, který ho může rozbít. Schránka svoje upozornění nepočítá a vlastní
  // adresu položky si drží, takže se jí nesmí dotknout ani strop v popisu, ani
  // filtr v adresách.
  const channel = schrankaFeedChannel({
    baseUrl: "https://politicas.cz",
    keys: ["poslanec:6881", "firma:46347534"],
    since: "2026-08-01",
    format: "json",
  });

  it("popis kanálu je JEHO popis — bez věty o stropu deníku", () => {
    const parsed = parseEvidenceFeedJson(denikFeedToJson([entry()], { ...ctx, channel }));
    expect(parsed.description).toBe(channel.description);
    expect(parsed.description).not.toContain(`nejvýš ${FEED_ENTRIES} nejnovějších zápisů`);
    expect(parsed.title).toBe(channel.title);
    expect(parsed.feed_url).toBe(channel.feedUrl);
    expect(parsed.home_page_url).toBe(channel.homeUrl);
  });

  it("adresa položky jde jeho pravidlem i pod nastaveným filtrem entity", () => {
    const withKey = denikFeedToJson([entry({ internalHref: "/metodika" })], {
      ...ctx,
      entityKey: "poslanec:6881",
      channel,
    });
    const withoutKey = denikFeedToJson([entry({ internalHref: "/metodika" })], { ...ctx, channel });
    // Bajt po bajtu totéž: filtr deníku do cizího kanálu nepromlouvá.
    expect(withKey).toBe(withoutKey);
    expect(parseEvidenceFeedJson(withKey).items[0].url).toBe("https://politicas.cz/metodika");
  });
});

describe("pořadí feedu je den SESTUPNĚ — přibito na hranici kodeku", () => {
  // Titulní rubrika (features/landing/components/DenikTeaser) čte „poslední
  // zapsaný den" jako items[0]; to je pravda jen díky pořadí, které přes
  // hranici formátu nic nedrželo.
  it("serializér zachovává pořadí vstupu a to je sestupné podle dne", () => {
    const entries = [
      entry({ id: "c", date: "2026-07-22" }),
      entry({ id: "b", date: "2026-07-21" }),
      entry({ id: "a", date: "2026-07-20" }),
    ];
    const parsed = parseEvidenceFeedJson(denikFeedToJson(entries, ctx));
    const stamps = parsed.items.map((i) => i.date_published);
    expect(stamps).toEqual([...stamps].sort().reverse());
    expect(parsed.items[0].id).toBe("politicas:denik:c");

    const xml = denikFeedToRss(entries, ctx);
    expect(xml.indexOf("politicas:denik:c")).toBeLessThan(xml.indexOf("politicas:denik:b"));
    expect(xml.indexOf("politicas:denik:b")).toBeLessThan(xml.indexOf("politicas:denik:a"));
  });
});
