import { describe, expect, it } from "vitest";
import { isTextMangled, normalizePumperReleases, resolveHref, type PumperRecord } from "./pumper";

const prov = {
  source: "pumper-psp-opendata",
  sourceUrl: "https://www.psp.cz/sqw/hp.sqw?k=1300",
  fetchedAt: "2026-07-23T00:00:00.000Z",
  ingestRunId: 1,
};

describe("isTextMangled", () => {
  it("detects the U+FFFD replacement character from a charset mis-decode", () => {
    expect(isTextMangled("Hlasov�n�")).toBe(true);
    expect(isTextMangled("Hlasování")).toBe(false);
    expect(isTextMangled(null, undefined)).toBe(false);
  });
});

describe("resolveHref", () => {
  it("resolves a relative dump href against the release page url", () => {
    expect(resolveHref("../eknih/cdrom/opendata/poslanci.zip", "https://www.psp.cz/sqw/hp.sqw?k=1300")).toBe(
      "https://www.psp.cz/eknih/cdrom/opendata/poslanci.zip",
    );
  });
  it("returns null for a null href", () => {
    expect(resolveHref(null, "https://www.psp.cz/")).toBeNull();
  });
});

describe("normalizePumperReleases", () => {
  it("expands an extractor manifest into one row per dump file, flagging mangled text", () => {
    const records: PumperRecord[] = [
      {
        key: "https://www.psp.cz/sqw/hp.sqw?k=1300",
        data: {
          _url: "https://www.psp.cz/sqw/hp.sqw?k=1300",
          page_title: "Data Poslaneck� sn�movny",
          dumps: [
            { file: null, href: null, description: null }, // header/spacer row
            { file: "poslanci.zip", href: "../eknih/cdrom/opendata/poslanci.zip", description: "Agenda poslanc�" },
          ],
        },
      },
    ];
    const rows = normalizePumperReleases([{ app: "extractor", dataset: "extracted", records }], prov);
    expect(rows).toHaveLength(1);
    expect(rows[0].fileName).toBe("poslanci.zip");
    expect(rows[0].fileUrl).toBe("https://www.psp.cz/eknih/cdrom/opendata/poslanci.zip");
    expect(rows[0].raw._mangled).toBe(true);
  });

  it("normalizes a watch fingerprint row", () => {
    const records: PumperRecord[] = [
      {
        key: "https://www.psp.cz/sqw/hp.sqw?k=1300",
        data: { url: "https://www.psp.cz/sqw/hp.sqw?k=1300", title: "Data", chars: 12699, content_sha256: "abc" },
      },
    ];
    const rows = normalizePumperReleases([{ app: "watch", dataset: "pages", records }], prov);
    expect(rows[0].contentSha256).toBe("abc");
    expect(rows[0].observedChars).toBe(12699);
  });

  it("filters out records that are not on the psp.cz host (shared Pumper datasets)", () => {
    const records: PumperRecord[] = [
      { key: "https://example.com/x", data: { url: "https://example.com/x", title: "Other product" } },
    ];
    expect(normalizePumperReleases([{ app: "watch", dataset: "pages", records }], prov)).toHaveLength(0);
  });
});
