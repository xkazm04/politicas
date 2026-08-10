// The /zakony copy catalog, pinned — the same discipline `features/money/messages.test.ts`
// established. LawWatch had no colocated messages test before this file: the batch-017
// §-level sector-attribution block is the first surface here to carry reader-facing prose
// straight from a DERIVED, UNGATED ledger (the `verdictDisposition` sentences), so its own
// key parity, ICU placeholders and Czech-language discipline are pinned explicitly.
import { describe, expect, it } from "vitest";

import csCatalog from "@/messages/cs.json";
import enCatalog from "@/messages/en.json";
import { isCzechSafe } from "@/lib/analysis/language-gate";

type Ns = Record<string, unknown>;

/** Flattens `lawwatch.detail.sectorAttribution.heading` → one dotted key per leaf string. */
function flatten(ns: Ns, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(ns)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") out[key] = v;
    else if (v && typeof v === "object") Object.assign(out, flatten(v as Ns, key));
  }
  return out;
}

const cs = flatten(csCatalog.lawwatch as Ns);
const en = flatten(enCatalog.lawwatch as Ns);
const csOvereni = flatten(csCatalog.overeni as Ns);
const enOvereni = flatten(enCatalog.overeni as Ns);

/** The `t.rich` tags a message declares (`<b>…</b>` → "b"). A tag the component does not
 * supply renders as literal markup, and a tag present in one locale only is a rendering
 * bug that no key-parity check can see. Self-closing/`</…>` forms are normalized away. */
function richTags(s: string): string[] {
  return [...new Set([...s.matchAll(/<\/?([a-zA-Z][\w-]*)\s*\/?>/g)].map((m) => m[1]))].sort();
}

/** Named ICU variables only (`{name}` / `{name, plural, ...}` / `{name, ...}`), not the
 * word-content of a plural's category branches — a naive `\{(\w+)[^}]*\}` scan over
 * `{count, plural, one {tisk} few {tisky} other {tisků}}` would (wrongly) also capture
 * "tisk"/"tisky"/"tisků" as if they were variable names, and the two locales legitimately
 * choose different words per category. This regex anchors on the FIRST token after `{`. */
function variables(s: string): string[] {
  return [...new Set([...s.matchAll(/\{\s*(\w+)[,}]/g)].map((m) => m[1]))].sort();
}

