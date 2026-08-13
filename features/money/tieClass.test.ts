// The classification-precedence contract for a `linked_to` tie.
//
// A human review gate is only a gate if the human's judgement becomes the product's
// truth. Both /penize consumers used to RECOMPUTE the tie class at read time from two
// free-text strings, so every `props.tie_class` an analyst had written — 211 of 211 on
// the live store — was dead data, and the five ties where the two disagree rendered the
// guess. `resolveTieClass` is the one place that decides; these tests pin it, including
// the real divergences measured on the store (2026-07-29).

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { classifyTie, resolveReviewOrder, resolveTieClass, reviewRank, reviewTier, PUBLIC_MARKERS } from "./reviewTypes";
import { tieClassOriginInfo } from "./moneyTypes";

describe("resolveTieClass — stored beats the heuristic", () => {
  it("reads a stored class and reports it as stored", () => {
    const r = resolveTieClass("steward", "jednatel", "Alfa s.r.o.");
    expect(r.tieClass).toBe("steward");
    expect(r.origin).toBe("stored");
  });

  it("falls back to the heuristic when nothing is stored — and says it is derived", () => {
    const r = resolveTieClass(undefined, "jednatel", "Alfa s.r.o.");
    expect(r.tieClass).toBe("owner-operator");
    expect(r.origin).toBe("derived");
    expect(r.disagrees).toBe(false);
    expect(resolveTieClass(null, "jednatel", "Alfa s.r.o.").origin).toBe("derived");
  });

  it("treats an unrecognised stored value as absent (the graph is not a type system)", () => {
    const r = resolveTieClass("vlastník-něčeho", "jednatel", "Alfa s.r.o.");
    expect(r.tieClass).toBe("owner-operator");
    expect(r.origin).toBe("derived");
  });

  it("keeps the heuristic's answer alongside the stored one, so a disagreement is visible", () => {
    const r = resolveTieClass("steward", "jednatel", "Alfa s.r.o.");
    expect(r.heuristic).toBe("owner-operator");
    expect(r.disagrees).toBe(true);
    // agreeing values are not a disagreement
    expect(resolveTieClass("owner-operator", "jednatel", "Alfa s.r.o.").disagrees).toBe(false);
  });

  // The five ties measured on the live store where props.tie_class contradicts
  // classifyTie(). The stored value is the investigated one and must win every time.
  it.each([
    // IČO 24227901 — the MP's OWN residential owners' association (SVJ). The heuristic
    // reads "pověřený vlastník" as ownership of a private supplier and the product
    // captioned it "poslanec vlastní nebo řídí soukromou firmu, která dodává státu".
    ["Společenství vlastníků Vlastislavova 605/20, Praha 4", "pověřený vlastník", "steward", "owner-operator"],
    ["Komwag, podnik čistoty a údržby města, a.s.", "člen představenstva", "steward", "manager"],
    ["Pojišťovna VZP, a.s.", "člen představenstva", "steward", "manager"],
    ["Vodovody a kanalizace Vsetín, a.s.", "předseda představenstva", "manager", "steward"],
    ["Vodovody a kanalizace Vyškov,a.s.", "člen představenstva", "manager", "steward"],
  ] as const)("resolves %s to the stored class, not the guess", (company, role, stored, heuristic) => {
    expect(classifyTie(role, company)).toBe(heuristic); // the heuristic really does differ
    const r = resolveTieClass(stored, role, company);
    expect(r.tieClass).toBe(stored);
    expect(r.origin).toBe("stored");
    expect(r.disagrees).toBe(true);
  });

  it("the SVJ case loses the owner-operator reading entirely", () => {
    const r = resolveTieClass("steward", "pověřený vlastník", "Společenství vlastníků Vlastislavova 605/20, Praha 4");
    expect(r.tieClass).not.toBe("owner-operator");
  });
});

/*
 * CO SMÍ „ZAPSANÁ TŘÍDA" ŘÍCT O SVÉM PŮVODU.
 *
 * `tieClassOriginInfo("stored")` do 2026-08-13 tvrdilo, že třídu „zapsal
 * analytický průchod NEBO LIDSKÁ KONTROLA, není to automatický odhad" — a
 * protože zapsanou třídu nese 211 z 211 živých vazeb, byla ta věta pod každou
 * z nich. Obě poloviny jsou nepravdivé a obě se dají vyvrátit ze stromu:
 *
 *  1. `ReviewRepository.setTieReviewState` — JEDINÁ zapisovací cesta brány
 *     /penize/kontrola — sestavuje `nextProps` z `review_state`,
 *     `last_decision`, `last_reviewer`, `last_reviewed_at` a `review_note`.
 *     `tie_class` mezi nimi není, takže lidská kontrola tohle pole zapsat
 *     NEMŮŽE. Test to čte přímo ze zdroje repozitáře, ne z paměti.
 *  2. Průchod, který drtivou většinu tříd zapsal
 *     (`scripts/case-loops/money/reconcile-ares-vr.ts`), je počítá `classifyTie` —
 *     tedy TOUTÉŽ funkcí, kterou plocha při čtení označuje za odhad. Od
 *     2026-08-13 ji navíc importuje odsud, takže to je vidět i staticky.
 */
