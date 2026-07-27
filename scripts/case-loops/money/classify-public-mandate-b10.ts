/* Money loop — batch 010: run the ownership-based public-mandate classifier over every
 * company the sweeps flagged as holding public contracts.
 *
 * Batch 009 produced its first indirect-exposure table using a NAME-based public-body
 * test. That test missed Zdravotnický holding Královéhradeckého kraje a.s. — a kraj-owned
 * company under an ordinary `a.s.` form, and the largest CZK figure in the table. Under
 * the case's attribution rule that money is the kraj's own activity and must never be
 * hung on an MP.
 *
 * `lib/analysis/public-body.ts` replaces the name test with ownership: the entity's own
 * `pravniForma`, then its CURRENT shareholders from ARES VR. This script applies it to
 * the real leads and prints, for each, whether the money is attributable at all.
 *
 * Unknown legal-form codes are reported loudly and never silently treated as private.
 *
 *   npx tsx scripts/case-loops/money/classify-public-mandate-b10.ts
 */
import { classifyPublicMandate, shareholdersFromVr, type PublicMandateVerdict } from "@/lib/analysis/public-body";

const BASE = "https://ares.gov.cz/ekonomicke-subjekty-v-be/rest";
const PARENT_SWEEP = "docs/data-analysis/case-money/qmoney-parent-contract-sweep-b9.json";
const COMPANY_SWEEP = "docs/data-analysis/case-money/qmoney-company-sweep-b10.json";
const OUT = "docs/data-analysis/case-money/qmoney-public-mandate-b10.json";
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

interface SweepRow {
  ico: string; label?: string; parent?: string; contracts: number | null; totalCzk: number;
  error?: string | null; mps?: string[]; tieClass?: string | null; children?: string[];
  publishers?: { name: string; contracts: number; czk: number }[];
}

async function aresJson(path: string, ico: string): Promise<unknown | null> {
  const res = await fetch(`${BASE}/${path}/${encodeURIComponent(ico)}`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(30_000),
  });
  const text = await res.text();
  if (text.includes("NENALEZENO")) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    // A non-JSON body is an unknown state, not an empty record — surfaced by the caller.
    return null;
  }
}

