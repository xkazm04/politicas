import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { RefusedError } from "@/lib/ingest/sources/refusal-class";
import { extractText, fetchWithRetry, parseIndex } from "./tiskText";

/* The psp.cz tisk pipeline (index page → PDF → pdftotext sidecar) lived as a byte copy in
 * amends-census.ts and collision-check.ts; the census copy grew an NFC fix and the other did
 * not. One module now; these tests pin the three behaviours the copies disagreed on or lacked. */

const tmp = mkdtempSync(join(tmpdir(), "politicas-tisk-text-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

const response = (status: number, body = "") => new Response(body, { status });

describe("fetchWithRetry — a refusal is classified, not read as a miss", () => {
  it("retries a 503 and returns the recovered response", async () => {
    const seen: string[] = [];
    const res = await fetchWithRetry("https://psp.test/x", {
      timeoutMs: 10,
      attempts: 3,
      baseDelayMs: 0,
      fetchOne: async (u) => {
        seen.push(u);
        return seen.length === 1 ? response(503) : response(200, "ok");
      },
    });
    expect(res.status).toBe(200);
    expect(seen).toHaveLength(2);
  });

  it("does not retry a 404 — one request, a RefusedError naming the class", async () => {
    let calls = 0;
    const p = fetchWithRetry("https://psp.test/gone", {
      timeoutMs: 10,
      attempts: 4,
      baseDelayMs: 0,
      fetchOne: async () => {
        calls++;
        return response(404);
      },
    });
    await expect(p).rejects.toBeInstanceOf(RefusedError);
    await expect(p).rejects.toMatchObject({ kind: "absent", status: 404 });
    expect(calls).toBe(1);
  });

  it("retries a network failure and gives up with the last error after `attempts`", async () => {
    let calls = 0;
    const p = fetchWithRetry("https://psp.test/reset", {
      timeoutMs: 10,
      attempts: 3,
      baseDelayMs: 0,
      fetchOne: async () => {
        calls++;
        throw new Error("ECONNRESET");
      },
    });
    await expect(p).rejects.toThrow("ECONNRESET");
    expect(calls).toBe(3);
  });
});

describe("parseIndex — every PDF link is attributed to the header above it", () => {
  const html = `
<table>
<tr><th colspan=2 class="lightblue">Návrh&nbsp;zákona</th></tr>
<tr><td><span class="file pdf"><a href="/sqw/text/orig2.sqw?idd=100" title="Dokument PDF">t0010.pdf</a></span></td></tr>
<tr><th colspan=2 class="lightblue">Platné znění</th></tr>
<tr><td><span class="file pdf"><a href="/sqw/text/orig2.sqw?idd=101" title="Dokument PDF">t0010a.pdf</a></span></td></tr>
<tr><td><span class="file pdf"><a href="/sqw/text/orig2.sqw?x=1" title="Dokument PDF">no-idd.pdf</a></span></td></tr>
</table>`;
  it("yields (header, idd, filename) and drops a link without idd", () => {
    expect(parseIndex(html)).toEqual([
      { header: "Návrh zákona", idd: "100", filename: "t0010.pdf" },
      { header: "Platné znění", idd: "101", filename: "t0010a.pdf" },
    ]);
  });
});

describe("extractText — the sidecar is read back NFC-normalized", () => {
  it("returns precomposed text for a decomposed sidecar", () => {
    const pdf = join(tmp, "42.pdf");
    const decomposed = "Za\u0301kon c\u030C. 1/2020 Sb."; // á and č as base + combining mark
    writeFileSync(`${pdf.replace(/\.pdf$/, ".txt")}`, decomposed, "utf8");
    const out = extractText(pdf);
    expect(out).toBe("Zákon č. 1/2020 Sb.");
    expect(out).toBe(decomposed.normalize("NFC"));
  });
});
