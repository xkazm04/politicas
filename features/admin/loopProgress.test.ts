// Diskovou polovinu /admin loaderu (postup case-smyček + stav smyček) drží
// tenhle test — NE lib/testing/loaders.test.ts, kde žije zbytek getAdminData:
// tam je jeden PGlite boot na celý soubor a tohle žádný store nepotřebuje
// (`loadLoopProgress` i `loadLoopsStatus` jsou čistě čtení souborů v repu).
//
// Čte se OPRAVDOVÝ trezor, protože právě rozchod mezi trezorem a konzolí byl
// ta chyba: 2026-08-12 hlásil /admin u zákonů 57 ze 141 (součet dávek 003+004)
// nad žurnálem, který nese dávky 011–021, a u peněz trvale plnou lištu, kterou
// nikdy nic nezměřilo. Očekávání se proto DOPOČÍTÁVAJÍ z týchž souborů
// nezávislým čtením — ne zamrzlými číslicemi, které by za trezorem zaostaly
// úplně stejně.

import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { loadLoopProgress, loadLoopsStatus } from "./getAdminData";
import { LOOPS_STATUS_SOURCE, parseLoopsStatus } from "./loops/loopState";

const VAULT = "docs/data-analysis";

const readLedger = (rel: string): Record<string, unknown> =>
  JSON.parse(readFileSync(`${VAULT}/${rel}`, "utf8")) as Record<string, unknown>;

const distinctBatchReports = (dir: string): number =>
  new Set(
    readdirSync(`${VAULT}/${dir}`)
      .map((f) => f.match(/^batch-(\d+)\.md$/))
      .filter((m): m is RegExpMatchArray => m != null)
      .map((m) => Number(m[1])),
  ).size;

const progress = loadLoopProgress();
const byCase = new Map(progress.map((p) => [p.case, p]));

describe("loadLoopProgress — postup se MĚŘÍ, nedeklaruje", () => {
  it("nese všechny tři případy a každý cituje své soubory", () => {
    expect(progress.map((p) => p.case)).toEqual(["money", "effort", "law"]);
    for (const p of progress) {
      expect(p.source.length).toBeGreaterThan(0);
      expect(p.labelCs.length).toBeGreaterThan(0);
      // Postup buď je změřený (pak má obě strany zlomku), nebo se přizná větou.
      if (p.progressPct == null) expect(p.progressNoteCs).not.toBeNull();
      else {
        expect(p.unitsProcessed).not.toBeNull();
        expect(p.unitsTotal).not.toBeNull();
      }
    }
  });

  it("zákony: pokrytí je NEJNOVĚJŠÍ kumulativní blok, ne součet dávek 003+004", () => {
    const ledger = readLedger("case-law/ledger.json");
    const totals = ledger.totals as Record<string, Record<string, unknown>>;
    const newest = Object.keys(totals)
      .map((k) => ({ k, m: k.match(/^batch(\d+)Verdicts$/) }))
      .filter((e): e is { k: string; m: RegExpMatchArray } => e.m != null)
      .sort((a, b) => Number(b.m[1]) - Number(a.m[1]))
      .find((e) => typeof totals[e.k].billsWithVerdictTotal === "number");
    expect(newest).toBeDefined();
    const cumulative = totals[newest!.k].billsWithVerdictTotal as number;

    const law = byCase.get("law")!;
    expect(law.unitsProcessed).toBe(cumulative);
    expect(law.unitsTotal).toBe(totals.bills as unknown as number);

    // Zamrzlý součet, který tu stál do 2026-08-12 — pokrytí ho musí přerůst.
    const retiredSum =
      (Number(totals.existingForensic) || 0) +
      (Number(totals.batch003NewVerdicts) || 0) +
      (Number(totals.batch004NewVerdicts) || 0);
    expect(law.unitsProcessed!).toBeGreaterThan(retiredSum);
    // Kumulativní pokrytí se NESČÍTÁ přes dávky — součet 011–021 by přerostl korpus.
    expect(law.unitsProcessed!).toBeLessThanOrEqual(law.unitsTotal!);
    expect(law.progressNoteCs).toContain("kumulativní");
  });

  it("zákony: počet dávek je počet zpráv na disku, ne poslední klíč v JSONu", () => {
    expect(byCase.get("law")!.batchesCompleted).toBe(distinctBatchReports("case-law"));
  });

  it("zákony: titulek je poznámka nejnovější dávky, ne zamrzlé batch004Note", () => {
    const ledger = readLedger("case-law/ledger.json");
    const stale = ledger.batch004Note;
    const law = byCase.get("law")!;
    expect(law.latestHeadline).not.toBeNull();
    if (typeof stale === "string") expect(law.latestHeadline).not.toBe(stale);
  });

  it("peníze: žádná lišta — žurnál si o postupu protiřečí a konzole to řekne", () => {
    const ledger = readLedger("case-money/ledger.json");
    const counts = (ledger.summary as Record<string, Record<string, unknown>>).counts;
    const money = byCase.get("money")!;
    // Populace je fakt ze žurnálu a zůstává; postup se nedosazuje.
    expect(money.unitsTotal).toBe(counts.tiesEnumerated as unknown as number);
    expect(money.unitsProcessed).toBeNull();
    expect(money.progressPct).toBeNull();
    expect(money.progressNoteCs).toContain("bez měřitelného postupu");
    expect(money.progressNoteCs).toContain("units[].stage");
  });

  it("peníze: počet dávek jde z disku, kde jich je víc než v žurnálu", () => {
    const money = byCase.get("money")!;
    const onDisk = distinctBatchReports("case-money");
    expect(money.batchesCompleted).toBe(onDisk);
    const summary = readLedger("case-money/ledger.json").summary as Record<string, unknown>;
    const ledgerBatches = Object.keys(summary).filter((k) => /^batch\d+$/.test(k)).length;
    expect(onDisk).toBeGreaterThan(ledgerBatches); // právě proto se čte disk
  });

  it("docházka: postup je per-unit sloupec žurnálu, spočítaný nezávisle", () => {
    const ledger = readLedger("case-effort/ledger.json") as {
      population?: number;
      units?: Array<{ stage?: string }>;
    };
    const advanced = (ledger.units ?? []).filter((u) => u.stage && u.stage !== "pending").length;
    const effort = byCase.get("effort")!;
    expect(effort.unitsProcessed).toBe(advanced);
    expect(effort.unitsTotal).toBe(ledger.population);
    expect(effort.progressNoteCs).toContain("units[].stage");
  });
});

describe("loadLoopsStatus — stav smyček se čte z dokumentu", () => {
  it("souhlasí s nezávislým přečtením docs/case-loops.md", () => {
    const expected = parseLoopsStatus(readFileSync(LOOPS_STATUS_SOURCE, "utf8"));
    expect(loadLoopsStatus()).toEqual(expected);
  });

  it("dokument dnes hlásí běh — a konzole ho nesmí přepsat pauzou", () => {
    // Ne zamrzlá číslice, ale kontrakt: co je v dokumentu, to visí v konzoli.
    // Do 2026-08-12 tu byla konstanta `LOOPS_PAUSED = true` a tenhle vztah
    // neplatil ani jednou od 2026-07-25.
    const doc = readFileSync(LOOPS_STATUS_SOURCE, "utf8");
    const stated = /\*\*\s*STATUS\b[^:*]*:\s*([A-Za-z-]+)/.exec(doc)?.[1]?.toUpperCase() ?? null;
    expect(stated).not.toBeNull();
    expect(loadLoopsStatus().token).toBe(stated);
    if (stated === "RUNNING") expect(loadLoopsStatus().state).toBe("running");
  });
});