describe("tieClassOriginInfo — zapsaná třída netvrdí lidskou kontrolu ani „není to odhad“", () => {
  const stored = tieClassOriginInfo("stored");
  const derived = tieClassOriginInfo("derived");

  it("neslibuje lidskou kontrolu tam, kde do pole nikdo lidský nepíše", () => {
    // KAŽDÝ výskyt „lidská kontrola" ve větě musí být POPŘENÍM, ne autorstvím.
    // (První verze tohohle testu zakazovala tvar „zapsal ji … lidská kontrola"
    // a shodila i správnou větu „zapsal ji dávkový průchod, NE lidská kontrola" —
    // regex neuměl rozlišit autora od popření. Pravidlo se proto píše takhle.)
    const mentions = [...stored.noteCs.matchAll(/(.{0,8})lidská kontrola/gi)];
    expect(mentions.length).toBeGreaterThan(0);
    for (const m of mentions) expect(m[1]).toMatch(/\bne\s$/);

    const mentionsEn = [...stored.noteEn.matchAll(/(.{0,10})human review/gi)];
    expect(mentionsEn.length).toBeGreaterThan(0);
    for (const m of mentionsEn) expect(m[1]).toMatch(/\bnot by\s$/);

    // A brána se pojmenuje i pozitivně, ať čtenář ví, kam si má dojít.
    expect(stored.noteCs).toMatch(/\/penize\/kontrola do tohoto pole nezapisuje/);
    expect(stored.noteEn).toMatch(/never writes this field/);
  });

  it("netvrdí, že zapsaná třída není automatický odhad", () => {
    expect(stored.noteCs).not.toMatch(/není to automatický odhad/i);
    expect(stored.noteEn).not.toMatch(/not guessed at read time/i);
    // Naopak přizná, že většinu zapsaných tříd spočítal týž odhad.
    expect(stored.noteCs).toMatch(/classifyTie/);
    expect(stored.noteEn).toMatch(/classifyTie/);
  });

  it("se nepřeklopí do opačné nepravdy — analytikem dohledaná třída to smí říct", () => {
    // 15 tříd korpusu pochází z batch-001 (ruční rejstříkové dohledání), takže
    // věta NESMÍ tvrdit, že KAŽDÁ zapsaná třída je odhad.
    expect(stored.noteCs).toMatch(/většinu/i);
    expect(stored.noteCs).toMatch(/analytik/i);
    expect(stored.noteEn).toMatch(/most stored classes/i);
    expect(stored.noteEn).toMatch(/analyst/i);
    // A zároveň se nevymýšlí pole, které graf nemá: která z těch cest to u
    // KONKRÉTNÍ vazby byla, se přiznaně neví.
    expect(stored.noteCs).toMatch(/graf nezaznamenává/i);
    expect(stored.noteEn).toMatch(/the graph does not record/i);
  });

  it("přednost zapsané hodnoty zůstane odůvodněná (jinak by čtenář nevěděl, proč vyhrává)", () => {
    expect(stored.noteCs).toMatch(/přednost/i);
    expect(stored.noteEn).toMatch(/precedence/i);
    // Odvozená větev se nemění — pořád je to vodítko, ne nález.
    expect(derived.noteCs).toMatch(/vodítko, ne jako zjištěný fakt/);
    expect(derived.noteEn).toMatch(/a lead, not a finding/);
  });

  it("brána do tie_class opravdu nepíše (čteno ze zdroje, ne z paměti)", () => {
    const src = readFileSync("lib/db/pglite/repositories/review.ts", "utf8");
    // Ta jediná zapisovací cesta staví nextProps — a tie_class v souboru není.
    expect(src).toMatch(/const nextProps: Record<string, unknown> = \{/);
    expect(src).not.toMatch(/tie_class/);
  });
});

/*
 * SLOVNÍK HEURISTIKY MÁ JEDNU DEFINICI (2026-08-13).
 *
 * `PUBLIC_MARKERS` žil ve ČTYŘECH kopiích — tady a ve třech skriptech
 * case-loops/money, z nichž dva `tie_class` do grafu ZAPISUJÍ. Kopie se
 * rozešly: tahle nesla `vodovody a kanalizace`, ty skriptové ne. Ověřuje se
 * tedy staticky, že skripty klasifikátor importují (kopie by test shodil).
 */
describe("classifyTie — jedna definice pro plochu i pro zapisující průchody", () => {
  it.each([
    "scripts/case-loops/money/reconcile-ares-vr.ts",
    "scripts/case-loops/money/prak-repoint.ts",
    "scripts/case-loops/money/triage.ts",
  ])("%s importuje classifyTie místo vlastní kopie", (path) => {
    const src = readFileSync(path, "utf8");
    expect(src).toMatch(/import \{[^}]*classifyTie[^}]*\} from "@\/features\/money\/reviewTypes"/);
    // Žádná lokální definice klasifikátoru ani jeho slovníku nesmí zůstat.
    expect(src).not.toMatch(/function classifyTie/);
    expect(src).not.toMatch(/const PUBLIC_MARKERS/);
    expect(src).not.toMatch(/function foldLowerLite/);
  });

  it("`krajsk` se nepřidává — `kraj` je její předpona, takže by nezměnila ani jednu odpověď", () => {
    expect(PUBLIC_MARKERS).toContain("kraj");
    expect(PUBLIC_MARKERS).not.toContain("krajsk");
    // Důkaz nadbytečnosti: každý řetězec obsahující „krajsk“ obsahuje i „kraj“.
    expect(classifyTie("předseda představenstva", "Krajská nemocnice Liberec, a.s.")).toBe("steward");
  });

  it("`z. ú` / `z. s` se přidávají — je to druhý pravopis formy, kterou seznam už nese", () => {
    // Mezerovaný tvar rejstřík píše taky; bez něj ho heuristika neviděla.
    expect(classifyTie("člen správní rady", "Muzeum paměti XX. století, z. ú.")).toBe("steward");
    expect(classifyTie("předseda", "Sportovci Praha, z. s.")).toBe("steward");
    // Nemezerovaný tvar zůstává, jak byl.
    expect(classifyTie("člen správní rady", "Muzeum paměti XX. století, z.ú.")).toBe("steward");
  });
});

