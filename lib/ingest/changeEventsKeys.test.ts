import { describe, expect, it } from "vitest";
import { edgeEntityKeys, icoFromNodeId } from "./changeEvents";

/* The `firma:<ico>` watch key is a MIRROR of features/denik/deriveDenik's `companyEntityKey`,
 * which the deník builds from `canonicalIco` — the 8-digit form. `icoFromNodeId` took the
 * node id's trailing digits verbatim (6–8 of them), so a company node whose id carries an
 * unpadded IČO produced `firma:1234567`, and the `?entita=firma:01234567` filter
 * (`entity_keys @> …` in the changes repository) never matched its events. It also read
 * ANY id whose last segment is 6–8 digits as a company (2026-09-06, scan-sweep,
 * parity-auditor: one key, two spellings). */

describe("icoFromNodeId — the firma key is canonical (2026-09-06, parity-auditor)", () => {
  it("pads an unpadded IČO to the 8-digit form the deník filters by", () => {
    expect(icoFromNodeId("company:ico:1234567")).toBe("01234567");
    expect(icoFromNodeId("kg:company:ico:222222")).toBe("00222222");
    expect(icoFromNodeId("kg:company:ico:04544152")).toBe("04544152");
  });

  it("reads only company ids — a person id that ends in digits is not an IČO", () => {
    expect(icoFromNodeId("psp:person:6751234")).toBeNull();
    expect(icoFromNodeId("kg:contract:12345678")).toBeNull();
    expect(icoFromNodeId(null)).toBeNull();
  });

  it("edge keys carry the canonical firma key beside the poslanec key", () => {
    expect(edgeEntityKeys("psp:person:1", "kg:company:ico:222222")).toEqual(["poslanec:1", "firma:00222222"]);
  });
});
