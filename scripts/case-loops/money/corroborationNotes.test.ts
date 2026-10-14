import { describe, expect, it } from "vitest";
import { dataorMatchNote, dataorNoMatchNote, prakConfidenceNote } from "./corroborationNotes";

/* Licence-and-privacy-by-construction: the adapter header promises a birth date is a matching key
 * only and "never surfaces". The first batch's notes interpolated the roster date into stored
 * prose (reviewer_note, dataor_check.note, the PRaK confidence note). The builders now take no
 * date parameter; these tests pin that no ISO date can appear in any branch. */
const ISO = /\b\d{4}-\d{2}-\d{2}\b/;
const span = { roleLabel: "člen představenstva", from: null, to: null };

describe("corroboration notes carry no birth date", () => {
  it("match note", () => {
    const n = dataorMatchNote({ datasetId: "ds-1", span, spisovaZnacka: "B 123", termsNote: "" });
    expect(n).not.toMatch(ISO);
    expect(n).toContain("shoda data narození");
    expect(n).toContain("?→trvá");
  });
  it.each([[true, 0], [true, 3], [false, 0]])("no-match note (known=%s, thin=%i)", (rosterBirthKnown, officersWithoutBirthdate) => {
    expect(dataorNoMatchNote({ datasetId: "ds-1", rosterBirthKnown, officersWithoutBirthdate })).not.toMatch(ISO);
  });
  it.each([true, false])("PRaK confidence note (confirmed=%s)", (identityConfirmed) => {
    const n = prakConfidenceNote({ identityConfirmed, entries: 2, role: "jednatel", from: "2007-01-01", to: null });
    // the role span's own dates are public-role facts and stay; no third date may appear
    expect((n.match(new RegExp(ISO, "g")) ?? []).length).toBeLessThanOrEqual(1);
    expect(n).not.toContain("1970");
  });
});