describe("lawwatch message catalog", () => {
  it("cs and en declare exactly the same keys", () => {
    expect(Object.keys(cs).sort()).toEqual(Object.keys(en).sort());
  });

  it("declares the same t.rich tags in both locales", () => {
    for (const k of Object.keys(cs)) {
      expect(richTags(en[k] ?? ""), k).toEqual(richTags(cs[k]));
    }
  });

  it("declares one sector label per token the batch-017 payload actually carries", () => {
    for (const sector of ["economy", "environment", "agriculture", "digital", "health"]) {
      expect(cs[`sector.${sector}`], sector).toBeTruthy();
      expect(en[`sector.${sector}`], sector).toBeTruthy();
    }
  });

  describe("forensicIndex", () => {
    const keys = Object.keys(cs).filter((k) => k.startsWith("forensicIndex."));

    it("is non-empty (the /zakony corpus index section)", () => {
      expect(keys.length).toBeGreaterThan(0);
    });

    it("declares the same ICU variables in both locales", () => {
      for (const k of keys) {
        expect(variables(en[k]), k).toEqual(variables(cs[k]));
      }
    });

    it("declares no empty value in either locale", () => {
      for (const k of keys) {
        expect(cs[k]?.trim(), k).toBeTruthy();
        expect(en[k]?.trim(), k).toBeTruthy();
      }
    });

    it("every sentence passes the Czech-language gate", () => {
      for (const k of keys) {
        // ICU plural/select markup is English BY SPEC (`one`/`few`/`other`), so a short
        // message built out of it scores as English however Czech its branches are. The
        // features/profile precedent applies: skip the key, never loosen the classifier.
        if (/,\s*(plural|select|selectordinal)\s*,/.test(cs[k])) continue;
        expect(isCzechSafe(cs[k]), k).toBe(true);
      }
    });

    it("states the census against the whole corpus in both the complete and partial case", () => {
      for (const k of ["forensicIndex.complete", "forensicIndex.partial"]) {
        expect(variables(cs[k]), k).toEqual(["billsFmt", "verdictsFmt"]);
      }
    });

    it("discloses a withheld verdict AS withheld, never as absent", () => {
      // The corpus's withheld strings stay in the graph; a sentence that reads „chybí"
      // would describe an absence the data does not carry. The one permitted form is
      // the explicit NEGATION — „zadrženo neznamená chybí" denies the absence, which
      // is the disclosure at its strongest, not a violation of it.
      expect(cs["forensicIndex.withheld"]).toMatch(/zadrž/i);
      expect(cs["forensicIndex.withheld"].replace(/neznamená chybí/gi, "")).not.toMatch(/chybí/i);
      expect(en["forensicIndex.withheld"]).toMatch(/withheld/i);
      expect(cs["forensicIndex.withheldNone"]).toMatch(/zadrž/i);
      expect(cs["forensicIndex.withheldBadge"]).toMatch(/zadrž/i);
    });

    it("prints the ordering rule and refuses a severity scale", () => {
      // Ordering by count/print number is neutral; ordering low→high would publish a
      // wrongdoing scale nobody issued. The copy has to say so, because the ordering is
      // invisible otherwise.
      expect(cs["forensicIndex.orderRule"]).toMatch(/řazení/i);
      expect(cs["forensicIndex.orderRule"]).toMatch(/závažnost/i);
      expect(en["forensicIndex.orderRule"]).toMatch(/ordering/i);
    });

    it("has no gate-vocabulary copy of its own — it reads /overeni's", () => {
      // Whatever the register says about the human gate, it says with the ONE
      // vocabulary (features/overeni/gateVocabulary.ts). A second phrasing of a gate
      // state here is how two surfaces start describing one token two ways.
      for (const k of keys) expect(cs[k], k).not.toMatch(/lidskou branou neprochází/);
      for (const k of keys) expect(cs[k], k).not.toMatch(/čeká na lidskou kontrolu/);
      expect(csOvereni["gate.ungated"]).toMatch(/lidsk(ou|é|ou branou)/);
      expect(csOvereni["gate.pendingReview"]).toMatch(/kontrol/i);
    });

    it("does NOT claim the corpus bypasses a gate — the verdicts are stored pending", () => {
      // 2026-08-11: the register printed „deterministické odvození — lidskou branou
      // neprochází" directly beside `pending_review · 141`, i.e. next to the very row
      // that falsifies it. kg-forensics writes every verdict `pending_review` and
      // /dukazy is where those decisions get published, so the register now speaks the
      // PENDING sentence family and points at that path.
      expect(cs["forensicIndex.gateSignOff"]?.trim()).toBeTruthy();
      expect(en["forensicIndex.gateSignOff"]?.trim()).toBeTruthy();
      // The sign-off path is a LINK, in both locales — a bulletin named but not
      // reachable is the citation-you-cannot-follow defect the deník already paid for.
      expect(richTags(cs["forensicIndex.gateSignOff"])).toEqual(["d"]);
      expect(richTags(en["forensicIndex.gateSignOff"])).toEqual(["d"]);
      // …and it says what holds until the decision lands: the stored state.
      expect(cs["forensicIndex.gateSignOff"]).toMatch(/grafu/);
      expect(en["forensicIndex.gateSignOff"]).toMatch(/graph/);
    });

    it("names the stored token as the record and the label as our translation", () => {
      // The row now renders „čeká na lidskou kontrolu (pending_review) · 141": a
      // translated label beside the verbatim token. The note has to say which is which,
      // otherwise „doslovný záznam" describes a sentence we wrote.
      expect(cs["forensicIndex.reviewStateNote"]).toMatch(/doslovn/i);
      expect(cs["forensicIndex.reviewStateNote"]).toMatch(/závorce/i);
      expect(en["forensicIndex.reviewStateNote"]).toMatch(/verbatim/i);
    });

    it("wraps the census figure in the citable tag, in both locales", () => {
      // The number in this sentence is what gets quoted, so it carries its own
      // permanent address (features/lawwatch/lawClaims.ts). The <v> tag is where
      // ForensicIndexSection mounts <CitableNumber>; without it in a locale, that
      // locale would render the figure with no claim payload at all.
      for (const k of ["forensicIndex.complete", "forensicIndex.partial"]) {
        expect(richTags(cs[k]), k).toEqual(["v"]);
        expect(richTags(en[k]), k).toEqual(["v"]);
        expect(cs[k], k).toMatch(/<v>\{verdictsFmt\}<\/v>/);
        expect(en[k], k).toMatch(/<v>\{verdictsFmt\}<\/v>/);
      }
    });

    it("carries no internal pipeline jargon in reader-facing copy", () => {
      for (const k of keys) {
        // The `source*` keys name the graph pass as a citable artifact id, the same way
        // `graphPass` does — the deliberate exception, as in sectorAttribution.source.
        if (k.startsWith("forensicIndex.source")) continue;
        expect(cs[k], k).not.toMatch(/\bdávka\s*\d/i);
        expect(cs[k], k).not.toMatch(/\bbatch\b|\bpass\s*\d/i);
      }
    });
  });

  describe("detail.sectorAttribution", () => {
    const keys = Object.keys(cs).filter((k) => k.startsWith("detail.sectorAttribution."));

    it("is non-empty (the block this file exists to pin)", () => {
      expect(keys.length).toBeGreaterThan(0);
    });

    it("declares the same ICU variables in both locales", () => {
      for (const k of keys) {
        expect(variables(en[k]), k).toEqual(variables(cs[k]));
      }
    });

    it("every sentence passes the Czech-language gate", () => {
      for (const k of keys) {
        expect(isCzechSafe(cs[k]), k).toBe(true);
      }
    });

    it("never renders a bare neutral lead: an ungated label exists beside the disposition", () => {
      // 2026-08-06: the ungated label is no longer a second copy under the lawwatch
      // namespace — BillDetail.tsx imports GATE_UNGATED_KEY from
      // features/overeni/gateVocabulary.ts and reads it from the `overeni` catalog, so this
      // catalog no longer declares `detail.sectorAttribution.ungated` at all.
      expect(cs["detail.sectorAttribution.ungated"]).toBeUndefined();
      expect(en["detail.sectorAttribution.ungated"]).toBeUndefined();
      expect(csOvereni["gate.ungated"]).toMatch(/lidsk(ou|é|ou branou)/);
      expect(enOvereni["gate.ungated"]).toMatch(/human gate/);
    });

    it("discloses a withheld disposition instead of silently dropping the flag", () => {
      // 2026-08-06 fix: a flag whose verdictDisposition fails the Czech/jargon gate is no
      // longer dropped whole (sectorAttribution.ts no longer returns null on that gate) — it
      // renders with company/sector/statute plus this sentence in place of the prose.
      expect(cs["detail.sectorAttribution.dispositionWithheld"]).toBeTruthy();
      expect(en["detail.sectorAttribution.dispositionWithheld"]).toBeTruthy();
      expect(cs["detail.sectorAttribution.dispositionWithheld"]).toMatch(/brán|zadrž/);
      expect(en["detail.sectorAttribution.dispositionWithheld"]).toMatch(/gate|withheld/);
    });

    it("states why a row has no §-list instead of silently omitting it", () => {
      expect(cs["detail.sectorAttribution.noParagraphsCensus"]).toBeTruthy();
      expect(cs["detail.sectorAttribution.noParagraphsFallback"]).toBeTruthy();
      expect(en["detail.sectorAttribution.noParagraphsCensus"]).toBeTruthy();
      expect(en["detail.sectorAttribution.noParagraphsFallback"]).toBeTruthy();
    });

    it("carries no internal pipeline jargon (batch/pass tokens) in reader-facing copy", () => {
      for (const k of keys) {
        // "dávka 017" inside the SourceNote citation is a deliberate exception — it names the
        // batch as a citable artifact id, the same way `graphPass`/`kg-pass:NN` do elsewhere.
        if (k === "detail.sectorAttribution.source") continue;
        expect(cs[k], k).not.toMatch(/\bdávka\s*\d/i);
        expect(cs[k], k).not.toMatch(/\bbatch\b|\bpass\s*\d/i);
      }
    });
  });

  /*
   * THE TRIANGLE (2026-08-10) — law ↔ money ↔ deník. Every key below exists because a
   * surface started NAMING an entity that lives on another surface, and the copy has to
   * carry the rule that link rests on. They are pinned together because they fail
   * together: a missing key here renders as `MISSING_MESSAGE` inside a conflict block,
   * i.e. as a defect on the most trust-sensitive text the app publishes.
   */
  describe("the law ↔ money ↔ deník triangle", () => {
    const triangleKeys = [
      "detail.conflictAttribution",
      "detail.conflictMoneyFiles",
      "detail.conflictMoneyFileAria",
      "detail.conflictStrety",
      "detail.sectorAttribution.sponsorLabel",
      "detail.sectorAttribution.companyFileAria",
      "collisions.denikLink",
      "dossierPage.crumb",
      "registry.emptyLabel",
      "registry.emptyText",
      "dependencies.title",
      "mockNoProfileLink",
    ];

    it("declares every key in both locales, non-empty", () => {
      for (const k of triangleKeys) {
        expect(cs[k]?.trim(), k).toBeTruthy();
        expect(en[k]?.trim(), k).toBeTruthy();
      }
    });

    it("declares the same ICU variables in both locales", () => {
      for (const k of triangleKeys) expect(variables(en[k]), k).toEqual(variables(cs[k]));
    });

    it("every Czech sentence passes the Czech-language gate", () => {
      for (const k of triangleKeys) {
        if (/,\s*(plural|select|selectordinal)\s*,/.test(cs[k])) continue;
        expect(isCzechSafe(cs[k]), k).toBe(true);
      }
    });

    it("names the entity in each accessible label — a link list of bare names is unusable", () => {
      // Every one of these is the accessible name of an icon-or-name-only link that sits in a
      // list of its siblings; without the entity in it, a screen reader hears N identical links.
      expect(variables(cs["detail.conflictMoneyFileAria"])).toEqual(["name"]);
      expect(variables(cs["detail.sectorAttribution.companyFileAria"])).toEqual(["company"]);
      expect(variables(cs["collisions.denikLink"])).toEqual(["cislo"]);
    });

    it("states the attribution rule the conflict flag's number does NOT follow", () => {
      // The stored figure is the worst case among sponsors and sums EVERY tied company,
      // stewardship seats included; /penize attributes an institution's money to the
      // institution. Linking the money file without saying so publishes two different
      // numbers for one person and lets the reader assume the bigger one is the MP's.
      expect(cs["detail.conflictAttribution"]).toMatch(/instituc/i);
      expect(cs["detail.conflictAttribution"]).toMatch(/nikdy poslanci/i);
      expect(en["detail.conflictAttribution"]).toMatch(/institution/i);
    });

    it("keeps the dossier crumb's back-link on the register segment only", () => {
      // The crumb reads „/ zákony / tisk"; only „zákony" may be the link to /zakony —
      // wrapping the whole string would claim „tisk" leads to the overview too.
      expect(richTags(cs["dossierPage.crumb"])).toEqual(["m"]);
      expect(richTags(en["dossierPage.crumb"])).toEqual(["m"]);
      expect(cs["dossierPage.crumb"]).toMatch(/<m>zákony<\/m>/);
    });

    it("says WHY a sample MP's name is not a link", () => {
      // The mock ids are slugs and /poslanec is keyed by mandate number, so every such link
      // 404s. Withdrawing it silently would read as an oversight; the copy owns the rule.
      expect(cs["mockNoProfileLink"]).toMatch(/smyšlen/i);
      expect(en["mockNoProfileLink"]).toMatch(/invented/i);
    });

    it("states an empty statute register as a state of the record, never as a finding", () => {
      expect(cs["registry.emptyText"]).toMatch(/evidence/i);
      expect(cs["registry.emptyText"]).toMatch(/nedomýšlí|nic si/i);
    });

    it("carries no internal pipeline jargon in reader-facing copy", () => {
      for (const k of triangleKeys) {
        expect(cs[k], k).not.toMatch(/\bdávka\s*\d/i);
        expect(cs[k], k).not.toMatch(/\bbatch\b|\bpass\s*\d/i);
      }
    });
  });

  describe("the dropped-pair disclosure (/zakony/kolize)", () => {
    // A limit that drops a row has to say how many (the /denik `droppedImplausible`
    // precedent). The RULE was already printed under the stat strip; the COUNT was not,
    // so four figures read as the whole close-read output rather than its surviving part.
    const k = "collisions.incidentalDropped";

    it("exists in both locales and counts in both", () => {
      expect(cs[k]?.trim()).toBeTruthy();
      expect(en[k]?.trim()).toBeTruthy();
      expect(variables(cs[k])).toEqual(variables(en[k]));
      expect(variables(cs[k])).toEqual(["count", "countFmt"]);
    });

    it("states the reason for the drop, and that the dropped rows count towards nothing", () => {
      expect(cs[k]).toMatch(/jiný zákon/i);
      expect(cs[k]).toMatch(/nepočítají/i);
      expect(en[k]).toMatch(/different statute/i);
    });

    it("calls it noise, never a finding", () => {
      expect(cs[k]).toMatch(/nejde o nález|není nález/i);
      expect(en[k]).toMatch(/not a finding/i);
    });
  });
});
