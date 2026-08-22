/* Case ② Effort — batch 010 staleness probe: what did the pass-42 committee-dedupe
 * correction move, and what published prose does it now contradict?
 *
 * Reads a COPY (PGLITE_PATH=./.pglite-copy-effort). No writes, no LLM.
 *
 *   PGLITE_PATH=./.pglite-copy-effort npx tsx scripts/case-loops/effort/pass42-drift.ts
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { getStore } from "@/lib/db/store";

const OUT = "docs/data-analysis/case-effort";
const num = (x: unknown): number | null => (typeof x === "number" && Number.isFinite(x) ? x : null);

interface LedgerUnit {
  pspId: number; name: string; club: string; rank: number; contribution_score: number;
  stage: string; batch: number | null; signal: number | null;
  flags: Record<string, unknown>;
}

async function main() {
  const store = await getStore();
  if (!store) throw new Error("no store");

  const ledger = JSON.parse(readFileSync(`${OUT}/ledger.json`, "utf8")) as { batch: number; units: LedgerUnit[] };
  const priorById = new Map(ledger.units.map((u) => [u.pspId, u]));

  const persons = (await store.listKgNodes({ kind: "person", limit: 1000 })) ?? [];
  const passes = new Map<number, number>();

  const rows = persons.map((p) => {
    const pspId = Number(p.id.split(":").pop());
    const prov = (p.props.contribution_provenance ?? {}) as Record<string, unknown>;
    const pass = num(prov.pass);
    if (pass != null) passes.set(pass, (passes.get(pass) ?? 0) + 1);
    const prior = priorById.get(pspId);
    return {
      pspId,
      name: p.label,
      pass,
      ref: typeof prov.ref === "string" ? prov.ref : null,
      score: num(p.props.contribution_score),
      committeeCount: num(p.props.committee_count),
      leadershipCount: num(p.props.leadership_count),
      priorScore: prior?.contribution_score ?? null,
      priorRank: prior?.rank ?? null,
      priorFlags: prior?.flags ?? null,
      // the dossier prose fields the army has authored across batches 001-009
      dossier: {
        summary: typeof p.props.effort_work_summary === "string" ? p.props.effort_work_summary : null,
        headline: typeof p.props.effort_headline === "string" ? p.props.effort_headline : null,
        detail: typeof p.props.effort_detail === "string" ? p.props.effort_detail : null,
        note: typeof p.props.effort_analyst_note === "string" ? p.props.effort_analyst_note : null,
      },
      propKeys: Object.keys(p.props).filter((k) => k.startsWith("effort_")),
    };
  });

  // ── 1. provenance census ───────────────────────────────────────────────────
  console.log(`persons: ${rows.length}`);
  console.log(`contribution_provenance.pass census: ${JSON.stringify(Object.fromEntries([...passes].sort((a, b) => a[0] - b[0])))}`);
  console.log(`refs: ${JSON.stringify([...new Set(rows.map((r) => r.ref))])}`);

  // ── 2. score / rank drift vs the ledger's pass-11 snapshot ─────────────────
  const scoreMoved = rows.filter((r) => r.priorScore != null && r.score != null && Math.abs(r.score - r.priorScore) > 0.001);
  const ranked = [...rows].filter((r) => r.score != null).sort((a, b) => b.score! - a.score!);
  // competition ranks, as /zebricek renders them
  const rankOf = new Map<number, number>();
  ranked.forEach((r) => {
    rankOf.set(r.pspId, ranked.filter((o) => o.score! > r.score!).length + 1);
  });
  const rankMoved = rows.filter((r) => r.priorRank != null && rankOf.get(r.pspId) !== r.priorRank);
  console.log(`\nscore moved: ${scoreMoved.length}/207   rank moved: ${rankMoved.length}/207`);
  const dropped = [...scoreMoved].sort((a, b) => (a.score! - a.priorScore!) - (b.score! - b.priorScore!)).slice(0, 12);
  for (const r of dropped) {
    console.log(`  ${r.name.padEnd(26)} ${String(r.priorScore).padStart(5)} → ${String(r.score).padStart(5)}  (rank ${r.priorRank} → ${rankOf.get(r.pspId)})  committees ${r.committeeCount}`);
  }

  // ── 3. dossier prose coverage ──────────────────────────────────────────────
  const withProse = rows.filter((r) => r.dossier.summary || r.dossier.headline || r.dossier.detail);
  console.log(`\ndossier prose present on ${withProse.length}/207; effort_* prop keys seen: ${JSON.stringify([...new Set(rows.flatMap((r) => r.propKeys))].sort())}`);

  mkdirSync(`${OUT}/payloads`, { recursive: true });
  writeFileSync(`${OUT}/payloads/batch-010-drift.json`, JSON.stringify({
    generatedAt: new Date().toISOString(),
    passCensus: Object.fromEntries(passes),
    rows: rows.map((r) => ({ ...r, newRank: rankOf.get(r.pspId) ?? null })),
  }, null, 2));
  console.log(`\nwrote ${OUT}/payloads/batch-010-drift.json`);

  await store.close();
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
