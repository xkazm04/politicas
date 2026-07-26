import { describe, expect, it } from "vitest";
import {
  BILL_STAGES,
  BILLS,
  BUDGET_YEARS,
  CHAMBER_STATS,
  CHAMBER_TREND,
  composite,
  EVENTS,
  LAW_CHANGES,
  MONEY_TIES,
  MPS,
  PARTIES,
  PILLARS,
  ROLL_CALLS,
  TOWNS,
  TREND_QUARTERS,
} from "./data";
import { chamberSplit, disciplineByParty, partyLine } from "./votes";
import { CHAMBER_SUMMARY, LEADERBOARD } from "./leaderboard";
import { czech, czechInt } from "../format";

describe("pilíře (metodika v1.4)", () => {
  it("váhy dávají dohromady 1", () => {
    const total = PILLARS.reduce((s, p) => s + p.weight, 0);
    expect(total).toBeCloseTo(1);
  });

  it("každý pilíř cituje svůj zdroj", () => {
    for (const p of PILLARS) expect(p.source.length).toBeGreaterThan(0);
  });
});

describe("vzorek poslanců", () => {
  it("score odpovídá composite(pillars) — jinak se na obrazovce ukážou dvě různá čísla", () => {
    for (const mp of MPS) {
      expect(mp.score, mp.name).toBeCloseTo(composite(mp.pillars), 5);
    }
  });

  it("trend má délku os čtvrtletí a končí aktuálním skóre", () => {
    for (const mp of MPS) {
      expect(mp.trend, mp.name).toHaveLength(TREND_QUARTERS.length);
      expect(mp.trend.at(-1), mp.name).toBeCloseTo(mp.score, 5);
    }
  });

  it("pořadí řádků odpovídá klesajícímu skóre", () => {
    const sorted = [...MPS].sort((a, b) => b.score - a.score);
    expect(MPS.map((m) => m.id)).toEqual(sorted.map((m) => m.id));
  });
});

describe("data dashboardu — referenční integrita", () => {
  const mpIds = new Set(MPS.map((m) => m.id));

  it("hlasování mají hlas pro každého poslance vzorku a rebelové hlasovali", () => {
    for (const rc of ROLL_CALLS) {
      expect(Object.keys(rc.perMP).sort(), rc.id).toEqual([...mpIds].sort());
      for (const rebel of rc.rebels) {
        expect(mpIds.has(rebel), `${rc.id}: ${rebel}`).toBe(true);
        expect(["pro", "proti", "zdržel se"], `${rc.id}: rebel ${rebel} musí mít hlas`).toContain(
          rc.perMP[rebel],
        );
      }
    }
  });

  it("peněžní vazby a události odkazují na známé poslance a citují zdroj", () => {
    for (const t of MONEY_TIES) {
      expect(mpIds.has(t.mpId), t.company).toBe(true);
      expect(t.source.length, t.company).toBeGreaterThan(0);
    }
    for (const e of EVENTS) {
      if (e.mpId) expect(mpIds.has(e.mpId), e.id).toBe(true);
      expect(e.source.length, e.id).toBeGreaterThan(0);
    }
  });

  it("trend sněmovny sedí na osu čtvrtletí", () => {
    expect(CHAMBER_TREND).toHaveLength(TREND_QUARTERS.length);
  });
});

