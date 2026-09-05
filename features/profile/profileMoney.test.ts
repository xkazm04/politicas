import { describe, expect, it } from "vitest";
import type { MoneyMpDetail } from "@/features/money/moneyTypes";
import { PROFILE_CONTRACT_LINES, toProfileMoney } from "./profileMoney";

/* The spis used to re-run the plausibility bound over each contract's `signedOn` against its
 * OWN day (the UTC `seatsAsOf`), while the money loader had already drawn it - on the Prague
 * day - and attached the verdict to the row (`ContractLine.dateWithheldOn`). Two surfaces,
 * two calendars, one signature. The projection now READS the verdict; this is the follow-up
 * step `moneyTypes.ts::ContractLine.dateWithheldOn` names. */

const bucket = { companies: 1, contractCount: 3, contractCzk: 300, subsidiesCzk: 0, donatedToPartyCzk: 0 };
const tie = (over: Record<string, unknown>) =>
  ({
    companyId: "company:ico:00000001",
    ico: "00000001",
    company: "Firma a.s.",
    role: "jednatel",
    tieClass: "owner-operator",
    reviewState: "pending_review",
    source: "hlidac",
    corroboration: null,
    temporalStatus: null,
    roleValidFrom: null,
    roleValidTo: null,
    receiptRef: "h.psp:person:1.linked_to.company:ico:00000001",
    contractCount: 3,
    contractCzk: 300,
    contractBasis: { counted: 3, bezDph: 3, vcetneDph: 0, ciziMena: 0, none: 0, unrecorded: 0 },
    contracts: [
      { id: "contract:1", label: "A", amountCzk: 100, signedOn: "2025-01-05", amountBasis: "bezDph" },
      { id: "contract:2", label: "B", amountCzk: 100, signedOn: "3062-01-01", dateWithheldOn: "2026-09-07", amountBasis: "bezDph" },
      { id: "contract:3", label: "C", amountCzk: 100, signedOn: null, amountBasis: "bezDph" },
    ],
    ...over,
  }) as unknown as MoneyMpDetail["ties"][number];
const detail = (ties: MoneyMpDetail["ties"]) =>
  ({
    pspId: 1,
    name: "X",
    club: null,
    absenteeManagerLead: false,
    ties,
    money: { attributable: bucket, steward: { ...bucket, companies: 0, contractCount: 0, contractCzk: 0 }, totalCzk: 300, companies: 1, coverage: { perCompanyCap: null, companiesAtCap: 0, isFloor: false } },
    source: "s",
    pass: 41,
  }) as unknown as MoneyMpDetail;

describe("toProfileMoney reads the loader's date verdict", () => {
  const out = toProfileMoney(detail([tie({})]));
  const lines = out.ties[0].topContracts;
  it("a withheld date renders as unusable, a kept date stays, a missing date is missing", () => {
    expect(lines.map((l) => [l.signedOn, l.dateUnusable])).toEqual([
      ["2025-01-05", false],
      [null, true],
      [null, false],
    ]);
    expect(out.unusableDates).toBe(1);
  });
  it("caps the listed lines and counts the rest", () => {
    const many = tie({ contractCount: 9, contracts: Array.from({ length: 9 }, (_, i) => ({ id: `c${i}`, label: "x", amountCzk: 1, signedOn: null, amountBasis: "bezDph" })) });
    const o = toProfileMoney(detail([many]));
    expect(o.ties[0].topContracts).toHaveLength(PROFILE_CONTRACT_LINES);
    expect(o.ties[0].contractsMoreCount).toBe(9 - PROFILE_CONTRACT_LINES);
  });
  it("a steward tie carries no money and no lines on the spis", () => {
    const o = toProfileMoney(detail([tie({ tieClass: "steward" })]));
    expect(o.ties[0]).toMatchObject({ contractCzk: null, contractCount: null, topContracts: [], contractBasis: null });
    expect(o.stewardTies).toBe(1);
  });
});
