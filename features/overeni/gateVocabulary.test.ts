import { describe, expect, it } from "vitest";
import { gateStatusInfo, GATE_COPY_KEYS } from "./gateVocabulary";

describe("slovník stavu lidské brány", () => {
  it("obě rodiny tokenů mají tentýž stav a tentýž klíč copy", () => {
    // ReviewStatus (účtenka) vs ClaimReviewStatus (figura) — dvě jména, jeden stav.
    expect(gateStatusInfo("pending").status).toBe("pending_review");
    expect(gateStatusInfo("pending").labelKey).toBe(gateStatusInfo("pending_review").labelKey);
    expect(gateStatusInfo("verified").status).toBe("verified");
    expect(gateStatusInfo("rejected").status).toBe("rejected");
    for (const t of ["verified", "pending", "pending_review", "rejected"]) {
      expect(gateStatusInfo(t).known, t).toBe(true);
    }
  });

  it("neznámý token si NESE SÁM SEBE a je označen jako nepřeložený", () => {
    const info = gateStatusInfo("needs_second_reviewer");
    expect(info.known).toBe(false);
    expect(info.status).toBe("unmapped");
    // Doslovný token je k dispozici, aby ho plocha vysázela do věty {token}.
    expect(info.token).toBe("needs_second_reviewer");
    expect(info.labelKey).toBe("gate.unmapped");
    expect(info.headlineKey).toBe("gate.headlineUnmapped");
    // Prázdná hodnota není „neznámý stav bez jména": plocha jí dá vlastní.
    expect(gateStatusInfo("  ").token).toBe("");
    expect(gateStatusInfo("  ").known).toBe(false);
  });

  it("každý stav má svůj štítek i svou hlavičku, a nikdy tentýž klíč", () => {
    const keys = ["verified", "pending_review", "rejected", "x"].map((t) => gateStatusInfo(t));
    expect(new Set(keys.map((i) => i.labelKey)).size).toBe(4);
    expect(new Set(keys.map((i) => i.headlineKey)).size).toBe(4);
    for (const i of keys) expect(i.labelKey).not.toBe(i.headlineKey);
  });

  it("vyjmenované klíče pokrývají všechno, co modul umí vrátit", () => {
    for (const t of ["verified", "pending", "pending_review", "rejected", "nesmysl", ""]) {
      const info = gateStatusInfo(t);
      expect(GATE_COPY_KEYS, t).toContain(info.labelKey);
      expect(GATE_COPY_KEYS, t).toContain(info.headlineKey);
    }
  });
});