describe("odkazy událostí (FeedEvent.refs) a dárcovské vazby (MoneyTie)", () => {
  const mpIds = new Set(MPS.map((m) => m.id));
  const rcIds = new Set(ROLL_CALLS.map((r) => r.id));
  const lawChangeIds = new Set(LAW_CHANGES.map((lc) => lc.id));
  const partyCodes = new Set(PARTIES.map((p) => p.code));

  it("refs.mps odkazuje jen na známé poslance", () => {
    for (const e of EVENTS) {
      for (const id of e.refs?.mps ?? []) {
        expect(mpIds.has(id), `${e.id}: ${id}`).toBe(true);
      }
    }
  });

  it("refs.ties je platný index do MONEY_TIES", () => {
    for (const e of EVENTS) {
      for (const i of e.refs?.ties ?? []) {
        expect(i, `${e.id}: ties[${i}]`).toBeGreaterThanOrEqual(0);
        expect(i, `${e.id}: ties[${i}]`).toBeLessThan(MONEY_TIES.length);
      }
    }
  });

  it("refs.rollCalls odkazuje jen na známá hlasování", () => {
    for (const e of EVENTS) {
      for (const id of e.refs?.rollCalls ?? []) {
        expect(rcIds.has(id), `${e.id}: ${id}`).toBe(true);
      }
    }
  });

  it("refs.lawChanges odkazuje jen na známé změny zákonů", () => {
    for (const e of EVENTS) {
      for (const id of e.refs?.lawChanges ?? []) {
        expect(lawChangeIds.has(id), `${e.id}: ${id}`).toBe(true);
      }
    }
  });

  it("refs.parties odkazuje jen na známé strany", () => {
    for (const e of EVENTS) {
      for (const code of e.refs?.parties ?? []) {
        expect(partyCodes.has(code), `${e.id}: ${code}`).toBe(true);
      }
    }
  });

  it("mpId a refs.mps se neliší — jinak by zvýraznění grafu a odkaz na profil mířily na jiné osoby", () => {
    for (const e of EVENTS) {
      if (e.mpId && e.refs?.mps) {
        expect(e.refs.mps, e.id).toContain(e.mpId);
      }
    }
  });

  it("donorParty odkazuje na známou stranu a taková vazba nese i vykázanou částku daru", () => {
    for (const t of MONEY_TIES) {
      if (t.donorParty) {
        expect(partyCodes.has(t.donorParty), t.company).toBe(true);
        expect(t.donationAmount?.length ?? 0, t.company).toBeGreaterThan(0);
      }
    }
  });
});

describe("hlasování po stranách (VoteTrack)", () => {
  it("mandáty stran dávají dohromady 200", () => {
    expect(PARTIES.reduce((s, p) => s + p.seats, 0)).toBe(200);
  });

  it("rozpad po stranách sedí na mandáty i na celkové součty pro/proti", () => {
    for (const rc of ROLL_CALLS) {
      expect(Object.keys(rc.byParty).sort()).toEqual(PARTIES.map((p) => p.code).sort());
      for (const p of PARTIES) {
        const pv = rc.byParty[p.code];
        expect(pv.pro + pv.proti + pv.zdrzel + pv.omluven, `${rc.id}: ${p.code}`).toBe(p.seats);
      }
      const split = chamberSplit(rc);
      expect(split.pro, rc.id).toBe(rc.pro);
      expect(split.proti, rc.id).toBe(rc.proti);
    }
  });

  it("rebelové ze vzorku skutečně vybočují z linie své strany", () => {
    const partyCodeByName: Record<string, string> = Object.fromEntries(PARTIES.map((p) => [p.name, p.code]));
    for (const rc of ROLL_CALLS) {
      for (const rebelId of rc.rebels) {
        const mp = MPS.find((m) => m.id === rebelId)!;
        const code = partyCodeByName[mp.party] ?? PARTIES.find((p) => p.name.includes(mp.party))?.code;
        const line = partyLine(rc.byParty[code!]);
        expect(rc.perMP[rebelId], `${rc.id}: ${rebelId}`).not.toBe(line);
      }
    }
  });

  it("disciplína je v rozsahu 0–100 a seřazená sestupně", () => {
    const rows = disciplineByParty();
    for (const r of rows) {
      expect(r.avg).toBeGreaterThanOrEqual(0);
      expect(r.avg).toBeLessThanOrEqual(100);
    }
    expect([...rows].sort((a, b) => b.avg - a.avg).map((r) => r.code)).toEqual(rows.map((r) => r.code));
  });
});

