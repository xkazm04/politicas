/*
 * ZPÁTEČNÍ TEST BRÁNY — každá ražená metrika se dá ověřit vlastní adresou.
 *
 * Plocha vydá číslo a k němu claim-ref (`claim:<dataset>:<metrika>[:<předmět>]`).
 * Čtenář ten ref vloží do /overeni a brána HO ZNOVU ODVODÍ přes loader, který to
 * číslo vlastní. Mezi těmi dvěma cestami nikdy nikdo neporovnal, že skládají
 * TÝŽ ref a vracejí TUTÉŽ hodnotu: `liveFigures.ts` (jedenáctivětvý router) ani
 * `getVerdictData.ts` (pořadí rejstřík → živý store) neměly do 2026-08-12 jediný
 * test. Ražení claimu má přitom vlastní testy (moneyClaims/scoreClaim/lawClaims)
 * a rozpoznání adresy taky (refDetect) — chyběl přesně ten spoj mezi nimi.
 *
 * ── PROČ SE STORE NEZAKLÁDÁ, ALE MOCKUJE ────────────────────────────────────
 * lib/testing/loaders.test.ts ve své hlavičce dokládá měřením, že KAŽDÝ další
 * testovací soubor, který nabootuje PGlite, sráží hooky NESOUVISEJÍCÍCH souborů
 * (proto se do něj leaderboard-loader vstřebal místo šestého bootu). Tenhle test
 * o databázi není: ověřuje, že plocha a brána skládají jeden ref a jedno číslo.
 * Mockuje se proto přesně to, co `liveFigures` volá — `getStore` a čtyři loadery
 * (precedens: features/dukazy/readReviewAudit.test.ts, features/money/
 * getLeadPacketTargets.test.ts) — a claim se na obou stranách RAZÍ VEŘEJNOU
 * mincovnou plochy, nikdy druhou kopií aritmetiky.
 *
 * ── CO TENHLE TEST NEDRŽÍ (a proč je to napsané, ne zamlčené) ───────────────
 * Čtení z grafu. Fixtura je payload loaderu, ne řádky ve store, takže regresi
 * uvnitř `getMoneyMpDetail`/`getLawData` chytá lib/testing/loaders.test.ts, ne
 * tenhle soubor. A u ČTYŘ metrik pokrytí předpisu se drží jen SMĚROVÁNÍ (že ref
 * do routeru dojde a tmavá vrstva odpoví „nedostupné"), ne hodnota: hodnotová
 * větev jde přes `deriveStatuteDossier` nad celým `LawData` a vyrobit ho ručně
 * by znamenalo napsat druhou, nepravdivou kopii korpusu /zakony.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

import { makeClaimRef, type ClaimRefParts } from "@/lib/claims/claim";
import { ISSUED_FIGURES } from "@/lib/claims/registry";
import { edgeClaimRef } from "@/features/shared/provenance/claimRef";
import {
  companyReachClaim,
  mpBucketClaim,
  tieReachClaim,
  MONEY_CLAIM_DATASET,
  MONEY_METRIC,
} from "@/features/money/moneyClaims";
import { contributionScoreClaim, SCORE_CLAIM_DATASET, SCORE_METRIC } from "@/features/civicscore/scoreClaim";
import { LAW_CLAIM_DATASET, LAW_METRIC } from "@/features/lawwatch/lawClaims";
import { statuteSubject } from "@/features/lawwatch/lawClaims";
import { billNodeId } from "@/features/lawwatch/billRef";
import type { MoneyBucket } from "@/features/money/reachableMoney";
import type { ContributionProvenance } from "@/features/civicscore/provenance";

/* ── mocky přesně toho, co liveFigures.ts volá ─────────────────────────────── */

const mocks = vi.hoisted(() => ({
  getStore: vi.fn(),
  getMoneyMpDetail: vi.fn(),
  getCompanyDetail: vi.fn(),
  getLeaderboardData: vi.fn(),
  getLawData: vi.fn(),
}));

vi.mock("@/lib/db/store", () => ({ getStore: mocks.getStore, resetStoreCache: () => {} }));
vi.mock("@/features/money/getMpDetail", () => ({ getMoneyMpDetail: mocks.getMoneyMpDetail }));
vi.mock("@/features/money/getCompanyDetail", () => ({ getCompanyDetail: mocks.getCompanyDetail }));
vi.mock("@/features/civicscore/getLeaderboardData", () => ({
  getLeaderboardData: mocks.getLeaderboardData,
}));
vi.mock("@/features/lawwatch/getLawData", () => ({ getLawData: mocks.getLawData }));

const { getVerdictData } = await import("./getVerdictData");

