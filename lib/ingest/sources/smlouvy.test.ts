import { describe, expect, it, vi } from "vitest";
import {
  checkHeaderRow,
  decodeHtmlEntities,
  padIco,
  parseCounterparties,
  parseCzechDate,
  parseDataRow,
  parseHeaderRow,
  parsePage,
  parseTotalMatches,
  parseValueCell,
  SmlouvyClient,
} from "./smlouvy";

/* ── fixtures ─────────────────────────────────────────────────────────────────
 * Trimmed from a live capture of https://smlouvy.gov.cz/vyhledavani?party_idnum=
 * 00011835&all_versions=0 (IČO 00011835, DEZA, a.s.) taken 2026-07-27 — real
 * publisher/subject/value text, structure (tag names, class attrs, nested
 * sort-icon anchors in <th>) preserved verbatim; only the row COUNT is trimmed. */

const REAL_HEADER = `<thead class="list">
<tr>
    <th>
        Publikující smluvní strana
        <a href="/vyhledavani?searchResultList-orderByColumn=subject_name&amp;searchResultList-orderDir=a&amp;do=searchResultList-setOrdering" class="sort-icon" title="Seřadit vzestupně">▲</a>
        <a href="/vyhledavani?searchResultList-orderByColumn=subject_name&amp;searchResultList-orderDir=d&amp;do=searchResultList-setOrdering" class="sort-icon" title="Seřadit sestupně">▼</a>
    </th>
    <th>
        Předmět smlouvy
        <a href="/vyhledavani?searchResultList-orderByColumn=contract_descr&amp;searchResultList-orderDir=a&amp;do=searchResultList-setOrdering" class="sort-icon" title="Seřadit vzestupně">▲</a>
    </th>
    <th>
        Poslední verze
    </th>
    <th>
        Publikováno
    </th>
    <th>
        Hodnota smlouvy
    </th>
    <th>
        Smluvní strana(y)
    </th>
    <th>
    </th>
</tr>
</thead>`;

const ROW_WITH_VALUE = `<tr>
    <td class="1">
        Integrovaná střední škola Valašské Meziříčí
    </td>
    <td class="2">
        Darovací smlouva DEZA
    </td>
    <td class="3">
        ano
    </td>
    <td class="4">
        07.07.2026
    </td>
    <td class="number nobr 5">
        210 000 CZK bez DPH
    </td>
    <td class="6">
        DEZA, a.s.
    </td>
    <td class="btn no-sort">
        <a href="/smlouva/38657860?backlink=wsofy" class="btn">Detail</a>
    </td>
</tr>`;

const ROW_WITH_NEUVEDENO = `<tr>
    <td class="1">
        Správa železnic, státní organizace
    </td>
    <td class="2">
        SMLOUVA o provozování drážní dopravy na styku vzájemně zaústěných drah
    </td>
    <td class="3">
        ano
    </td>
    <td class="4">
        13.07.2026
    </td>
    <td class="number nobr 5">
        Neuvedeno
    </td>
    <td class="6">
        DEZA, a.s.
    </td>
    <td class="btn no-sort">
        <a href="/smlouva/38736140?backlink=wsofy" class="btn">Detail</a>
    </td>
</tr>`;

function page(bodyRows: string, header = REAL_HEADER, total = 91): string {
  return `<!doctype html><html><body>
<p class="list-total">Počet nalezných záznámů ${total}</p>
<table class="searchResultList">
${header}
<tbody class="list">
${bodyRows}
</tbody>
</table>
</body></html>`;
}

/* ── pure parser tests ────────────────────────────────────────────────────── */

describe("padIco", () => {
  it("zero-pads a short IČO to 8 digits", () => {
    expect(padIco("11835")).toBe("00011835");
  });
  it("leaves an already-padded IČO alone", () => {
    expect(padIco("00011835")).toBe("00011835");
  });
  it("strips non-digit characters before padding", () => {
    expect(padIco(" 11835 ")).toBe("00011835");
  });
});

