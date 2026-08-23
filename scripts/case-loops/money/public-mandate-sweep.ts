/* Money loop — batch 015: run the ownership-based public-mandate classifier over the
 * population it was never run on — the ATTRIBUTABLE tied companies.
 *
 * WHY. Batch 010 built `lib/analysis/public-body.ts` precisely because a name-based
 * public-body test had missed a kraj-owned company under an ordinary `a.s.` form. It then
 * ran it over **four ownership parents** and stopped. The companies whose money the
 * platform actually attributes to named politicians — the 57 attributable tied companies —
 * were never put through it.
 *
 * Batch 014 made the cost visible. After removing 11,77 mld. of co-signed contracts, the
 * largest attributable figure left is **Teplárny Brno, a.s. — 11,82 mld. CZK**, a company
 * 100 % owned by Statutární město Brno, on whose board Petr Hladík sat. Under this case's
 * own steward rule that is the city's money, not his. `classifyTie` cannot see it: it
 * reads the company NAME ("Teplárny Brno" carries no public marker) and the role text
 * ("předseda představenstva" → manager). The same question stands for Pražská energetika,
 * Plzeňská teplárenská, Výstaviště Flora Olomouc and Lesy města Olomouce.
 *
 * TWO AXES, NOT ONE. The batch's design decision, and the reason this does not simply
 * rewrite `tie_class`:
 *
 *   tie_class      describes the ROLE   — what the person does in the company.
 *   public mandate describes the COMPANY — whose money it is.
 *
 * Hladík really is `předseda představenstva`; the role class is not wrong. What is wrong
 * is reading a municipal utility's turnover as money reaching a politician. Conflating the
 * two axes is exactly how the heuristic got here, so this writes a SEPARATE, additive
 * `public_mandate` annotation on the company node and leaves `tie_class` alone.
 *
 * Every verdict carries the ARES URLs it was read from and the date it was read. The
 * classifier is deliberately asymmetric — absence of data yields `unknown`, never
 * `private` — because the expensive error is calling a public body private.
 *
 * Network: ARES REST, free, no token (registr-smluv-token-free-access). No writes.
 *
 *   npx tsx scripts/case-loops/money/public-mandate-sweep-b15.ts
 */
import { getStore } from "@/lib/db/store";
import { KG_READ_CAP } from "@/lib/db/readCap";
import { resolveTieClass } from "@/features/money/reviewTypes";
import { isAttributable, moneyReachesCompany } from "@/features/money/reachableMoney";
import {
  classifyPublicMandate,
  ownershipRecord,
  type PublicMandateVerdict,
} from "@/lib/analysis/public-body";

const BASE = "https://ares.gov.cz/ekonomicke-subjekty-v-be/rest";
// DATED outputs (batch 018): the first version wrote to `batch-015-*` on every run and the
// batch-018 resweep overwrote the COMMITTED pass-58 payload. A committed payload is
// history; a tool writes a new file.
// To the MINUTE, not the day: a same-day rerun of this tool overwrote the committed pass-61
// payload within hours of the "dated files" fix (batch 018). Two runs must never share a name.
const STAMP = new Date().toISOString().slice(0, 16).replace(/:/g, "");
const OUT = `docs/data-analysis/case-money/qmoney-public-mandate-${STAMP}.json`;
const PAYLOAD = `docs/data-analysis/case-money/payloads/public-mandate-${STAMP}.json`;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);

async function aresJson(path: string, ico: string): Promise<{ json: unknown | null; url: string }> {
  const url = `${BASE}/${path}/${encodeURIComponent(ico)}`;
  const res = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(30_000) });
  const text = await res.text();
  if (text.includes("NENALEZENO")) return { json: null, url };
  try {
    return { json: JSON.parse(text) as unknown, url };
  } catch {
    // A non-JSON body is an unknown state, not an empty record.
    return { json: null, url };
  }
}

interface Row {
  companyId: string;
  ico: string;
  name: string;
  contractCzk: number;
  contractCount: number;
  subsidiesCzk: number;
  tieClasses: string[];
  mps: string[];
  legalForm: string | null;
  verdict: PublicMandateVerdict | null;
  aresError: string | null;
  citations: { claim: string; url: string; accessedAt: string }[];
}