/* ── fixtury ──────────────────────────────────────────────────────────────── */
//
// Nesou PŘESNĚ pole, která `liveFigures.ts` a veřejná mincovna čtou. Přetypování
// je záměrné a je to menší zlo než druhá kopie payloadu /penize: `MoneyMpDetail`
// i `CompanyCaseFileData` patří jiné featuře, mají desítky polí a právě se mění.
// Kdyby router začal číst pole navíc, chytí to typová kontrola v liveFigures.ts,
// ne tenhle soubor.
const cast = <T,>(value: unknown): T => value as T;

const PSP_ID = 6881;
const ICO = "46347534";
const PASS = 42;
const RECEIPT = edgeClaimRef(`psp:person:${PSP_ID}`, "linked_to", `company:ico:${ICO}`);

const bucket = (over: Partial<MoneyBucket> = {}): MoneyBucket => ({
  companies: 1,
  contractCount: 3,
  contractCzk: 23_570_594_009.66,
  subsidiesCzk: 1_250_000,
  donatedToPartyCzk: 0,
  ...over,
});

/** Vazba v přesném tvaru, jaký bere `tieReachClaim` (ClaimableTie). */
const TIE = {
  companyId: `company:ico:${ICO}`,
  tieClass: "owner-operator" as const,
  contractCount: 3,
  contractCzk: 23_570_594_009.66,
  subsidiesCzk: 1_250_000,
  donatedToPartyCzk: null,
  receiptRef: RECEIPT,
  reviewState: "pending_review" as const,
};

const STEWARD_TIE = {
  ...TIE,
  companyId: "company:ico:00000019",
  tieClass: "steward" as const,
  receiptRef: edgeClaimRef(`psp:person:${PSP_ID}`, "linked_to", "company:ico:00000019"),
};

const ATTRIBUTABLE = bucket();
const STEWARD = bucket({ companies: 1, contractCount: 9, contractCzk: 139_100_000_000 });

const MP_DETAIL = {
  pspId: PSP_ID,
  pass: PASS,
  ties: [TIE, STEWARD_TIE],
  money: { attributable: ATTRIBUTABLE, steward: STEWARD },
};

const COMPANY_DETAIL = {
  ico: ICO,
  pass: PASS,
  ties: [{ reviewState: "pending_review" as const }],
  money: { attributable: ATTRIBUTABLE, steward: bucket({ companies: 0, contractCount: 0, contractCzk: 0 }) },
};

const FORMULA_REF = "contribution-committee-dedupe";

const PROVENANCE: ContributionProvenance = {
  state: "uniform",
  pass: PASS,
  ref: FORMULA_REF,
  computedAt: "2026-08-04",
  distinctCount: 1,
  variants: [],
  covered: 207,
  total: 207,
  declaredRef: FORMULA_REF,
  formulaMatch: true,
};

const SCORE = 96.8;
const LEADERBOARD = { entries: [{ pspId: PSP_ID, score: SCORE }], provenance: PROVENANCE };

function serveHappyPath(): void {
  mocks.getStore.mockResolvedValue({});
  mocks.getMoneyMpDetail.mockResolvedValue(cast(MP_DETAIL));
  mocks.getCompanyDetail.mockResolvedValue(cast(COMPANY_DETAIL));
  mocks.getLeaderboardData.mockResolvedValue(cast(LEADERBOARD));
  // Vrstva zákonů je tu TMAVÁ schválně — viz hlavička a blok „směrování" níž.
  mocks.getLawData.mockResolvedValue(null);
}

beforeEach(() => {
  vi.clearAllMocks();
  serveHappyPath();
});

/* ── mincovna plochy: co která metrika vydává ──────────────────────────────── */
//
// Ražení je TÝŽ veřejný modul, jaký volá /penize a /zebricek. Kdyby si tenhle
// test ref skládal sám, ověřoval by jen to, co brána umí napsat.

interface Minted {
  ref: string;
  value: number;
}

const MINTED: Record<string, () => Minted> = {
  [MONEY_METRIC.tieReach]: () => {
    const { claim, value } = tieReachClaim(TIE, PASS);
    return { ref: claim.ref, value };
  },
  [MONEY_METRIC.mpOwned]: () => {
    const { claim, value } = mpBucketClaim(PSP_ID, "owned", ATTRIBUTABLE, [TIE.reviewState], PASS);
    return { ref: claim.ref, value };
  },
  [MONEY_METRIC.mpSteward]: () => {
    const { claim, value } = mpBucketClaim(PSP_ID, "steward", STEWARD, [STEWARD_TIE.reviewState], PASS);
    return { ref: claim.ref, value };
  },
  [MONEY_METRIC.companyReach]: () => {
    const { claim, value } = companyReachClaim(ICO, ATTRIBUTABLE, ["pending_review"], PASS);
    return { ref: claim.ref, value };
  },
  [SCORE_METRIC.contribution]: () => {
    const { claim, value } = contributionScoreClaim(PSP_ID, SCORE, PROVENANCE);
    return { ref: claim.ref, value };
  },
};

