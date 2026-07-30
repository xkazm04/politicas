import { describe, expect, it } from "vitest";
import { CHAMBER_STATS } from "@/lib/civic/data";
import { CHAMBER_SUMMARY } from "@/lib/civic/leaderboard";
import { makeClaimRef } from "./claim";
import { czechTileNumber, ISSUED_FIGURES, resolveClaimRef } from "./registry";

describe("czechTileNumber", () => {
  it("čte uloženou podobu dlaždice velína", () => {
    expect(czechTileNumber("78,3 %")).toBe(78.3);
    expect(czechTileNumber("312")).toBe(312);
    expect(czechTileNumber("2,1 mld Kč")).toBe(2.1);
  });

  it("nečíselný řetězec poctivě odmítne (žádná dosazená nula)", () => {
    expect(czechTileNumber("—")).toBeNull();
    expect(czechTileNumber("")).toBeNull();
    expect(czechTileNumber("n/a")).toBeNull();
  });
});

describe("rejstřík vydaných figur", () => {
  it("zná všechny tři figury vydané na /svedectvi", () => {
    const refs = ISSUED_FIGURES.map((f) => f.claim.ref);
    expect(refs).toContain(makeClaimRef({ dataset: "Ústava ČR", metric: "pocet-poslancu" }));
    expect(refs).toContain(makeClaimRef({ dataset: "civicscore v1.4", metric: "prumerny-kompozit" }));
    expect(refs).toContain(
      makeClaimRef({ dataset: "psp.cz — jmenovitá hlasování", metric: "prumerna-dochazka" }),
    );
  });

  it("hodnoty se odvozují z týchž zdrojů jako vydávající plocha", () => {
    const seats = resolveClaimRef(makeClaimRef({ dataset: "Ústava ČR", metric: "pocet-poslancu" }));
    expect(seats?.value).toBe(200);
    expect(seats?.claim.reviewStatus).toBe("verified");

    const avg = resolveClaimRef(
      makeClaimRef({ dataset: "civicscore v1.4", metric: "prumerny-kompozit" }),
    );
    expect(avg?.value).toBe(CHAMBER_SUMMARY.avg);
    expect(avg?.claim.reviewStatus).toBe("pending");

    const attendanceTile = CHAMBER_STATS.find((s) => s.key === "attendance");
    const attendance = resolveClaimRef(
      makeClaimRef({ dataset: "psp.cz — jmenovitá hlasování", metric: "prumerna-dochazka" }),
    );
    expect(attendance?.value).toBe(czechTileNumber(attendanceTile?.value ?? ""));
    expect(attendance?.value).toBe(78.3);
  });

  it("neznámý ref vrací null — brána pak řekne neznámý odkaz", () => {
    expect(resolveClaimRef("claim:cizi:metrika")).toBeNull();
    expect(resolveClaimRef("nesmysl")).toBeNull();
  });

  it("každá figura nese plochu vydání a formátovač", () => {
    for (const fig of ISSUED_FIGURES) {
      expect(fig.issuedAt.startsWith("/")).toBe(true);
      expect(["dec", "int", "czk"]).toContain(fig.kind);
      expect(Number.isFinite(fig.value)).toBe(true);
    }
  });
});