describe("decodeHtmlEntities", () => {
  it("decodes named entities", () => {
    expect(decodeHtmlEntities("Bendl &amp; Brabec")).toBe("Bendl & Brabec");
  });
  it("decodes &nbsp; to an actual nbsp char (U+00A0) — a raw decode, not a whitespace fold", () => {
    expect(decodeHtmlEntities("84&nbsp;000")).toBe("84 000");
  });
  it("decodes numeric decimal and hex entities", () => {
    expect(decodeHtmlEntities("&#" + "9650" + ";")).toBe("▲");
    expect(decodeHtmlEntities("&#xa0;x")).toBe(" x");
  });
  it("leaves plain text untouched", () => {
    expect(decodeHtmlEntities("DEZA, a.s.")).toBe("DEZA, a.s.");
  });
});

describe("parseValueCell", () => {
  it("parses a stated value with a 'bez DPH' note, real space thousands separator", () => {
    expect(parseValueCell("210 000 CZK bez DPH")).toEqual({ valueCzk: 210_000, valueNote: "bez DPH" });
  });
  it("parses a stated value with an 's DPH' note", () => {
    expect(parseValueCell("321 100 CZK s DPH")).toEqual({ valueCzk: 321_100, valueNote: "s DPH" });
  });
  it("parses an &nbsp;-separated value (decoded before the numeric match)", () => {
    expect(parseValueCell("84&nbsp;000 CZK bez DPH")).toEqual({ valueCzk: 84_000, valueNote: "bez DPH" });
  });
  it("returns null, never 0, for the literal 'Neuvedeno' sentinel", () => {
    expect(parseValueCell("Neuvedeno")).toEqual({ valueCzk: null, valueNote: null });
  });
  it("returns null for an empty cell", () => {
    expect(parseValueCell("   ")).toEqual({ valueCzk: null, valueNote: null });
  });
});

describe("parseCzechDate", () => {
  it("converts DD.MM.YYYY to ISO", () => {
    expect(parseCzechDate("13.07.2026")).toBe("2026-07-13");
  });
  it("returns null for unparseable input rather than guessing", () => {
    expect(parseCzechDate("neznámé datum")).toBeNull();
  });
});

describe("parseCounterparties", () => {
  it("splits a comma-separated cell into individual names", () => {
    expect(parseCounterparties("DEZA, a.s., Agrofert a.s.")).toEqual(["DEZA", "a.s.", "Agrofert a.s."]);
  });
  it("keeps a single-party cell as one entry", () => {
    expect(parseCounterparties("DEZA, a.s.")).toEqual(["DEZA", "a.s."]);
  });
  it("splits on <br> as well as comma", () => {
    expect(parseCounterparties("Firma A<br/>Firma B")).toEqual(["Firma A", "Firma B"]);
  });
});

describe("parseHeaderRow / checkHeaderRow", () => {
  it("extracts the 6 labelled headers plus the trailing unlabelled action column", () => {
    expect(parseHeaderRow(page(ROW_WITH_VALUE))).toEqual([
      "Publikující smluvní strana",
      "Předmět smlouvy",
      "Poslední verze",
      "Publikováno",
      "Hodnota smlouvy",
      "Smluvní strana(y)",
      "",
    ]);
  });

  it("does not throw on the real header shape", () => {
    expect(() => checkHeaderRow(page(ROW_WITH_VALUE))).not.toThrow();
  });

  // Batch-009 regression: the live site renders the trailing action column's <th> EMPTY.
  // An earlier revision required the literal label "Detail" there — it matched this very
  // fixture and rejected all 18 live pages in the parent-contract sweep. The action
  // column's label is therefore no longer asserted; only the labelled prefix and the
  // table width are.
  it("accepts the trailing action column whether or not it carries a label", () => {
    const labelled = REAL_HEADER.replace(/<th>\s*<\/th>\s*<\/tr>/, "<th>Detail</th></tr>");
    expect(() => checkHeaderRow(page(ROW_WITH_VALUE, labelled))).not.toThrow();
    expect(() => checkHeaderRow(page(ROW_WITH_VALUE))).not.toThrow();
  });

  it("returns null (not drift) when there is no <thead> at all", () => {
    expect(parseHeaderRow("<html><body>no table here</body></html>")).toBeNull();
  });

  it("throws a clear error when the header labels have drifted (shifted/renamed column)", () => {
    const driftedHeader = REAL_HEADER.replace("Hodnota smlouvy", "Cena");
    expect(() => checkHeaderRow(page(ROW_WITH_VALUE, driftedHeader))).toThrow(/header-row drift/i);
  });

  it("throws when a column is missing entirely (shifted count)", () => {
    const shortHeader = `<thead><tr><th>Publikující smluvní strana</th><th>Předmět smlouvy</th></tr></thead>`;
    expect(() => checkHeaderRow(page(ROW_WITH_VALUE, shortHeader))).toThrow(/header-row drift/i);
  });
});