/** Metriky, u kterých se drží jen SMĚROVÁNÍ (viz hlavička) — každá s předmětem,
 *  který jde dekódovat, aby se odpověď netýkala tvaru předmětu. */
const ROUTED_ONLY: Record<string, ClaimRefParts> = {
  [LAW_METRIC.forensicCensus]: { dataset: LAW_CLAIM_DATASET, metric: LAW_METRIC.forensicCensus },
  [LAW_METRIC.forensicConfidence]: {
    dataset: LAW_CLAIM_DATASET,
    metric: LAW_METRIC.forensicConfidence,
    subject: billNodeId(58)!,
  },
  ...Object.fromEntries(
    (
      [
        LAW_METRIC.statuteTrailBills,
        LAW_METRIC.statuteEnactedBills,
        LAW_METRIC.statuteParagraphs,
        LAW_METRIC.statuteChanges,
      ] as const
    ).map((metric) => [
      metric,
      { dataset: LAW_CLAIM_DATASET, metric, subject: statuteSubject("586/1992")! },
    ]),
  ),
};

/* ── výčet: metrika bez větve v routeru MUSÍ spadnout ──────────────────────── */

describe("výčet ražených metrik", () => {
  const ALL = [
    ...Object.values(MONEY_METRIC),
    ...Object.values(SCORE_METRIC),
    ...Object.values(LAW_METRIC),
  ];

  it("každá vydávaná metrika je v tomhle testu právě jednou", () => {
    // Kdo přidá metriku a nenapíše jí větev v liveFigures.ts, narazí TADY —
    // ne až na produkci, kde by ref vydaný plochou odpověděl „mimo rejstřík".
    for (const metric of ALL) {
      const covered = (metric in MINTED ? 1 : 0) + (metric in ROUTED_ONLY ? 1 : 0);
      expect(covered, metric).toBe(1);
    }
    expect(ALL.length).toBe(Object.keys(MINTED).length + Object.keys(ROUTED_ONLY).length);
  });

  it("žádná metrika se v obou rodinách nejmenuje stejně", () => {
    expect(new Set(ALL).size).toBe(ALL.length);
  });
});

/* ── zpáteční test hodnoty ─────────────────────────────────────────────────── */

describe("plocha razí ref → brána vrací TUTÉŽ hodnotu", () => {
  for (const [metric, mint] of Object.entries(MINTED)) {
    it(`${metric}: holý ref se ověří na shodnou hodnotu`, async () => {
      const { ref, value } = mint();
      const data = await getVerdictData(ref);

      expect(data.status, ref).toBe("ok");
      if (data.status !== "ok") return;
      expect(data.detected.family).toBe("figura");
      expect(data.verdict.family).toBe("figura");
      if (data.verdict.family !== "figura" || data.verdict.kind !== "verified") {
        throw new Error(`${metric}: verdikt je ${data.verdict.kind}, čekala se shoda`);
      }
      // Táž hodnota A týž ref: shoda hodnoty nad jiným refem by byla náhoda.
      expect(data.verdict.figure.value).toBe(value);
      expect(data.verdict.figure.claim.ref).toBe(ref);
      expect(data.verdict.figure.claim.metric).toBe(metric);
    });
  }

  it("posunutá hodnota v opsaném elementu se pozná jako posun, ne shoda", () => {
    // Pojistka proti testu, který by „ověřeno" dostal na cokoli: kdyby brána
    // hodnoty neporovnávala, tenhle případ by prošel taky.
    const { ref, value } = MINTED[MONEY_METRIC.mpOwned]();
    return getVerdictData(`<data data-claim-ref="${ref}" data-claim-value="${value + 1}">x</data>`).then(
      (data) => {
        expect(data.status).toBe("ok");
        if (data.status !== "ok" || data.verdict.family !== "figura") throw new Error("čekala se figura");
        expect(data.verdict.kind).toBe("moved");
      },
    );
  });
});

/* ── směrování metrik, jejichž hodnotu tenhle test nestaví ─────────────────── */

