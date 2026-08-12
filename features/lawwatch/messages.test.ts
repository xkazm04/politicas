// The /zakony copy catalog, pinned — the same discipline `features/money/messages.test.ts`
// established. LawWatch had no colocated messages test before this file: the batch-017
// §-level sector-attribution block is the first surface here to carry reader-facing prose
// straight from a DERIVED, UNGATED ledger (the `verdictDisposition` sentences), so its own
// key parity, ICU placeholders and Czech-language discipline are pinned explicitly.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import csCatalog from "@/messages/cs.json";
import enCatalog from "@/messages/en.json";
import { isCzechSafe } from "@/lib/analysis/language-gate";
import { FORENSIC_CONFIDENCE_SCALE } from "./lawClaims";

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

/** Every `{…}` group at the TOP nesting level of `s`, returned as its inner text. */
function topLevelArgs(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = -1;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "{") {
      if (depth === 0) start = i + 1;
      depth++;
    } else if (s[i] === "}") {
      depth--;
      if (depth === 0 && start >= 0) out.push(s.slice(start, i));
    }
  }
  return out;
}

/**
 * Named ICU variables only (`{name}` / `{name, plural, …}`), never the word-content of a
 * plural's category branches: the two locales legitimately choose different words per
 * category, and a Czech branch may be a whole clause.
 *
 * This USED to be one regex anchored on the first token after `{` — and it silently did
 * not work in English. „one {batch}" is itself a `{word}` group, so it was captured as a
 * variable named `batch`; the Czech side dodged it only by accident, because `\w` does
 * not match „á" and so „{dávka}" never matched at all. Two locales were therefore
 * compared under two different rules. The parser below walks brace depth instead: a
 * plural's branch BODIES are recursed into (a `{countFmt}` inside a branch is a real
 * variable) while the branch keywords and their prose are not.
 */