async function main() {
  const fs = await import("node:fs/promises");
  const today = new Date().toISOString().slice(0, 10);

  const load = async (p: string, key: "results") => {
    const raw = await fs.readFile(p, "utf8").catch((e: unknown) => {
      console.log(`  (skipping ${p}: ${e instanceof Error ? e.message : String(e)})`);
      return null;
    });
    return raw ? ((JSON.parse(raw) as Record<string, SweepRow[]>)[key] ?? []) : [];
  };

  const parents = (await load(PARENT_SWEEP, "results")).map((r) => ({ ...r, origin: "ownership parent" as const }));
  const companies = (await load(COMPANY_SWEEP, "results")).map((r) => ({ ...r, origin: "MP-tied company" as const }));

  // Only companies that actually hold contracts need an attribution verdict.
  const targets = [...parents, ...companies].filter((r) => !r.error && (r.contracts ?? 0) > 0);
  console.log(`companies holding public contracts, needing an attribution verdict: ${targets.length}\n`);

  interface Row {
    ico: string; name: string; origin: string; contracts: number; totalCzk: number;
    tieClass: string | null; mps: string[]; ownsMpTied: string[];
    legalForm: string | null; verdict: PublicMandateVerdict | null; aresError: string | null;
    topPublishers: { name: string; contracts: number; czk: number }[];
  }
  const rows: Row[] = [];

  for (const t of targets) {
    const name = t.label ?? t.parent ?? t.ico;
    process.stdout.write(`  ${t.ico} ${name.slice(0, 46).padEnd(46)} … `);
    const basic = (await aresJson("ekonomicke-subjekty", t.ico)) as { pravniForma?: string; obchodniJmeno?: string } | null;
    await sleep(400);
    const vr = await aresJson("ekonomicke-subjekty-vr", t.ico);
    await sleep(400);

    if (!basic) {
      rows.push({
        ico: t.ico, name, origin: t.origin, contracts: t.contracts ?? 0, totalCzk: t.totalCzk,
        tieClass: t.tieClass ?? null, mps: t.mps ?? [], ownsMpTied: t.children ?? [],
        legalForm: null, verdict: null, aresError: "ARES basic record not found",
        topPublishers: (t.publishers ?? []).slice(0, 3),
      });
      console.log("ARES: NENALEZENO — no verdict");
      continue;
    }

    const shareholders = shareholdersFromVr(vr, today);
    const verdict = classifyPublicMandate({
      ico: t.ico,
      name: basic.obchodniJmeno ?? name,
      legalForm: basic.pravniForma ?? null,
      shareholders,
      vrRetrieved: vr !== null,
    });
    rows.push({
      ico: t.ico, name: basic.obchodniJmeno ?? name, origin: t.origin,
      contracts: t.contracts ?? 0, totalCzk: t.totalCzk,
      tieClass: t.tieClass ?? null, mps: t.mps ?? [], ownsMpTied: t.children ?? [],
      legalForm: basic.pravniForma ?? null, verdict, aresError: null,
      topPublishers: (t.publishers ?? []).slice(0, 3),
    });
    console.log(
      `forma ${basic.pravniForma} · ${verdict.kind}${verdict.publicOwners.length ? ` (${verdict.publicOwners.map((o) => o.name).join(", ")})` : ""}`,
    );
  }

  const attributable = rows.filter((r) => r.verdict?.attributable);
  const notAttributable = rows.filter((r) => r.verdict && !r.verdict.attributable);
  const noVerdict = rows.filter((r) => !r.verdict);
  const unknownCodes = [...new Set(rows.flatMap((r) => r.verdict?.unknownCodes ?? []))];

  console.log(`\n── NOT ATTRIBUTABLE to any MP (public body / publicly owned) ──`);
  for (const r of notAttributable.sort((a, b) => b.totalCzk - a.totalCzk)) {
    console.log(`  ${r.name} — ${r.totalCzk.toLocaleString("cs-CZ")} CZK · ${r.verdict!.kind}\n      ${r.verdict!.reason}`);
  }
  console.log(`\n── POTENTIALLY ATTRIBUTABLE (private, still only a LEAD) ──`);
  for (const r of attributable.sort((a, b) => b.totalCzk - a.totalCzk)) {
    console.log(`  ${r.name} — ${r.contracts} contract(s), ${r.totalCzk.toLocaleString("cs-CZ")} CZK` +
      `${r.mps.length ? ` · MP: ${r.mps.join(", ")}` : ""}${r.ownsMpTied.length ? ` · owns MP-tied: ${r.ownsMpTied.join(", ")}` : ""}`);
    for (const p of r.topPublishers) console.log(`        payer: ${p.name} — ${p.contracts}×, ${p.czk.toLocaleString("cs-CZ")} CZK`);
  }
  if (noVerdict.length) console.log(`\n── NO VERDICT (ARES record missing) ──\n  ${noVerdict.map((r) => `${r.ico} ${r.name}`).join("\n  ")}`);
  if (unknownCodes.length) console.log(`\n⚠ UNKNOWN legal-form codes encountered — extend lib/analysis/public-body.ts: ${unknownCodes.join(", ")}`);

  await fs.writeFile(
    OUT,
    JSON.stringify(
      {
        batch: 10, track: "money", kind: "public-mandate-classification",
        generatedAt: today,
        note:
          "Applies lib/analysis/public-body.ts (ownership-based) to every company the batch-009 and batch-010 " +
          "sweeps found holding public contracts. `attributable: false` means the money is the public body's own " +
          "activity and must NEVER be attributed to a politician — the case's steward rule, which batch-009's " +
          "name-based test got wrong. `unknown` is never coerced to `private`.",
        counts: {
          classified: rows.length,
          notAttributable: notAttributable.length,
          potentiallyAttributable: attributable.length,
          noVerdict: noVerdict.length,
          unknownLegalFormCodes: unknownCodes,
          czkNotAttributable: notAttributable.reduce((s, r) => s + r.totalCzk, 0),
          czkPotentiallyAttributable: attributable.reduce((s, r) => s + r.totalCzk, 0),
        },
        rows,
      },
      null, 2,
    ),
  );
  console.log(`\nwritten: ${OUT}`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