describe("metriky zákonné vrstvy dojdou do routeru", () => {
  // Tmavá vrstva odpovídá `unavailable`; NEsměrovaná metrika by spadla do
  // `default: not-live`, brána by ji předala rejstříku a odpověděla „mimo
  // rejstřík". Ty dvě odpovědi jdou od sebe rozeznat, a proto tenhle test
  // směrování opravdu drží, i když hodnotu nestaví.
  for (const [metric, parts] of Object.entries(ROUTED_ONLY)) {
    it(`${metric}: tmavá vrstva odpoví „nedostupné", ne „mimo rejstřík"`, async () => {
      const data = await getVerdictData(makeClaimRef(parts));
      expect(data.status, metric).toBe("unavailable");
    });
  }

  it("vymyšlená metrika téhož datasetu naopak končí mimo rejstřík", () => {
    // Falzifikace předchozího tvrzení: kdyby „unavailable" padalo na cokoli,
    // dostal by ho i ref, který žádná větev neobsluhuje.
    return getVerdictData(
      makeClaimRef({ dataset: LAW_CLAIM_DATASET, metric: "metrika-ktera-neexistuje", subject: "x" }),
    ).then((data) => {
      expect(data.status).toBe("ok");
      if (data.status !== "ok" || data.verdict.family !== "figura") throw new Error("čekala se figura");
      expect(data.verdict.kind).toBe("unknown");
      if (data.verdict.kind === "unknown") expect(data.verdict.reason).toBe("mimo-rejstrik");
    });
  });
});

/* ── pořadí: rejstřík, teprve potom store ──────────────────────────────────── */

describe("rejstřík se ptá první a store se přitom nesahá", () => {
  it("vzorková figura se ověří BEZ jediného čtení", async () => {
    const issued = ISSUED_FIGURES[0];
    const data = await getVerdictData(issued.claim.ref);

    expect(data.status).toBe("ok");
    if (data.status !== "ok" || data.verdict.family !== "figura" || data.verdict.kind !== "verified") {
      throw new Error("čekala se ověřená figura");
    }
    expect(data.verdict.figure.value).toBe(issued.value);
    // Tohle je to podstatné: konečný rejstřík odpoví bez store.
    expect(mocks.getStore).not.toHaveBeenCalled();
    expect(mocks.getMoneyMpDetail).not.toHaveBeenCalled();
  });

  it("živá figura se naopak bez store neobejde", async () => {
    await getVerdictData(MINTED[SCORE_METRIC.contribution]().ref);
    expect(mocks.getStore).toHaveBeenCalled();
  });
});

/* ── nečitelný store není verdikt o odkazu ─────────────────────────────────── */

describe("nedostupný store → „nedostupné“, nikdy „mimo rejstřík“", () => {
  for (const dataset of [MONEY_CLAIM_DATASET, SCORE_CLAIM_DATASET, LAW_CLAIM_DATASET]) {
    it(`${dataset}: výpadek se nevydává za neznalost`, async () => {
      mocks.getStore.mockResolvedValue(null);
      const ref =
        dataset === MONEY_CLAIM_DATASET
          ? MINTED[MONEY_METRIC.mpOwned]().ref
          : dataset === SCORE_CLAIM_DATASET
            ? MINTED[SCORE_METRIC.contribution]().ref
            : makeClaimRef(ROUTED_ONLY[LAW_METRIC.forensicCensus]);
      expect(await getVerdictData(ref)).toEqual({ status: "unavailable" });
    });
  }

  it("záznam, který dnešní odvození nenese, je „nenalezen“ — ne výpadek", async () => {
    // Store čitelný, loader vrací payload BEZ toho poslance: to je tvrzení
    // o záznamu, ne o dostupnosti, a musí se od výpadku lišit.
    mocks.getLeaderboardData.mockResolvedValue(cast({ entries: [], provenance: PROVENANCE }));
    const data = await getVerdictData(MINTED[SCORE_METRIC.contribution]().ref);
    expect(data.status).toBe("ok");
    if (data.status !== "ok" || data.verdict.family !== "figura") throw new Error("čekala se figura");
    expect(data.verdict.kind).toBe("unknown");
    if (data.verdict.kind === "unknown") expect(data.verdict.reason).toBe("zaznam-nenalezen");
  });
});

/* ── adresa brány je taky citace (refDetect) ───────────────────────────────── */

describe("/overeni?ref=<citace> projde celou branou", () => {
  it("vložená adresa brány dá týž verdikt jako vložený ref", async () => {
    const { ref, value } = MINTED[MONEY_METRIC.tieReach]();
    const data = await getVerdictData(`https://politicas.cz/overeni?ref=${encodeURIComponent(ref)}`);

    expect(data.status).toBe("ok");
    if (data.status !== "ok" || data.verdict.family !== "figura" || data.verdict.kind !== "verified") {
      throw new Error("čekala se ověřená figura");
    }
    expect(data.verdict.figure.value).toBe(value);
  });
});