function variables(s: string): string[] {
  const names = new Set<string>();
  for (const arg of topLevelArgs(s)) {
    const head = /^\s*(\w+)\s*(,|$)/.exec(arg);
    if (!head) continue;
    names.add(head[1]);
    const rest = arg.slice(head[0].length);
    const kind = /^\s*(plural|select|selectordinal)\s*,/.exec(rest);
    if (!kind) continue;
    for (const branch of topLevelArgs(rest.slice(kind[0].length))) {
      for (const v of variables(branch)) names.add(v);
    }
  }
  return [...names].sort();
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

  /*
   * ONE JARGON GATE OVER THE WHOLE NAMESPACE, IN BOTH LOCALES.
   *
   * There were three of these checks before (forensicIndex.*, detail.sectorAttribution.*,
   * the triangle key list) — each over its own handful of keys, each cs-only, and none of
   * them able to match the Czech phrase at all: `/\bbatch\b|\bpass\s*\d/i` never fires on
   * „průchod grafu 20". Three keys therefore hardcoded a pass number for months on the
   * three most-read law surfaces, in both languages.
   *
   * WHAT IS BANNED IS A LITERAL DIGIT after a pipeline word. `{pass}` / `{batch}` are
   * fine and deliberate — they name a citable artifact id the surface derives at render
   * time, which is the whole difference between a citation and a stale number.
   */
  describe("pipeline jargon", () => {
    const JARGON = [
      /pr[ůu]chod\w*\s+grafu\s*\d/i, // „průchod grafu 20"
      /graph\s+pass\w*\s*\d/i, // "graph pass 20"
      /\bpass\s*\d/i, // bare "pass 20"
      /d[áa]vk\w*\s*\d/i, // „dávka 017" / „dávky 3"
      /\bbatch\w*\s*\d/i, // "batch 017"
    ];

    /**
     * The ONE sanctioned exception, and it was already documented twice in this file:
     * the sector-attribution citation names batch 017 as a citable ARTIFACT ID, the way
     * `graphPass` names a pass. Everything else must interpolate or say nothing.
     */
    const ARTIFACT_ID_KEYS = new Set(["detail.sectorAttribution.source"]);

    it("no key hardcodes a pass or batch NUMBER, in either locale", () => {
      for (const [loc, ns] of [
        ["cs", cs],
        ["en", en],
      ] as const) {
        for (const [k, v] of Object.entries(ns)) {
          if (ARTIFACT_ID_KEYS.has(k)) continue;
          for (const rx of JARGON) {
            expect(v, `${loc}.${k} hardcodes a pipeline number — ${rx}`).not.toMatch(rx);
          }
        }
      }
    });

    it("the gate can actually see the Czech phrase (the old regex could not)", () => {
      // Falsification of the gate itself: the pattern set must reject the exact string
      // that survived three narrower checks, and must accept the interpolated form.
      const fire = (s: string) => JARGON.some((rx) => rx.test(s));
      expect(fire("census plného textu (průchod grafu 20)")).toBe(true);
      expect(fire("full-text census (graph pass 20)")).toBe(true);
      expect(fire("sektorová atribuce (dávka 017)")).toBe(true);
      expect(fire("psp.cz tisky · průchod grafu {pass}")).toBe(false);
      expect(fire("dávka {batch} · {method}")).toBe(false);
      expect(fire("{batches, plural, one {# dávka} few {# dávky} other {# dávek}}")).toBe(false);
    });
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

  /*
   * FORENZNÍ BLOK (/zakony/<cislo>). Od 2026-08-12 nese jistota posudku vlastní
   * trvalou adresu (features/lawwatch/lawClaims.ts). Nový KLÍČ k tomu nevznikl a
   * to je záměr — číslo se sází mimo větu (`<CitableNumber>/5` v hlavičce bloku),
   * ne značkou uvnitř zprávy, takže žádný překlad nemůže figuru od jejího claimu
   * odtrhnout. Zbývá jediné, co se rozejít MŮŽE: stupnice.
   */
  describe("forensic (per-bill verdict block)", () => {
    const keys = Object.keys(cs).filter((k) => k.startsWith("forensic."));

    it("is non-empty and declares no empty value in either locale", () => {
      expect(keys.length).toBeGreaterThan(0);
      for (const k of keys) {
        expect(cs[k]?.trim(), k).toBeTruthy();
        expect(en[k]?.trim(), k).toBeTruthy();
      }
    });

    it("declares the same ICU variables in both locales", () => {
      for (const k of keys) expect(variables(en[k]), k).toEqual(variables(cs[k]));
    });

    it("keeps the confidence figure OUT of the sentence that labels it", () => {
      // `forensic.confidenceLabel` is a label, not a sentence with a number in it:
      // the figure is rendered beside it as <CitableNumber>, so the claim payload
      // cannot be lost by a locale that reorders or drops a placeholder.
      expect(variables(cs["forensic.confidenceLabel"])).toEqual([]);
      expect(variables(en["forensic.confidenceLabel"])).toEqual([]);
      expect(richTags(cs["forensic.confidenceLabel"])).toEqual([]);
    });

    it("prints the SAME confidence scale the code declares, in both locales", () => {
      // The scale lives in lawClaims.ts (it sets both the visible „x/5" and the
      // claim's unit „z 5"). This sentence repeats it as a literal in both
      // catalogs — a drift here would publish two different scales for one number.
      for (const [loc, cat] of [["cs", cs], ["en", en]] as const) {
        expect(cat["forensic.notClaim2WithConfidence"], loc).toContain(
          `/${FORENSIC_CONFIDENCE_SCALE}`,
        );
        expect(variables(cat["forensic.notClaim2WithConfidence"]), loc).toEqual([
          "confidence",
          "severity",
        ]);
      }
    });

    it("every Czech sentence passes the Czech-language gate", () => {
      for (const k of keys) {
        if (/,\s*(plural|select|selectordinal)\s*,/.test(cs[k])) continue;
        expect(isCzechSafe(cs[k]), k).toBe(true);
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

  /*
   * ČÍSLO V ČESKÉ VĚTĚ SE SKLOŇUJE. Tři počítající věty /zakony/kolize sázely tvar
   * natvrdo — „{batches} dávky" nad živou hodnotou 11 („dávek"), „{clusters} shluků"
   * rozbité na jedničce, „U {count}× dvojice" úplně mimo. Vzor je
   * `collisions.incidentalDropped`, který to už dělá správně: `count` vybírá tvar,
   * `countFmt` nese číslo naformátované lib/format.ts (ICU `#` by formátovalo samo a
   * obešlo by jediné místo, kde se o českém formátu rozhoduje).
   */
  describe("counting sentences decline", () => {
    const PLURALIZED = [
      "collisions.statsSource",
      "collisions.clustersAside",
      "collisions.czechPending",
      "collisions.incidentalDropped",
      "section2Capped",
    ];

    it("selects a form with ICU plural in both locales", () => {
      for (const k of PLURALIZED) {
        expect(cs[k], `cs.${k}`).toMatch(/,\s*plural\s*,/);
        expect(en[k], `en.${k}`).toMatch(/,\s*plural\s*,/);
      }
    });

    it("gives Czech all three categories, and English two", () => {
      for (const k of PLURALIZED) {
        for (const cat of ["one", "few", "other"]) {
          expect(cs[k], `cs.${k} missing the ${cat} branch`).toMatch(
            new RegExp(`\\b${cat}\\s*\\{`),
          );
        }
        for (const cat of ["one", "other"]) {
          expect(en[k], `en.${k} missing the ${cat} branch`).toMatch(
            new RegExp(`\\b${cat}\\s*\\{`),
          );
        }
      }
    });

    it("declares the same ICU variables in both locales", () => {
      for (const k of PLURALIZED) expect(variables(en[k]), k).toEqual(variables(cs[k]));
    });

    it("formats the number through lib/format.ts, never through ICU's own #", () => {
      // A `#` would let intl-messageformat format the figure, i.e. a second place where
      // Czech number formatting is decided. Every one of these carries a `*Fmt` sibling.
      for (const k of PLURALIZED) {
        expect(cs[k], `cs.${k} uses ICU #`).not.toContain("#");
        expect(en[k], `en.${k} uses ICU #`).not.toContain("#");
        expect(variables(cs[k]).some((v) => v.endsWith("Fmt")), `cs.${k}`).toBe(true);
      }
    });
  });

  describe("a surface that cannot name its pass says so", () => {
    it("declares a no-pass sibling for every pass citation the index renders", () => {
      for (const ns of [cs, en]) {
        for (const [withPass, without] of [
          ["statsSource", "statsSourceNoPass"],
          ["graphPassSource", "graphPassSourceNoPass"],
          ["forensicIndex.source", "forensicIndex.sourceNoPass"],
        ] as const) {
          expect(ns[withPass], withPass).toBeTruthy();
          expect(ns[without], without).toBeTruthy();
          // The no-pass form may not carry the placeholder — a `?` in its slot was the
          // defect: „průchod grafu ?" is a citation asserting a pass we do not have.
          expect(variables(ns[without]), without).not.toContain("pass");
        }
      }
    });

    it("keeps the committee figure in the no-pass form of the stat citation", () => {
      // Dropping the pass may not drop the sentence's other number with it.
      for (const ns of [cs, en]) {
        expect(variables(ns["statsSourceNoPass"])).toEqual(["committeeRouted"]);
      }
    });
  });

  describe("§02 discloses its cap and offers the register", () => {
    it("declares both keys in both locales", () => {
      for (const ns of [cs, en]) {
        expect(ns["section2Capped"]?.trim()).toBeTruthy();
        expect(ns["section2RegistryLink"]?.trim()).toBeTruthy();
        expect(variables(ns["section2RegistryLink"])).toEqual([]);
      }
    });

    it("states that the list is cut, not the whole population", () => {
      expect(cs["section2Capped"]).toMatch(/useknut|není úplný|ne úplný/i);
      expect(en["section2Capped"]).toMatch(/capped|not complete/i);
    });
  });

  it("declares no key with zero call sites (lawwatch.back is gone)", () => {
    // `back` had no consumer anywhere in app/ or features/ — a dead key in two
    // catalogs reads as an affordance the surface owes the reader.
    expect(cs["back"]).toBeUndefined();
    expect(en["back"]).toBeUndefined();
  });

  it("the collision pair card labels the PUBLIC print number and links it", () => {
    // `printInternal` („tisk {tiskId}") is the message for the graph's internal id.
    // /zakony/kolize passed it `pair.billA`, which is the public číslo — the same value
    // the excerpt caption two rows below already passes as `cislo`, and the key
    // /zakony/<cislo> is addressed by. Source-grep, in the publicWire.test.ts pattern:
    // this repo has no jsdom, so the wiring is pinned where it can be.
    const page = readFileSync("features/lawwatch/CollisionsPage.tsx", "utf8");
    expect(page).not.toContain("printInternal");
    expect(page).toContain("href={`/zakony/${pair.billA}`}");
    expect(page).toContain("href={`/zakony/${pair.billB}`}");
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