async function main() {
  const fs = await import("node:fs/promises");
  const today = new Date().toISOString().slice(0, 10);

  const scope = (process.argv.find((a) => a.startsWith("--scope="))?.split("=")[1] ?? "attributable") as
    | "attributable"
    | "all"
    | "unverdicted";
  const store = await getStore();
  if (!store) throw new Error("no store");
  const companies = await store.listKgNodes({ kind: "company", limit: KG_READ_CAP });
  const persons = await store.listKgNodes({ kind: "person", limit: KG_READ_CAP });
  const linked = await store.listKgEdges({ rel: "linked_to", limit: KG_READ_CAP });
  const supplies = await store.listKgEdges({ rel: "supplies", limit: KG_READ_CAP });
  await store.close();

  const companyById = new Map(companies.map((c) => [c.id, c]));
  const personById = new Map(persons.map((p) => [p.id, p]));

  // Contract money per company, through the SAME predicate the surface uses — so the CZK
  // this batch ranks on is the CZK batch 014 left standing, not the pre-fix figure.
  const czkByCompany = new Map<string, { czk: number; count: number }>();
  for (const e of supplies) {
    if (!moneyReachesCompany(e.props)) continue;
    const cur = czkByCompany.get(e.src) ?? { czk: 0, count: 0 };
    cur.czk += num(e.weight);
    cur.count += 1;
    czkByCompany.set(e.src, cur);
  }

  interface Target {
    companyId: string;
    ico: string;
    name: string;
    tieClasses: Set<string>;
    mps: Set<string>;
  }
  const targets = new Map<string, Target>();
  for (const e of linked) {
    const comp = companyById.get(e.dst);
    if (!comp) continue;
    const cls = resolveTieClass(e.props?.tie_class, String(e.props?.role ?? ""), comp.label);
    // Default scope = attributable companies (the money depends on them). `--scope=all`
    // (batch 019) also sweeps steward-by-role companies: no koruna moves, but the company
    // axis then CORROBORATES the role axis from the register — or contradicts it, which is
    // the case worth seeing. `--scope=unverdicted` = only companies with no verdict yet.
    if (scope === "attributable" && !isAttributable(cls.tieClass)) continue;
    if (scope === "unverdicted" && comp.props?.public_mandate != null) continue;
    const ico = str(comp.props?.ico) ?? comp.id.split(":").pop() ?? "";
    const t = targets.get(comp.id) ?? {
      companyId: comp.id,
      ico,
      name: comp.label,
      tieClasses: new Set<string>(),
      mps: new Set<string>(),
    };
    t.tieClasses.add(cls.tieClass);
    t.mps.add(personById.get(e.src)?.label ?? e.src);
    targets.set(comp.id, t);
  }

  const ordered = [...targets.values()].sort(
    (a, b) =>
      (czkByCompany.get(b.companyId)?.czk ?? 0) - (czkByCompany.get(a.companyId)?.czk ?? 0) ||
      a.companyId.localeCompare(b.companyId),
  );
  console.log(`attributable tied companies needing a mandate verdict: ${ordered.length}\n`);

  const rows: Row[] = [];
  for (const t of ordered) {
    const money = czkByCompany.get(t.companyId) ?? { czk: 0, count: 0 };
    process.stdout.write(
      `  ${t.ico.padEnd(9)} ${t.name.slice(0, 42).padEnd(42)} ${Math.round(money.czk).toLocaleString("cs-CZ").padStart(16)} … `,
    );
    const basic = await aresJson("ekonomicke-subjekty", t.ico);
    await sleep(400);
    const vr = await aresJson("ekonomicke-subjekty-vr", t.ico);
    await sleep(400);

    const comp = companyById.get(t.companyId);
    const base = {
      companyId: t.companyId,
      ico: t.ico,
      name: t.name,
      contractCzk: money.czk,
      contractCount: money.count,
      subsidiesCzk: num(comp?.props?.subsidies_total_czk),
      tieClasses: [...t.tieClasses],
      mps: [...t.mps],
    };

    const b = basic.json as { pravniForma?: string; obchodniJmeno?: string } | null;
    if (!b) {
      rows.push({
        ...base,
        legalForm: null,
        verdict: null,
        aresError: "ARES basic record not found (NENALEZENO)",
        citations: [{ claim: "ARES ekonomické subjekty — záznam nenalezen", url: basic.url, accessedAt: today }],
      });
      console.log("ARES: NENALEZENO — no verdict");
      continue;
    }

    const owners = ownershipRecord(vr.json, today);
    const shareholders = owners.legalPersons;
    const verdict = classifyPublicMandate({
      ico: t.ico,
      name: b.obchodniJmeno ?? t.name,
      legalForm: b.pravniForma ?? null,
      shareholders,
      vrRetrieved: vr.json !== null,
      // Natural persons INCLUDED — the question here is whether the register names an
      // owner at all, not whether it names a public one.
      ownersRecorded: owners.entriesCurrent,
    });
    rows.push({
      ...base,
      name: b.obchodniJmeno ?? t.name,
      legalForm: b.pravniForma ?? null,
      verdict,
      aresError: null,
      citations: [
        { claim: `právní forma ${b.pravniForma ?? "(chybí)"}`, url: basic.url, accessedAt: today },
        {
          claim: vr.json
            ? `veřejný rejstřík: ${owners.entriesCurrent} současných zápisů společníků/akcionářů` +
              (shareholders.filter((s) => s.current).length
                ? ` — právnické osoby: ${shareholders.filter((s) => s.current).map((s) => s.name).join(", ")}`
                : " — žádná z nich právnická osoba")
            : "veřejný rejstřík (VR) — záznam nenačten",
          url: vr.url,
          accessedAt: today,
        },
      ],
    });
    console.log(
      `forma ${b.pravniForma} · ${verdict.kind}${verdict.publicOwners.length ? ` (${verdict.publicOwners.map((o) => o.name).join(", ")})` : ""}`,
    );
  }

  // ── report ───────────────────────────────────────────────────────────────────────────
  const byKind = (k: string) => rows.filter((r) => r.verdict?.kind === k);
  const czk = (rs: Row[]) => rs.reduce((s, r) => s + r.contractCzk, 0);
  const notAttributable = rows.filter((r) => r.verdict && !r.verdict.attributable);
  const unknownCodes = [...new Set(rows.flatMap((r) => r.verdict?.unknownCodes ?? []))];

  const report = {
    generatedFor: "money batch 015",
    generatedAt: today,
    method:
      "lib/analysis/public-body.ts::classifyPublicMandate over every ATTRIBUTABLE tied company; ownership from ARES VR, legal form from ARES basic",
    caveat:
      "the verdict is about the COMPANY (whose money it is), not about the ROLE (tie_class). Nothing here rewrites tie_class and nothing touches review_state.",
    population: {
      attributableTiedCompanies: ordered.length,
      classified: rows.filter((r) => r.verdict).length,
      noVerdict: rows.filter((r) => !r.verdict).length,
    },
    verdicts: {
      "public-body": { companies: byKind("public-body").length, czk: czk(byKind("public-body")) },
      "publicly-owned": { companies: byKind("publicly-owned").length, czk: czk(byKind("publicly-owned")) },
      private: { companies: byKind("private").length, czk: czk(byKind("private")) },
      "ownership-not-published": {
        companies: byKind("ownership-not-published").length,
        czk: czk(byKind("ownership-not-published")),
      },
      unknown: { companies: byKind("unknown").length, czk: czk(byKind("unknown")) },
    },
    notAttributableCzk: czk(notAttributable),
    unknownLegalFormCodes: unknownCodes,
    rows,
  };
  await fs.writeFile(OUT, JSON.stringify(report, null, 2) + "\n", "utf8");

  // ── payload: `public_mandate` on the COMPANY node ────────────────────────────────────
  // NEVER RE-LITIGATE A STRONGER VERDICT (batch 018). `ownership-depth2.ts` can prove public
  // ownership from a PARENT's record (Plzeňská teplárenská ← Město Plzeň, pass 59) where
  // the company's OWN record names nobody — this sweep, reading only the own record, would
  // then file it `ownership-not-published` and overwrite the proof with an absence. A live
  // `publicly-owned` stays unless this sweep ALSO finds public ownership.
  const keepsStronger = (r: Row) =>
    companyById.get(r.companyId)?.props?.public_mandate === "publicly-owned" && r.verdict?.kind !== "publicly-owned";
  const skippedStronger = rows.filter(keepsStronger);
  if (skippedStronger.length) console.log(`
kept live publicly-owned (not overwritten by a weaker own-record verdict): ${skippedStronger.map((r) => r.name).join(", ")}`);
  const proposals = rows
    .filter((r) => r.verdict && !keepsStronger(r))
    .map((r) => ({
      id: r.companyId,
      props: {
        public_mandate: r.verdict!.kind,
        public_mandate_attributable: r.verdict!.attributable,
        public_mandate_reason: r.verdict!.reason,
        public_mandate_owners: r.verdict!.publicOwners.map((o) => ({
          ico: o.ico,
          name: o.name,
          legalForm: o.legalForm,
        })),
        public_mandate_legal_form: r.legalForm,
      },
      citations: r.citations,
    }));
  await fs.mkdir("docs/data-analysis/case-money/payloads", { recursive: true });
  await fs.writeFile(PAYLOAD, JSON.stringify({ proposals }, null, 2) + "\n", "utf8");

  console.log(`\n--- verdicts over ${ordered.length} attributable tied companies ---`);
  for (const [k, v] of Object.entries(report.verdicts)) {
    console.log(`  ${k.padEnd(16)} ${String(v.companies).padStart(3)} firem  ${Math.round(v.czk).toLocaleString("cs-CZ").padStart(18)} CZK`);
  }
  console.log(`\nNOT attributable: ${Math.round(report.notAttributableCzk).toLocaleString("cs-CZ")} CZK`);
  if (unknownCodes.length) console.log(`unknown legal-form codes (extend the table): ${unknownCodes.join(", ")}`);
  console.log(`\n-> ${OUT}\n-> ${PAYLOAD}`);
}

main().then(() => process.exit(0));
