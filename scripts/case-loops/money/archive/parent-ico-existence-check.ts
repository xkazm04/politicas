/* Money loop — batch 009, Q-money-19: do the ownership-layer parents' IČOs EXIST?
 *
 * The parent-contract sweep returned 0 contracts for "AGROFERT HOLDING, a.s." and
 * "AGROFERT a.s." — a result nobody should accept at face value for the most
 * contract-heavy private group in the country. It does not hold: BOTH IČOs
 * (25130072, 60197773) return NENALEZENO from ARES's basic endpoint AND from the
 * `-vr` endpoint (the doctrine's required check before asserting any absence). The
 * real AGROFERT, a.s. is IČO 26185610.
 *
 * That means batch-006's ownership slice minted company nodes on identifiers that
 * do not exist in the registry — and the ledger headlined one of them as "a real
 * dated AGROFERT ownership chain". This script checks EVERY node in the ownership
 * layer the same way, so the blast radius is measured rather than guessed.
 *
 * A NENALEZENO here is not proof the company never existed (a long-dissolved subject
 * can fall out of ARES), but it does mean the id is unusable as a registry key: no
 * corroboration, no contract query, no deep-link can ever resolve it. Those nodes
 * cannot support a claim about anyone.
 *
 * Read-only; hits ARES once (basic) or twice (adds -vr) per IČO, paced.
 *
 *   npx tsx scripts/case-loops/money/parent-ico-existence-check.ts
 */
import { getStore } from "@/lib/db/store";

const OUT = "docs/data-analysis/case-money/qmoney-ico-existence-b9.json";
const BASE = "https://ares.gov.cz/ekonomicke-subjekty-v-be/rest";
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function aresName(path: string, ico: string): Promise<{ found: boolean; name: string | null; raw: string }> {
  const res = await fetch(`${BASE}/${path}/${encodeURIComponent(ico)}`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(30_000),
  });
  const text = await res.text();
  if (text.includes("NENALEZENO")) return { found: false, name: null, raw: "NENALEZENO" };
  try {
    const j = JSON.parse(text) as { obchodniJmeno?: string; icoId?: string };
    return { found: true, name: j.obchodniJmeno ?? j.icoId ?? null, raw: "ok" };
  } catch {
    // A non-JSON body is an unknown state, never a silent "found" or "missing".
    return { found: false, name: null, raw: `unparseable (${res.status})` };
  }
}

async function main() {
  const store = await getStore();
  if (!store) throw new Error("no store");
  const fs = await import("node:fs/promises");
  const companies = await store.listKgNodes({ kind: "company", limit: 100_000 });
  const ownsStake = await store.listKgEdges({ rel: "owns_stake", limit: 100_000 });
  const linked = await store.listKgEdges({ rel: "linked_to", limit: 100_000 });
  await store.close();

  const byId = new Map(companies.map((c) => [c.id, c]));
  const tied = new Set(linked.map((e) => e.dst));
  // Every node touched by the ownership layer, parents AND children.
  const layer = [...new Set(ownsStake.flatMap((e) => [e.src, e.dst]))];

  const rows: {
    id: string; label: string; ico: string; role: "parent" | "child" | "both"; mpTied: boolean;
    basic: boolean; vr: boolean; aresName: string | null; verdict: string;
  }[] = [];

  for (const id of layer) {
    const node = byId.get(id);
    const ico = String((node?.props as Record<string, unknown>)?.ico ?? "");
    const isParent = ownsStake.some((e) => e.src === id);
    const isChild = ownsStake.some((e) => e.dst === id);
    if (!ico) {
      rows.push({ id, label: node?.label ?? id, ico: "", role: isParent && isChild ? "both" : isParent ? "parent" : "child", mpTied: tied.has(id), basic: false, vr: false, aresName: null, verdict: "NO ICO PROP" });
      continue;
    }
    const basic = await aresName("ekonomicke-subjekty", ico);
    await sleep(400);
    const vr = basic.found ? { found: true, name: basic.name } : await aresName("ekonomicke-subjekty-vr", ico);
    await sleep(400);
    const verdict = basic.found
      ? "exists"
      : vr.found
        ? "basic missing, VR present"
        : "NOT IN REGISTRY (basic + VR)";
    rows.push({
      id, label: node?.label ?? id, ico,
      role: isParent && isChild ? "both" : isParent ? "parent" : "child",
      mpTied: tied.has(id), basic: basic.found, vr: vr.found,
      aresName: basic.name ?? vr.name ?? null, verdict,
    });
    const nameMismatch = basic.name && node?.label && !basic.name.toLowerCase().startsWith(node.label.slice(0, 8).toLowerCase());
    console.log(
      `  ${ico} ${(node?.label ?? id).padEnd(48).slice(0, 48)} ${verdict}` +
        (nameMismatch ? `  ⚠ ARES says "${basic.name}"` : ""),
    );
  }

  const missing = rows.filter((r) => r.verdict.startsWith("NOT IN REGISTRY") || r.verdict === "NO ICO PROP");
  console.log(`\nownership-layer nodes checked: ${rows.length}`);
  console.log(`UNRESOLVABLE IN THE REGISTRY: ${missing.length}`);
  for (const m of missing) console.log(`   ${m.role.padEnd(6)} ${m.mpTied ? "[MP-TIED] " : ""}${m.ico || "(no ico)"} ${m.label}`);

  await fs.writeFile(
    OUT,
    JSON.stringify(
      {
        batch: 9, track: "money", item: "Q-money-19",
        kind: "ownership-layer-ico-existence-check",
        generatedAt: new Date().toISOString().slice(0, 10),
        note:
          "Checks every company node in the `owns_stake` layer against ARES's basic AND -vr endpoints (the " +
          "doctrine's required pair before asserting an absence). NENALEZENO on both does not prove the company " +
          "never existed, but it does mean the id cannot serve as a registry key — no corroboration, no contract " +
          "query, no deep link resolves it, so the node cannot support a claim about anyone.",
        counts: { checked: rows.length, unresolvable: missing.length },
        rows,
      },
      null, 2,
    ),
  );
  console.log(`\nwritten: ${OUT}`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
