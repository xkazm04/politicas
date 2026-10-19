/*
 * ODMLČENÝ SPIS NENÍ „ŽÁDNÁ VAZBA".
 *
 * `getMoneyMpDetail` a `getCompanyCaseFile` vracejí null i když se store nedá přečíst
 * (jednopřipojeníové PGlite drží jiný proces, nebo je pod prahem při ingestu). Stránka
 * tu nulu do 2026-10-14 vždy vyslovila jako „graf pro tohoto poslance/firmu nemá žádnou
 * vazbu" — tvrzení o jmenované osobě, které nikdo nezjistil. Test krmí stránku každým
 * stavem nepřítomnosti a ptá se, jakou větu stránka řekne (ne zda spadne).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const getMoneyMpDetail = vi.fn();
const getCompanyCaseFile = vi.fn();
const moneyStoreReadable = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("next-intl/server", () => ({
  getTranslations: async () => (k: string) => k,
}));
vi.mock("./getMpDetail", () => ({ getMoneyMpDetail }));
vi.mock("./getCompanyDetail", () => ({ getCompanyCaseFile }));
vi.mock("./moneyStoreReadable", () => ({ moneyStoreReadable }));
vi.mock("./MpCaseFilePage", () => ({ default: () => null }));
vi.mock("./CompanyCaseFilePage", () => ({ default: () => null }));
vi.mock("@/features/money/getMpDetail", () => ({ getMoneyMpDetail }));
vi.mock("@/features/money/getCompanyDetail", () => ({ getCompanyCaseFile }));
vi.mock("@/features/money/moneyStoreReadable", () => ({ moneyStoreReadable }));
vi.mock("@/features/money/MpCaseFilePage", () => ({ default: () => null }));
vi.mock("@/features/money/CompanyCaseFilePage", () => ({ default: () => null }));

const { default: MpPage } = await import("@/app/penize/[pspId]/page");
const { default: CompanyPage } = await import("@/app/penize/firma/[ico]/page");
const { default: DataUnavailable } = await import("@/features/shared/components/DataUnavailable");
const { default: MpCaseFilePage } = await import("@/features/money/MpCaseFilePage");
const { default: CompanyCaseFilePage } = await import("@/features/money/CompanyCaseFilePage");

const mp = () => MpPage({ params: Promise.resolve({ pspId: "100" }) });
const company = () => CompanyPage({ params: Promise.resolve({ ico: "00075370" }) });

describe("spis poslance a firmy — která nepřítomnost je která", () => {
  beforeEach(() => {
    getMoneyMpDetail.mockReset();
    getCompanyCaseFile.mockReset();
    moneyStoreReadable.mockReset();
  });

  it("null při nečitelném store je NEDOSTUPNOST, ne žádná vazba (poslanec)", async () => {
    getMoneyMpDetail.mockResolvedValue(null);
    moneyStoreReadable.mockResolvedValue(false);
    const el = (await mp()) as { type: unknown };
    expect(el.type).toBe(DataUnavailable);
  });

  it("null při nečitelném store je NEDOSTUPNOST, ne žádná vazba (firma)", async () => {
    getCompanyCaseFile.mockResolvedValue(null);
    moneyStoreReadable.mockResolvedValue(false);
    const el = (await company()) as { type: unknown };
    expect(el.type).toBe(DataUnavailable);
  });

  it("null při čitelném store zůstává pravdivým zjištěním (žádná vazba)", async () => {
    getMoneyMpDetail.mockResolvedValue(null);
    getCompanyCaseFile.mockResolvedValue(null);
    moneyStoreReadable.mockResolvedValue(true);
    expect(((await mp()) as { type: unknown }).type).toBe(MpCaseFilePage);
    expect(((await company()) as { type: unknown }).type).toBe(CompanyCaseFilePage);
  });

  it("nalezený spis se store nedotazuje", async () => {
    getMoneyMpDetail.mockResolvedValue({ pspId: 100 });
    moneyStoreReadable.mockResolvedValue(false);
    expect(((await mp()) as { type: unknown }).type).toBe(MpCaseFilePage);
    expect(moneyStoreReadable).not.toHaveBeenCalled();
  });
});