describe("parseDataRow", () => {
  it("parses a normal row with a stated CZK value", () => {
    const row = parseDataRow(ROW_WITH_VALUE);
    expect(row).toEqual({
      contractId: "38657860",
      detailUrl: "/smlouva/38657860?backlink=wsofy",
      publisher: "Integrovaná střední škola Valašské Meziříčí",
      subject: "Darovací smlouva DEZA",
      publishedOn: "2026-07-07",
      valueCzk: 210_000,
      valueNote: "bez DPH",
      counterparties: ["DEZA", "a.s."],
      latestVersion: true,
    });
  });

  it("parses 'Neuvedeno' to a null value, never 0", () => {
    const row = parseDataRow(ROW_WITH_NEUVEDENO);
    expect(row?.valueCzk).toBeNull();
    expect(row?.valueNote).toBeNull();
    expect(row?.contractId).toBe("38736140");
  });

  it("returns null for a row with the wrong number of cells rather than mis-mapping", () => {
    const malformed = `<tr><td class="1">Only one cell</td></tr>`;
    expect(parseDataRow(malformed)).toBeNull();
  });
});

describe("parseTotalMatches", () => {
  it("parses the 'Počet nalezných záznámů N' total", () => {
    expect(parseTotalMatches(page(ROW_WITH_VALUE, REAL_HEADER, 91))).toBe(91);
  });
  it("returns null (not 0) when the wording isn't found", () => {
    expect(parseTotalMatches("<html><body>nothing here</body></html>")).toBeNull();
  });
});

describe("parsePage", () => {
  it("parses two real rows out of a full page", () => {
    const result = parsePage(page(`${ROW_WITH_VALUE}\n${ROW_WITH_NEUVEDENO}`));
    expect(result.rows).toHaveLength(2);
    expect(result.totalMatches).toBe(91);
    expect(result.rows[0].contractId).toBe("38657860");
    expect(result.rows[1].valueCzk).toBeNull();
  });

  it("parses an empty result set (no <thead>, no rows) without throwing", () => {
    const emptyHtml = `<!doctype html><html><body><p class="list-total">Počet nalezných záznámů 0</p></body></html>`;
    const result = parsePage(emptyHtml);
    expect(result.rows).toEqual([]);
    expect(result.totalMatches).toBe(0);
  });
});

/* ── client tests (fetchImpl injected — no network) ──────────────────────── */

function jsonHeaders(setCookie?: string): Headers {
  const h = new Headers();
  if (setCookie) h.set("set-cookie", setCookie);
  return h;
}

function htmlResponse(body: string, setCookie?: string): Response {
  return new Response(body, { status: 200, headers: jsonHeaders(setCookie) });
}