describe("plný žebříček (CivicScore)", () => {
  it("má přesně 200 řádků a skóre ostře klesá", () => {
    expect(LEADERBOARD).toHaveLength(200);
    for (let i = 1; i < LEADERBOARD.length; i++) {
      expect(LEADERBOARD[i].score, `rank ${i + 1}`).toBeLessThan(LEADERBOARD[i - 1].score);
      expect(LEADERBOARD[i].rank).toBe(i + 1);
    }
  });

  it("vzorek sedí na kotevních pořadích se svým skóre", () => {
    for (const mp of MPS) {
      const row = LEADERBOARD.find((r) => r.id === mp.id)!;
      expect(row.rank, mp.name).toBe(mp.rank);
      expect(row.score, mp.name).toBe(mp.score);
      expect(row.sample).toBe(true);
    }
  });

  it("mandáty po stranách odpovídají PARTIES a jména se neopakují", () => {
    for (const p of PARTIES) {
      const count = LEADERBOARD.filter((r) => r.partyCode === p.code).length;
      expect(count, p.name).toBe(p.seats);
    }
    const names = new Set(LEADERBOARD.map((r) => r.name));
    expect(names.size).toBe(200);
  });

  it("i generovaným řádkům sedí composite(pillars) == score", () => {
    for (const r of LEADERBOARD) {
      expect(composite(r.pillars), `${r.rank} ${r.name}`).toBeCloseTo(r.score, 5);
    }
  });

  it("agregátní dlaždice a trend jsou přišité k počítanému souhrnu", () => {
    const avgStat = CHAMBER_STATS.find((s) => s.key === "avg")!;
    expect(avgStat.value).toBe(czech(CHAMBER_SUMMARY.avg));
    expect(avgStat.sub).toContain(czech(CHAMBER_SUMMARY.median));
    expect(avgStat.sub).toContain(czech(CHAMBER_SUMMARY.sigma));
    expect(CHAMBER_TREND.at(-1)).toBeCloseTo(CHAMBER_SUMMARY.avg, 5);
  });
});

describe("BudgetMirror + LawWatch data (Fáze 3)", () => {
  it("trend dluhu měst sedí na osu let a končí aktuálním dluhem", () => {
    for (const t of TOWNS) {
      expect(t.debtTrend, t.name).toHaveLength(BUDGET_YEARS.length);
      expect(t.debtTrend.at(-1), t.name).toBe(t.debtPerCapita);
      expect(t.population, t.name).toBeGreaterThan(0);
    }
  });

  it("změny zákonů odkazují na existující hlasování a mají odlišná znění", () => {
    const rcIds = new Set(ROLL_CALLS.map((r) => r.id));
    for (const lc of LAW_CHANGES) {
      expect(rcIds.has(lc.rollCallId), lc.id).toBe(true);
      expect(lc.before, lc.id).not.toBe(lc.after);
    }
  });

  it("tisky v potrubí mají platnou fázi a existující hlasování", () => {
    const rcIds = new Set(ROLL_CALLS.map((r) => r.id));
    for (const b of BILLS) {
      expect(b.stage, b.tisk).toBeGreaterThanOrEqual(0);
      expect(b.stage, b.tisk).toBeLessThan(BILL_STAGES.length);
      if (b.rollCallId) expect(rcIds.has(b.rollCallId), b.tisk).toBe(true);
      // Hlasování ve 3. čtení implikuje, že tisk 3. čtením prošel (nebo padl).
      if (b.rollCallId) expect(b.stage, b.tisk).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("české formátování", () => {
  it("czech používá desetinnou čárku", () => {
    expect(czech(88.3)).toBe("88,3");
    expect(czech(40)).toBe("40,0");
  });

  it("czechInt odděluje tisíce", () => {
    expect(czechInt(5214)).toMatch(/^5.214$/); // oddělovač je úzká mezera
  });
});
