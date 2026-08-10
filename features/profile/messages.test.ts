// The /poslanec copy catalog, pinned — the discipline `features/civicscore/
// messages.test.ts` established, applied to the surface politicas.md calls "the real
// product". The spis had no such test while carrying ~120 keys, and the three failures
// pinned below are the ones its own history has already produced elsewhere: a key added
// in Czech and forgotten in English, a plural placeholder that drifts between locales,
// and a sentence that asserts a review state the data no longer supports.

import { describe, expect, it } from "vitest";

import csCatalog from "@/messages/cs.json";
import enCatalog from "@/messages/en.json";
import { scoreLanguage } from "@/lib/analysis/language-gate";

const cs = csCatalog.profile as unknown as Record<string, string>;
const en = enCatalog.profile as unknown as Record<string, string>;

const placeholders = (s: string): string[] =>
  [...new Set([...s.matchAll(/\{(\w+)[^}]*\}/g)].map((m) => m[1]))].sort();

/** `<own>…</own>` — the rich-text tags `t.rich` must find in BOTH catalogs. */
const tags = (s: string): string[] =>
  [...new Set([...s.matchAll(/<(\w+)>/g)].map((m) => m[1]))].sort();

describe("profile message catalog", () => {
  it("cs and en declare exactly the same keys", () => {
    expect(Object.keys(cs).sort()).toEqual(Object.keys(en).sort());
  });

  it("no key is empty in either locale", () => {
    for (const [k, v] of Object.entries(cs)) expect(v.trim(), `cs.${k}`).not.toBe("");
    for (const [k, v] of Object.entries(en)) expect(v.trim(), `en.${k}`).not.toBe("");
  });

  it("each key declares the same ICU placeholders and rich tags in both locales", () => {
    for (const k of Object.keys(cs)) {
      expect(placeholders(en[k]), k).toEqual(placeholders(cs[k]));
      expect(tags(en[k]), k).toEqual(tags(cs[k]));
    }
  });

  it("does not assert that every money tie is still pending", () => {
    // The gate can be written now (/penize/kontrola), so any sentence claiming the
    // whole corpus is unreviewed becomes false on the first confirmation. The section
    // renders per-tie state from the data instead; the copy may only say that an
    // UNDECIDED tie is not a finding.
    //
    // The regex used to require a DIGIT, and that is exactly how `absenteeFlagQualifier`
    // („…vazeb, které VŠECHNY čekají na lidskou kontrolu…") lived here until 2026-08-11:
    // an absolute with no number in it is the same false claim, falsifiable by one
    // console decision. So the check is now on the SHAPE of the claim — an absolute
    // quantifier + ties + a review word — with or without a figure.
    const absoluteReviewClaim = (v: string): boolean => {
      const s = v.toLowerCase();
      const absolute = /\b(všechn\w*|všech|vešker\w*|all|every|none of)\b/.test(s);
      const ties = /(vazb\w*|vazeb|hran\w*|\bties\b|\bedges\b)/.test(s);
      const review = /(kontrol\w*|čeká\w*|čekaj\w*|bran\w*|pending|review\w*|await\w*|gate)/.test(s);
      return absolute && ties && review;
    };
    // Sentences the review derivation SELECTS may state an absolute, because the state
    // that would falsify one renders a different key (features/money/reviewSummary.ts —
    // the /penize + /dashboard precedent). Nothing else on this page may.
    const DERIVED_GATE_KEYS = new Set([
      "absenteeFlagGateAllPending",
      "absenteeFlagGateMixed",
      "absenteeFlagGateAllDecided",
      "absenteeFlagGateEmpty",
      "absenteeFlagGateUnavailable",
    ]);
    for (const ns of [cs, en]) {
      for (const [k, v] of Object.entries(ns)) {
        expect(v, `${k} asserts a whole-corpus review state`).not.toMatch(
          /(všechny|všech) \d+ vazeb|all \d+ ties/i,
        );
        if (DERIVED_GATE_KEYS.has(k)) continue;
        expect(absoluteReviewClaim(v), `${k} states an absolute about the human gate`).toBe(false);
      }
    }
  });

  it("the absentee flag reports the gate state per phase, and never guesses it", () => {
    // One sentence per phase of `reviewSummary()`, plus the one state that is NOT a
    // phase: the money layer being unreadable. „Unread" and „unreviewed" must never
    // render as the same sentence (the moneyUnavailable rule, applied to the header).
    for (const ns of [cs, en]) {
      for (const k of [
        "absenteeFlagGateAllPending",
        "absenteeFlagGateMixed",
        "absenteeFlagGateAllDecided",
        "absenteeFlagGateEmpty",
        "absenteeFlagGateUnavailable",
      ]) {
        expect(ns[k], k).toBeTruthy();
      }
      expect(ns.absenteeFlagGateEmpty).not.toBe(ns.absenteeFlagGateUnavailable);
    }
    // The counted phases carry the counts they rest on; the two uncounted ones must
    // not pretend to (a placeholder there would render a bare zero as a fact).
    expect(placeholders(cs.absenteeFlagGateAllPending)).toEqual(["total"]);
    expect(placeholders(cs.absenteeFlagGateMixed)).toEqual(
      ["decided", "pending", "rejected", "total", "verified"],
    );
    expect(placeholders(cs.absenteeFlagGateAllDecided)).toEqual(["rejected", "total", "verified"]);
    expect(placeholders(cs.absenteeFlagGateEmpty)).toEqual([]);
    expect(placeholders(cs.absenteeFlagGateUnavailable)).toEqual([]);
  });

  it("the electoral term is a variable, never a digit in the copy", () => {
    // /zebricek (b9731c5) and /penize (dd71582) each shipped a literal „9. období"
    // over a loader reading PSP10 and each had to fix it separately. Here the number
    // comes from `termNumberOf(TERM)` — so the catalogs must not carry one at all,
    // and there must be a sentence for a term code the loader cannot parse.
    for (const ns of [cs, en]) {
      expect(placeholders(ns.periodNote)).toEqual(["term"]);
      expect(ns.periodNoteUnknown, "a term with no number still needs a sentence").toBeTruthy();
      expect(placeholders(ns.periodNoteUnknown)).toEqual([]);
      for (const [k, v] of Object.entries(ns)) {
        expect(v, `${k} hard-codes an electoral term number`).not.toMatch(
          /\b\d+\.\s*(volební\s+)?období\b|\b\d+(st|nd|rd|th)\s+parliamentary\s+term\b/i,
        );
      }
    }
  });

  it("every disclosed cap says what it is capping and out of how many", () => {
    // The ally list was the last silent cap on the page (getProfileData `.slice(0, 8)`).
    for (const ns of [cs, en]) {
      expect(ns.alliesMore, "the ally cap must be disclosed").toBeTruthy();
      expect(placeholders(ns.alliesMore)).toEqual(["shown", "total"]);
    }
  });

  it("the money figure and the score both offer a human verification address", () => {
    for (const ns of [cs, en]) {
      expect(ns.moneyVerifyFigure).toBeTruthy();
      expect(ns.verifyScore).toBeTruthy();
      expect(ns.moneyReceiptLink).toBeTruthy();
      expect(ns.moneyCompanyLink).toBeTruthy();
    }
  });

  it("every empty/unavailable state has copy in both locales", () => {
    // The distinction these keys carry is the brand rule itself: „we found nothing"
    // and „we could not read" must never render as the same sentence.
    for (const ns of [cs, en]) {
      for (const k of [
        "moneyEmptyTitle",
        "moneyEmptyBody",
        "moneyUnavailableTitle",
        "moneyUnavailableBody",
        "rebelInstancesNone",
        "rebelInstancesUnavailable",
        "rebelInstancesPending",
      ]) {
        expect(ns[k], k).toBeTruthy();
      }
    }
  });

  it("the cross-term analyst note can be dated or say it is not", () => {
    // `effort_psp9_trend_note` renders verbatim; its citation must be able to
    // state BOTH states, because a note without `effort_provenance.computedAt`
    // is never dated to today (the LowScoreReasonChip rule).
    for (const ns of [cs, en]) {
      expect(ns.trendNoteHeading).toBeTruthy();
      expect(ns.trendNoteSource).toBeTruthy();
      expect(ns.trendNoteSourceDated).toBeTruthy();
    }
    expect(placeholders(cs.trendNoteSourceDated)).toEqual(["date"]);
    expect(placeholders(cs.trendNoteSource)).toEqual([]);
  });

  it("the interpellation figure admits it is a sum, and promises no split", () => {
    // The graph carries ONE `interpellations` prop — ingest sums written (tisky
    // druh 6) and oral (interp.zip) before writing it. The page may say the split
    // is unavailable; it may never render a number for either half.
    for (const ns of [cs, en]) {
      expect(ns.dossierInterpellationsComposition, "composition copy").toBeTruthy();
      expect(placeholders(ns.dossierInterpellationsComposition)).toEqual([]);
    }
  });

  it("no Czech sentence reads as English", () => {
    // The same stopword gate the analysis copy is held to, asserted the way that gate
    // is actually defined: `looksEnglish`. It is deliberately NOT the inverse claim —
    // a citation like „registr smluv ⋈ ares ⋈ hlídač — klíč: IČO" carries no stopwords
    // at all, and demanding a positive Czech verdict from a keyword list would fail on
    // strings that are perfectly correct. What must never happen is an English
    // sentence sitting in the Czech catalog.
    for (const [k, v] of Object.entries(cs)) {
      // ICU plural/select markup is English BY SPEC (`one` / `few` / `other`), so a
      // message built out of it scores as English no matter how Czech its sentences
      // are. Those keys are skipped rather than the classifier being loosened for
      // everyone — the branch bodies are pinned by the placeholder test above.
      if (/,\s*(plural|select|selectordinal)\s*,/.test(v)) continue;
      // Citations are not prose either: a source note is a JOIN of dataset names,
      // column names and module paths („zdroj: absentee_manager_lead
      // (lib/analysis/contribution.ts)…"), and every identifier in it is English by
      // construction. The measured lesson from /penize is the same one — the gate
      // binds the copy WE write, not the evidence we show.
      if (/(Source|Aside)$/.test(k)) continue;
      // ICU PLACEHOLDER NAMES are identifiers, not copy: `{total}` / `{verified}` /
      // `{rejected}` / `{pending}` are four of this classifier's own English stopwords,
      // so a perfectly Czech sentence built around them scored 4 English words out of 17
      // and failed (measured on `absenteeFlagGateMixed`, 2026-08-11). The prose is what
      // the gate binds, so the prose is what it reads — the same distinction the two
      // skips above make, applied inside the sentence instead of to the whole key. The
      // length check already ran on this stripped form.
      const prose = v.replace(/\{[^}]*\}/g, " ");
      if (prose.split(/\s+/).filter(Boolean).length < 8) continue;
      expect(scoreLanguage(prose).looksEnglish, `cs.${k}: ${v.slice(0, 60)}`).toBe(false);
    }
  });
});
