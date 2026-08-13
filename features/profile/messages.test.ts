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
    //
    // THE GUARD ITSELF WAS DEAD until 2026-08-12, and it let three literals through
    // („10. období" ×2, „PSP10"). Two reasons, both worth keeping in view:
    //   • `období\b` — JS `\b` is ASCII-only, so „í" is a NON-word character; the
    //     boundary then requires a word character right after „období", and every
    //     real occurrence is followed by „)" or „,". The trailing anchor is gone.
    //   • the English alternative demanded the words „parliamentary term", while
    //     the en catalog wrote „10th term". Both orders are matched now, plus the
    //     term CODE (`PSP10`), which is a term literal in machine clothing.
    const TERM_LITERAL =
      /\b\d+\.\s*(volební\s+)?období|\b\d+\s*(st|nd|rd|th)\s+(parliamentary\s+)?term\b|\bterm\s+\d+\b|\bPSP\s?-?\d+\b/i;
    for (const ns of [cs, en]) {
      expect(placeholders(ns.periodNote)).toEqual(["term"]);
      expect(ns.periodNoteUnknown, "a term with no number still needs a sentence").toBeTruthy();
      expect(placeholders(ns.periodNoteUnknown)).toEqual([]);
      // The tenure citation follows the same two-key shape as the period note.
      expect(placeholders(ns.tenureSource)).toEqual(["term"]);
      expect(ns.tenureSourceUnknownTerm, "an unparseable term code still needs a citation").toBeTruthy();
      expect(placeholders(ns.tenureSourceUnknownTerm)).toEqual([]);
      for (const [k, v] of Object.entries(ns)) {
        expect(v, `${k} hard-codes an electoral term number`).not.toMatch(TERM_LITERAL);
      }
    }
  });

  it("no sentence hard-codes a DATE — a date is interpolated from the data or absent", () => {
    // `committeeCountNote` said „Od 29. 7. 2026 počítají obě čísla TÉŽ…" — the date of a
    // CODE CHANGE, typed into per-MP copy, describing something the data does not carry:
    // no node, no edge and no pass records when the committee formula was corrected, so
    // nothing on this page can ever falsify or refresh that sentence. The term-literal
    // guard right above cannot see a date (its regexes are about „N. období"), which is
    // exactly why this one exists.
    //
    // Every legitimate date on the spis arrives as an ICU parameter and is formatted by
    // lib/format for the reader's locale (`seatsAsOf`, `trendNoteSourceDated`,
    // `careerSource`…). A LITERAL date is therefore always one of two things: a claim
    // about our own history, or a value that stopped being read from the data.
    const DATE_LITERALS: RegExp[] = [
      /\b\d{1,2}\.\s*\d{1,2}\.\s*\d{4}\b/, // 29. 7. 2026
      /\b\d{4}-\d{2}-\d{2}\b/, // 2026-07-29
      /\b\d{1,2}(st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\b/i,
      /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(st|nd|rd|th)?,?\s+\d{4}\b/i,
      /\b\d{1,2}\.\s*(ledna|února|března|dubna|května|června|července|srpna|září|října|listopadu|prosince)\s+\d{4}\b/i,
    ];
    for (const ns of [cs, en]) {
      for (const [k, v] of Object.entries(ns)) {
        for (const re of DATE_LITERALS) {
          expect(v, `${k} hard-codes a date instead of interpolating one`).not.toMatch(re);
        }
      }
    }
  });

  it("the empty rebellion state names the floor that produced it", () => {
    // `rebels_against` is only emitted above `MIN_ELIGIBLE_VOTES` (lib/analysis/kg.ts),
    // and an MP ABOVE the floor who never broke the line still gets an edge (rate 0,
    // rendered as a row). So an empty section means „below the floor", never „this MP
    // never deviated" — the copy used to assert the second. The floor is INTERPOLATED
    // from the constant, never typed, exactly like `noAllies`.
    for (const ns of [cs, en]) {
      expect(placeholders(ns.noRebellions), "the rebellion floor must be interpolated").toEqual([
        "minEligible",
      ]);
      expect(placeholders(ns.noAllies), "the co-voting floor must be interpolated").toEqual([
        "minShared",
      ]);
    }
    // „Not measured" and „zero" must not read as the same answer.
    expect(cs.noRebellions).toMatch(/nezměřeno|neměřen/);
    expect(en.noRebellions).toMatch(/unmeasured/i);
  });

  it("the club-deviation section says the two figures are two measurements", () => {
    // The stored `rebels_against` aggregate and the live `RebellionInstances` derivation
    // sat next to each other reading as one fact, and they diverge STRUCTURALLY: the
    // aggregate is a batch snapshot (a new roll call grows the list and never touches the
    // rate), it starts only at MIN_ELIGIBLE_VOTES while the chronicle has no floor at all,
    // its denominator drops ballots whose mandate does not resolve to both a person and a
    // club, and it is keyed by PERSON, so a club-switcher's whole record folds under his
    // first-seen club. The page says so — in the `committeeCountNote` idiom, which is the
    // sentence this page already owns for exactly this shape of disagreement.
    for (const ns of [cs, en]) {
      // The floor is INTERPOLATED from the constant, like `noRebellions`/`noAllies` — a
      // typed „50" is a claim that stops tracking lib/analysis/kg.ts the day it moves.
      expect(placeholders(ns.rebellionsAggregateNote)).toEqual(["minEligible"]);
    }
    expect(cs.rebellionsAggregateNote, "the cs note must call them two measurements").toMatch(
      /dvě\s+různá\s+měření/i,
    );
    expect(en.rebellionsAggregateNote, "the en note must call them two measurements").toMatch(
      /two\s+different\s+measurements/i,
    );
  });

  it("the aggregate's citation names the pass it has, and never one it does not", () => {
    // Four states of `summarizeRebellionProvenance`, four sentences. The one that matters
    // is `Mixed`: rows that disagree DO carry a pass, so printing the „the edge names no
    // pass" sentence over them is a false statement about the data — „nothing is recorded"
    // and „we could not agree" are two findings (the `indexPassMixed` rule, applied to the
    // edge instead of the node).
    for (const ns of [cs, en]) {
      expect(placeholders(ns.rebellionsAggregateSource).sort()).toEqual(["date", "pass", "ref"]);
      expect(placeholders(ns.rebellionsAggregateSourceUndated).sort()).toEqual(["pass", "ref"]);
      expect(placeholders(ns.rebellionsAggregateSourceMixed)).toEqual(["count"]);
      // No pass, no ref, no day — so no placeholder either; a bare zero here would be a
      // fabricated pass number.
      expect(placeholders(ns.rebellionsAggregateSourceUnknown)).toEqual([]);
      const four = [
        ns.rebellionsAggregateSource,
        ns.rebellionsAggregateSourceUndated,
        ns.rebellionsAggregateSourceMixed,
        ns.rebellionsAggregateSourceUnknown,
      ];
      expect(new Set(four).size, "four states must not collapse into fewer sentences").toBe(4);
      // Each of the four cites the DATASET, which is the half the old aside („graf
      // rebels-against · odchylky od klubu") already had and the half it was missing.
      for (const v of four) expect(v).toMatch(/rebels-against/);
    }
  });

  it("a store outage and a non-existent MP get different metadata", () => {
    // `generateMetadata` used to answer „spis nenalezen" for BOTH — so an unreadable
    // graph published a claim about a person to crawlers and share cards. The page
    // body always told them apart (`getAllProfilePspIds`); the head now does too.
    for (const ns of [cs, en]) {
      expect(ns.metaUnavailableTitle, "outage title").toBeTruthy();
      expect(ns.metaUnavailableDescription, "outage description").toBeTruthy();
      expect(placeholders(ns.metaUnavailableTitle)).toEqual([]);
      expect(placeholders(ns.metaUnavailableDescription)).toEqual([]);
    }
    // The outage copy must explicitly refuse the „this MP does not exist" reading.
    expect(cs.metaUnavailableDescription).toMatch(/neexistuje/);
    expect(en.metaUnavailableDescription).toMatch(/does not exist/i);
  });

  it("a written amendment is addressable, and a missing address says so", () => {
    // `proposes_amendment.props.sd_cislos` carries the sněmovní-dokument numbers,
    // i.e. the TEXT of what the MP filed; the row used to render only the weight.
    // Three states, three sentences: the links, an edge with no number at all, and
    // a list that does not account for the stored count (never repaired — the
    // impossible-dates precedent).
    for (const ns of [cs, en]) {
      for (const k of [
        "dossierAmendmentDocsLabel",
        "dossierAmendmentDoc",
        "dossierAmendmentDocsNone",
        "dossierAmendmentDocsMismatch",
      ]) {
        expect(ns[k], k).toBeTruthy();
      }
      expect(placeholders(ns.dossierAmendmentDoc)).toEqual(["cislo"]);
      expect(placeholders(ns.dossierAmendmentDocsNone)).toEqual([]);
      // The mismatch names BOTH figures, or it is not a disclosure.
      expect(placeholders(ns.dossierAmendmentDocsMismatch).sort()).toEqual(
        ["countFmt", "docs", "docsFmt"],
      );
      // The citation names the dump the numbers come from, not just the counter.
      expect(ns.dossierAmendmentsSource).toMatch(/sd\.zip/);
      expect(ns.dossierAmendmentsSource).toMatch(/sd_cislos/);
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

  it("the excused-absence rows declare all three states, in both locales", () => {
    // Evidence omluv (`absence`) je datovaná a časovaná — a spis z ní tiskl jediné
    // číslo. Řádky mají tři stavy jako rebelie: nečitelná evidence · poctivá nula ·
    // výpis se stropem. Stav bez věty je ticho, které vypadá jako rozhodnutí.
    for (const ns of [cs, en]) {
      for (const k of [
        "dossierAbsenceRowsHeading",
        "dossierAbsenceRowsLead",
        "dossierAbsenceRowsWholeDay",
        "dossierAbsenceRowsFutureTag",
        "dossierAbsenceRowsFuture",
        "dossierAbsenceRowsUndated",
        "dossierAbsenceRowsMore",
        "dossierAbsenceRowsNone",
        "dossierAbsenceRowsUnavailable",
        "dossierAbsenceRowsNoReason",
        "dossierAbsenceRowsRate",
        "dossierAbsenceRowsNotBallot",
        "dossierAbsenceRowsSource",
        "dossierAbsenceRowsSourceEmpty",
      ]) {
        expect(ns[k], k).toBeTruthy();
      }
    }
    // Nečitelná evidence a prázdná evidence nesmějí znít stejně: jedna je výpadek,
    // druhá je výrok o poslanci.
    expect(cs.dossierAbsenceRowsUnavailable).not.toBe(cs.dossierAbsenceRowsNone);
    expect(en.dossierAbsenceRowsUnavailable).not.toBe(en.dossierAbsenceRowsNone);
    // Strop se přiznává i s celkem, ne jen počtem vypsaných.
    expect(placeholders(cs.dossierAbsenceRowsMore)).toEqual(["shown", "total"]);
  });

  it("the excused-absence copy never implies a reason the source does not publish", () => {
    // `omluvy.unl` má sloupce (id_organ, id_poslanec, den, od, do) — nic víc.
    for (const ns of [cs, en]) {
      expect(ns.dossierAbsenceRowsNoReason).toMatch(/důvod|reason/i);
    }
    expect(cs.dossierAbsenceRowsNoReason).toMatch(/nezveřejňuje|nevyčteme/);
    expect(en.dossierAbsenceRowsNoReason).toMatch(/publishes none|do not guess/i);
    // Citace jmenuje datovou sadu, ze které řádky jsou.
    for (const ns of [cs, en]) {
      expect(ns.dossierAbsenceRowsSource).toMatch(/omluvy\.unl/);
      expect(ns.dossierAbsenceRowsSourceEmpty).toMatch(/omluvy\.unl/);
    }
  });

  it("the rows never claim to BE the stored rate, and never conflate the ballot bucket", () => {
    // Míra je uložená hodnota z přepočtu indexu, výpis je živá evidence: podání
    // zapsané po přepočtu je vidět v seznamu a v míře ještě ne. A „omluven" u pultu
    // při jednom hlasování je jiný fakt z jiné datové sady.
    expect(cs.dossierAbsenceRowsRate).toMatch(/jednacích dnů/);
    expect(cs.dossierAbsenceRowsRate).toMatch(/uložená hodnota|přepočt/);
    expect(en.dossierAbsenceRowsRate).toMatch(/sitting days/i);
    expect(en.dossierAbsenceRowsRate).toMatch(/stored|recomputation/i);
    expect(cs.dossierAbsenceRowsNotBallot).toMatch(/hlasování/);
    expect(en.dossierAbsenceRowsNotBallot).toMatch(/roll call/i);
  });

  it("a future-dated excuse is disclosed as real, never as an error to be fixed", () => {
    // Omluva se podává dopředu (10 takových řádků v 10. období) — stránka to říká
    // a nic nemaže; precedens „nemožná data se přiznávají, neopravují".
    expect(cs.dossierAbsenceRowsFuture).toMatch(/dopředu/);
    expect(cs.dossierAbsenceRowsFuture).toMatch(/nemaže|neopravuje/);
    expect(en.dossierAbsenceRowsFuture).toMatch(/filed ahead/i);
    expect(en.dossierAbsenceRowsFuture).toMatch(/deleted|corrected/i);
    expect(placeholders(cs.dossierAbsenceRowsFuture)).toEqual(["count", "countFmt"]);
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