describe("resolveReviewOrder — a stored ORDER key is a cache, not a judgement", () => {
  const base = {
    tieClass: "owner-operator" as const,
    corroboration: "registry-confirmed" as const,
    contractCzk: 5_000_000,
    subsidiesCzk: 0,
  };

  it("reports 'stored' when the graph's value still matches the tie in front of the reader", () => {
    const r = resolveReviewOrder({
      ...base,
      storedTier: reviewTier(base),
      storedRank: reviewRank(base),
    });
    expect(r.origin).toBe("stored");
    expect(r.reviewTier).toBe(reviewTier(base));
    expect(r.reviewRank).toBe(reviewRank(base));
  });

  it("reports 'derived' when the edge carries none (3 of 211 on the live store)", () => {
    const r = resolveReviewOrder({ ...base, storedTier: undefined, storedRank: undefined });
    expect(r.origin).toBe("derived");
    expect(r.reviewRank).toBe(reviewRank(base));
  });

  it("recomputes — and SAYS so — when the stored key predates the money it encodes", () => {
    // The batch-012 re-ingest grew `supplies` 2 290 → 153 731 rows, so 153 of 208 stored
    // ranks encode a contract corpus that no longer exists. Mixing those with current
    // ranks in one sort is not an order at all: the queue must use one vintage.
    const stale = reviewRank({ ...base, contractCzk: 100_000 });
    const r = resolveReviewOrder({ ...base, storedTier: reviewTier(base), storedRank: stale });
    expect(r.origin).toBe("stale-recomputed");
    expect(r.reviewRank).toBe(reviewRank(base));
    expect(r.reviewRank).not.toBe(stale);
  });

  it("recomputes when corroboration was written after the tier (batch-006 dataor sweep)", () => {
    // Komwag/Pojišťovna VZP: corroboration landed at pass 27, the tier at pass 24, so the
    // card renders "potvrzeno OR" while the stored tier still says "nepotvrzeno" (3).
    const r = resolveReviewOrder({ ...base, storedTier: 3, storedRank: reviewRank(base) });
    expect(r.origin).toBe("stale-recomputed");
    expect(r.reviewTier).toBe(0);
  });

  it("the resolved order still tracks the RESOLVED class, not the heuristic", () => {
    // Vodovody a kanalizace Vsetín: stored `manager`, heuristic `steward`. Honouring the
    // stored class must move the tie from review tier 2 into tier 1.
    const cls = resolveTieClass("manager", "předseda představenstva", "Vodovody a kanalizace Vsetín, a.s.");
    const r = resolveReviewOrder({
      storedTier: undefined,
      storedRank: undefined,
      tieClass: cls.tieClass,
      corroboration: "registry-confirmed",
      contractCzk: 1_000_000,
      subsidiesCzk: 0,
    });
    expect(r.reviewTier).toBe(1);
  });
});