describe("SmlouvyClient.fetchPage", () => {
  it("does the single-request path at the default page size (10, offset 0)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(htmlResponse(page(ROW_WITH_VALUE), "PHPSESSID=abc; Path=/"));
    const client = new SmlouvyClient({ fetchImpl: fetchImpl as unknown as typeof fetch });
    const result = await client.fetchPage("11835", { limit: 10, offset: 0 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result.rows).toHaveLength(1);
  });

  it("performs the two-request session handshake for a non-default limit, forwarding the session cookie", async () => {
    const calls: { url: string; cookie: string | null }[] = [];
    const fetchImpl = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      calls.push({ url, cookie: headers.get("Cookie") });
      if (calls.length === 1) {
        // first request: establishes the session, default page (1 row in this fixture)
        return Promise.resolve(htmlResponse(page(ROW_WITH_VALUE), "PHPSESSID=xyz; Path=/; HttpOnly"));
      }
      // second request: the setLimit signal, same session → full page (2 rows)
      return Promise.resolve(htmlResponse(page(`${ROW_WITH_VALUE}\n${ROW_WITH_NEUVEDENO}`)));
    });
    const client = new SmlouvyClient({ fetchImpl: fetchImpl as unknown as typeof fetch });
    const result = await client.fetchPage("00011835", { limit: 100, offset: 0 });

    expect(calls).toHaveLength(2);
    expect(calls[0].url).toContain("party_idnum=00011835");
    expect(calls[0].url).not.toContain("do=searchResultList-setLimit");
    expect(calls[1].url).toContain("do=searchResultList-setLimit");
    expect(calls[1].url).toContain("searchResultList-limit=100");
    expect(calls[1].cookie).toBe("PHPSESSID=xyz");
    expect(result.rows).toHaveLength(2);
  });

  it("throws with a descriptive error on a non-ok response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("boom", { status: 503 }));
    const client = new SmlouvyClient({ fetchImpl: fetchImpl as unknown as typeof fetch });
    await expect(client.fetchPage("11835")).rejects.toThrow(/503/);
  });
});

describe("SmlouvyClient.fetchAllForIco", () => {
  it("stops paging once a short page signals end-of-results", async () => {
    let call = 0;
    const fetchImpl = vi.fn().mockImplementation(() => {
      call++;
      if (call === 1) return Promise.resolve(htmlResponse(page(ROW_WITH_VALUE), "PHPSESSID=s1"));
      // page 1 of the paginated fetch (limit=2): 2 full rows
      if (call === 2) return Promise.resolve(htmlResponse(page(`${ROW_WITH_VALUE}\n${ROW_WITH_NEUVEDENO}`)));
      // page 2: short (1 row < limit 2) → end of results
      return Promise.resolve(htmlResponse(page(ROW_WITH_VALUE)));
    });
    const client = new SmlouvyClient({ fetchImpl: fetchImpl as unknown as typeof fetch });
    const result = await client.fetchAllForIco("11835", { limit: 2, maxPages: 10 });

    expect(result.truncated).toBe(false);
    expect(result.rows).toHaveLength(3);
    expect(result.totalMatches).toBe(91);
  });

  it("truncates at maxPages and LOGS the truncation rather than looping forever or hiding it", async () => {
    // every page returns a FULL page (limit rows) — never signals end-of-results —
    // simulating a pagination bug or a company with more contracts than maxPages*limit covers.
    const fetchImpl = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(htmlResponse(page(`${ROW_WITH_VALUE}\n${ROW_WITH_NEUVEDENO}`), "PHPSESSID=s1")),
      );
    const client = new SmlouvyClient({ fetchImpl: fetchImpl as unknown as typeof fetch });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await client.fetchAllForIco("11835", { limit: 2, maxPages: 3 });

    expect(result.truncated).toBe(true);
    expect(result.rows).toHaveLength(6); // 3 pages * 2 rows
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toMatch(/maxPages=3/);
    warnSpy.mockRestore();
  });

  it("returns an empty result set for an IČO with zero matches, without throwing", async () => {
    const emptyHtml = `<!doctype html><html><body><p class="list-total">Počet nalezných záznámů 0</p></body></html>`;
    const fetchImpl = vi.fn().mockImplementation(() => Promise.resolve(htmlResponse(emptyHtml, "PHPSESSID=s1")));
    const client = new SmlouvyClient({ fetchImpl: fetchImpl as unknown as typeof fetch });
    const result = await client.fetchAllForIco("99999999");
    expect(result.rows).toEqual([]);
    expect(result.truncated).toBe(false);
    expect(result.totalMatches).toBe(0);
  });
});
