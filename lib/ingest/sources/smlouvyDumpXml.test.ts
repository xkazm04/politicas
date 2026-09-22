import { describe, expect, it } from "vitest";
import { decodeHtmlEntities } from "./smlouvy";
import { decodeXml } from "./smlouvy-dump";

/* Two decoders, one grammar. The HTML client's `decodeHtmlEntities` reads decimal AND
 * hexadecimal character references (`&#160;`, `&#xa0;`); the dump's `decodeXml` read only
 * the decimal form, so `&#xA0;` — legal XML, and what several serializers emit — survived
 * into a party name or a contract subject as seven literal characters
 * (2026-09-06, scan-sweep, parity-auditor). */

describe("decodeXml decodes what decodeHtmlEntities decodes (2026-09-06, parity-auditor)", () => {
  it("hexadecimal character references", () => {
    expect(decodeXml("A&#x41;&#xa0;B&#X2013;")).toBe("AA\u00a0B\u2013");
  });

  it("agrees with the HTML client on the shared entity set", () => {
    const shared = "&lt;a&gt; &quot;q&quot; &apos;s&apos; &#65;&#x42; &amp;amp;";
    expect(decodeXml(shared)).toBe(decodeHtmlEntities(shared));
  });
});
