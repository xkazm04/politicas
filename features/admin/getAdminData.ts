// Server-only: the /admin loader. The case loops (money/effort/law —
// docs/case-loops.md) leave their state behind in the vault; this reads it so
// the operator can see progress and drive review without digging through the
// files by hand. WHETHER THE LOOPS RUN IS READ, NOT DECLARED (2026-08-12):
// until now a `LOOPS_PAUSED = true` constant asserted "manifestační fáze"
// while the document itself has said RUNNING since 2026-07-25 and the vault
// stands at pass 55 — a hardcoded flag outlived the operation it described and
// silenced the staleness half of mission control. Three source families, each
// read independently and each allowed to fail on its own:
//
//   1. Case ledgers (docs/data-analysis/case-{money,effort,law}/ledger.json +
//      ledger.md / batch-NNN.md) — hand-written by loop drivers, DIFFERENT
//      shape per case (see the per-case builders below). Read straight off
//      disk; these are repo files and the app runs locally.
//   2. Vault files (graph-log.md pass headings, frontier.md per-case open
//      tables) — shared, freeform markdown. Parsing is regex-based
//      best-effort and MUST degrade to null/empty on drift, never throw.
//   3. The live graph (getStore()) — review-pipeline state on `linked_to`
//      edges and `bill` nodes, plus review_audit and graph totals.
//
// Every exported value takes the "degrade to partial, never crash" contract:
// a missing file, an empty table, or an unavailable store yields nulls/zeros
// for that slice only — the rest of the page still renders. Never imported
// into a client component (only `import type` is safe there).

import "server-only";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { czechInt } from "@/lib/format";
import { reportLoaderFailure } from "@/lib/db/loaderGuard";
import { getStore } from "@/lib/db/store";
import { KG_READ_CAP } from "@/lib/db/readCap";
import { resolveTieClass, reviewTier } from "@/features/money/reviewTypes";
import { getTripwireData } from "./getTripwireData";
import { LOOPS_STATUS_SOURCE, parseLoopsStatus, parsePassLog, type LoopsStatusFact } from "./loops/loopState";
import type {
  AdminData,
  CaseId,
  ForensicReviewSummary,
  ForensicVerdictSummary,
  GraphTotals,
  LoopCaseProgress,
  MoneyLeadSummary,
  ReviewAuditSummary,
  ReviewHubData,
  SystemState,
  TieReviewSummary,
  VaultHeads,
  VaultPassEntry,
} from "./adminTypes";

const ROOT = process.cwd();
const VAULT = "docs/data-analysis";

// ── generic disk helpers ─────────────────────────────────────────────────

function readTextSafe(relPath: string): string | null {
  try {
    const p = join(ROOT, relPath);
    if (!existsSync(p)) return null;
    return readFileSync(p, "utf8");
  } catch (err) {
    reportLoaderFailure(`getAdminData.readTextSafe:${relPath}`, err);
    return null;
  }
}

function readJsonSafe<T>(relPath: string): T | null {
  const raw = readTextSafe(relPath);
  if (raw == null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch (err) {
    reportLoaderFailure(`getAdminData.readJsonSafe:${relPath}`, err);
    return null;
  }
}

function numOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

// ── docs/case-loops.md: whether the loops run at all ──────────────────────

/**
 * Stav case-smyček ČTENÝ z operátorova vlastního dokumentu (STATUS řádek).
 * `readTextSafe` hlásí selhání přes `reportLoaderFailure` a vrací null; null
 * projde `parseLoopsStatus` do stavu „unknown“, takže nečitelný soubor nikdy
 * nedosadí pauzu ani běh — přizná se, že se stav nepřečetl. Exportováno pro
 * velín smyček (loops/getLoopState.ts): jeden pramen, jedna pravda.
 */
export function loadLoopsStatus(): LoopsStatusFact {
  return parseLoopsStatus(readTextSafe(LOOPS_STATUS_SOURCE));
}

/**
 * Kolik dávek case-smyčka opravdu odjela = kolik `batch-NNN.md` zpráv v jejím
 * adresáři leží. Žurnály (ledger.json) za realitou zaostávají — case-money jich
 * v `summary` nese 6, na disku je 11 — a číslo v konzoli má popisovat provoz,
 * ne poslední ruční editaci JSONu. Počítají se ROZLIŠENÉ dávky, ne maximum:
 * díra v číslování by se maximem tvářila jako hotová práce, a díry tu opravdu
 * jsou (case-law nemá `batch-008.md`, jen jeho audit a reflexi → 20 dávek, ne
 * 21; case-money postrádá 005 a 007 → 11). Varianty (`batch-008-audit.md`,
 * `batch-012-p1.md`) se nezapočítávají — nejsou to dávky.
 */
function countBatchReports(caseDir: string): number | null {
  try {
    const dir = join(ROOT, caseDir);
    if (!existsSync(dir)) return null;
    const nums = new Set(
      readdirSync(dir)
        .map((f) => f.match(/^batch-(\d+)\.md$/))
        .filter((m): m is RegExpMatchArray => m != null)
        .map((m) => Number(m[1])),
    );
    return nums.size > 0 ? nums.size : null;
  } catch (err) {
    // A nice-to-have: the ledger's own numbers still stand without it — but a
    // degradation still leaves a trace, never a silent null.
    reportLoaderFailure(`getAdminData.countBatchReports:${caseDir}`, err);
    return null;
  }
}

/** Nejnovější zpráva o dávce jako lidský titulek — poslední oddíl souboru. */
function latestBatchReportHeadline(caseDir: string): string | null {
  try {
    const dir = join(ROOT, caseDir);
    if (!existsSync(dir)) return null;
    const newest = readdirSync(dir)
      .map((f) => ({ f, m: f.match(/^batch-(\d+)\.md$/) }))
      .filter((e): e is { f: string; m: RegExpMatchArray } => e.m != null)
      .sort((a, b) => Number(b.m[1]) - Number(a.m[1]))[0];
    if (!newest) return null;
    const md = readTextSafe(`${caseDir}/${newest.f}`);
    return md ? extractLatestSection(md) : null;
  } catch (err) {
    reportLoaderFailure(`getAdminData.latestBatchReportHeadline:${caseDir}`, err);
    return null;
  }
}

function pct(processed: number | null, total: number | null): number | null {
  if (processed == null || total == null || total <= 0) return null;
  return Math.max(0, Math.min(100, Math.round((processed / total) * 1000) / 10));
}

function truncate(s: string, max: number): string {
  const clean = s.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

/** Best-effort "what happened most recently" line from a batch/steering
 *  markdown file: the body of the LAST heading section (`##`–`####`, so a
 *  file whose batch entries are `###` subheadings under one `## Batch log`
 *  parent — case-effort's shape — still lands on the latest BATCH, not the
 *  parent's own intro text), first paragraph. Formats drift across cases
 *  (money/effort/law) — this is intentionally loose, never a strict parser. */
function extractLatestSection(md: string, maxLen = 320): string | null {
  const heads = [...md.matchAll(/^#{2,4}\s+.*$/gm)];
  if (heads.length === 0) return null;
  const last = heads[heads.length - 1];
  const start = (last.index ?? 0) + last[0].length;
  const body = md.slice(start).trim();
  if (!body) return null;
  // Drop markdown table rows / bare bullet markers, keep prose.
  const firstParagraph = body.split(/\n\s*\n/)[0] ?? body;
  return truncate(firstParagraph.replace(/^[-*]\s*/gm, ""), maxLen);
}

// ── frontier.md: per-case open-item counts (best-effort table scan) ───────

function parseFrontierOpenCounts(text: string): Partial<Record<CaseId, number>> {
  const counts: Partial<Record<CaseId, number>> = {};
  let current: CaseId | null = null;
  for (const line of text.split(/\r?\n/)) {
    const heading = line.match(/^#{2,3}\s+(.*)$/);
    if (heading) {
      const t = heading[1].toLowerCase();
      current = t.includes("money") ? "money" : t.includes("effort") ? "effort" : t.includes("law") ? "law" : null;
      continue;
    }
    if (!current) continue;
    const trimmed = line.trim();
    if (!trimmed.startsWith("|")) continue;
    if (/^\|\s*-+/.test(trimmed)) continue; // separator row
    const cells = trimmed.split("|").map((c) => c.trim()).filter((c) => c.length > 0);
    if (cells.length === 0) continue;
    if (/^id$/i.test(cells[0])) continue; // header row
    const status = cells[cells.length - 1].toLowerCase();
    const isOpen = status.includes("open") && !/✅|done|retired|closed/.test(status);
    if (isOpen) counts[current] = (counts[current] ?? 0) + 1;
  }
  return counts;
}

function loadFrontierOpenCounts(): Partial<Record<CaseId, number>> {
  try {
    const text = readTextSafe(`${VAULT}/frontier.md`);
    if (!text) return {};
    return parseFrontierOpenCounts(text);
  } catch {
    return {};
  }
}

// ── graph-log.md: shared pass sequence ─────────────────────────────────────

function parseVaultHeads(text: string): VaultHeads {
  // Jeden parser pass hlaviček pro celou /admin plochu — velín smyček (6E)
  // čte tytéž hlavičky přes parsePassLog, žádná druhá regex pravda.
  const entries: VaultPassEntry[] = parsePassLog(text);
  const lastPass = entries.length ? entries[entries.length - 1].pass : null;
  return { lastPass, recentPasses: entries.slice(-3).reverse() };
}

function loadVaultHeads(): VaultHeads {
  try {
    const text = readTextSafe(`${VAULT}/graph-log.md`);
    if (!text) return { lastPass: null, recentPasses: [] };
    return parseVaultHeads(text);
  } catch {
    return { lastPass: null, recentPasses: [] };
  }
}

// ── per-case loop progress (bespoke — the three ledger.json shapes diverge) ─

function emptyProgress(id: CaseId, labelCs: string, source: string): LoopCaseProgress {
  return {
    case: id,
    labelCs,
    batchesCompleted: null,
    unitsProcessed: null,
    unitsTotal: null,
    progressPct: null,
    progressNoteCs: null,
    latestHeadline: null,
    openFrontier: null,
    source,
  };
}

const MONEY_DIR = `${VAULT}/case-money`;
const LAW_DIR = `${VAULT}/case-law`;

function loadMoneyProgress(): LoopCaseProgress {
  const source = "docs/data-analysis/case-money/ledger.json + batch-NNN.md";
  const labelCs = "Peníze (FollowTheMoney)";
  try {
    const ledger = readJsonSafe<{ summary?: Record<string, unknown>; units?: Array<{ stage?: string }> }>(
      `${MONEY_DIR}/ledger.json`,
    );
    const batchesCompleted = countBatchReports(MONEY_DIR);
    if (!ledger?.summary) {
      return {
        ...emptyProgress("money", labelCs, source),
        batchesCompleted,
        latestHeadline: latestBatchReportHeadline(MONEY_DIR),
      };
    }
    const summary = ledger.summary;
    const batchNums = Object.keys(summary)
      .map((k) => k.match(/^batch(\d+)$/))
      .filter((m): m is RegExpMatchArray => m != null)
      .map((m) => Number(m[1]));
    const lastLedgerBatch = batchNums.length ? Math.max(...batchNums) : null;
    const lastBatch = lastLedgerBatch != null ? (summary[`batch${lastLedgerBatch}`] as Record<string, unknown> | undefined) : undefined;
    const counts = (summary.counts ?? {}) as Record<string, unknown>;
    const unitsTotal = numOrNull(counts.tiesEnumerated);

    // BEZ MĚŘITELNÉHO POSTUPU (2026-08-12). Do teď tu stálo `unitsProcessed =
    // unitsTotal` — přiřazení, ne měření, takže lišta byla trvale na 100 %
    // bez ohledu na to, co v žurnálu je. Měřit je z čeho, ale ŽURNÁL SI SÁM
    // ODPORUJE: jeho per-unit sloupec `units[].stage` hlásí 0 z 211 posunutých,
    // zatímco `summary.batchN.gate` hlásí populaci za uzavřenou. Dvě tvrzení
    // jednoho souboru, nic na disku je nerozsoudí — takže se nevybírá ani
    // jedno: postup zůstane nehodnocen, obě čísla se vypíšou a lišta se
    // nevykreslí. (Fronta lidské brány je vlastní veličina — /penize/kontrola.)
    const stageAdvanced = Array.isArray(ledger.units)
      ? ledger.units.filter((u) => u.stage && u.stage !== "pending").length
      : null;
    const progressNoteCs =
      unitsTotal == null
        ? "bez měřitelného postupu — žurnál nenese počet vyčtených vazeb"
        : `bez měřitelného postupu — žurnál si odporuje: per-unit sloupec units[].stage hlásí ` +
          `${stageAdvanced == null ? "nečitelný počet" : czechInt(stageAdvanced)} z ${czechInt(unitsTotal)} ` +
          `posunutých vazeb, souhrn summary.batch${lastLedgerBatch ?? "N"} hlásí populaci za uzavřenou. ` +
          `Nic na disku to nerozsoudí, takže se nevybírá ani jedno. Fronta lidské brány je vlastní ` +
          `veličina — /penize/kontrola.`;

    return {
      case: "money",
      labelCs,
      batchesCompleted,
      unitsProcessed: null,
      unitsTotal,
      progressPct: null,
      progressNoteCs,
      latestHeadline:
        (typeof lastBatch?.note === "string" ? truncate(lastBatch.note, 320) : null) ??
        latestBatchReportHeadline(MONEY_DIR),
      openFrontier: null,
      source,
    };
  } catch {
    return emptyProgress("money", labelCs, source);
  }
}

function loadEffortProgress(): LoopCaseProgress {
  const source = "docs/data-analysis/case-effort/ledger.json + ledger.md";
  try {
    const ledger = readJsonSafe<{ batch?: number; population?: number; units?: Array<{ stage?: string }> }>(
      `${VAULT}/case-effort/ledger.json`,
    );
    if (!ledger) return emptyProgress("effort", "Docházka (kontribuční index)", source);
    const unitsTotal = numOrNull(ledger.population);
    const unitsProcessed = Array.isArray(ledger.units)
      ? ledger.units.filter((u) => u.stage && u.stage !== "pending").length
      : null;
    const md = readTextSafe(`${VAULT}/case-effort/ledger.md`);
    const headline = md ? extractLatestSection(md) : null;
    return {
      case: "effort",
      labelCs: "Docházka (kontribuční index)",
      batchesCompleted: numOrNull(ledger.batch),
      unitsProcessed,
      unitsTotal,
      progressPct: pct(unitsProcessed, unitsTotal),
      progressNoteCs:
        unitsProcessed == null
          ? "postup nehodnocen — žurnál nenese per-unit sloupec units[].stage"
          : "měřeno per-unit sloupcem units[].stage v ledger.json (posunuté ≠ „pending“)",
      latestHeadline: headline,
      openFrontier: null,
      source,
    };
  } catch {
    return emptyProgress("effort", "Docházka (kontribuční index)", source);
  }
}

/** Jeden blok `totals.batchNNNVerdicts` po projekci. `billsWithVerdictTotal` je
 *  KUMULATIVNÍ pokrytí korpusu k té dávce — ne přírůstek; sčítat přírůstky
 *  (49 + 8 + 0 + 114) dá 171 ze 141 bilů, tedy nesmysl přes 100 %. */
interface LawVerdictBlock {
  batch: number;
  cumulative: number | null;
  note: string | null;
}

function readLawVerdictBlocks(totals: Record<string, unknown>): LawVerdictBlock[] {
  return Object.keys(totals)
    .map((k) => ({ key: k, m: k.match(/^batch(\d+)Verdicts$/) }))
    .filter((e): e is { key: string; m: RegExpMatchArray } => e.m != null)
    .map(({ key, m }) => {
      const block = totals[key];
      const rec = (block && typeof block === "object" ? block : {}) as Record<string, unknown>;
      return {
        batch: Number(m[1]),
        cumulative: numOrNull(rec.billsWithVerdictTotal),
        note: typeof rec.note === "string" ? truncate(rec.note, 320) : null,
      };
    })
    .sort((a, b) => b.batch - a.batch);
}

function loadLawProgress(): LoopCaseProgress {
  const source = "docs/data-analysis/case-law/ledger.json + batch-NNN.md";
  const labelCs = "Zákony (LawWatch)";
  try {
    const ledger = readJsonSafe<{ totals?: Record<string, unknown> } & Record<string, unknown>>(`${LAW_DIR}/ledger.json`);
    const batchesCompleted = countBatchReports(LAW_DIR);
    if (!ledger?.totals) {
      return {
        ...emptyProgress("law", labelCs, source),
        batchesCompleted,
        latestHeadline: latestBatchReportHeadline(LAW_DIR),
      };
    }
    const totals = ledger.totals;
    const unitsTotal = numOrNull(totals.bills);

    // POKRYTÍ SE ČTE Z NEJNOVĚJŠÍ DÁVKY (2026-08-12). Do teď se sčítalo
    // `existingForensic + batch003 + batch004` a lišta stála na 57 ze 141,
    // zatímco žurnál nese dávky 011–021, každou „APPLIED to live graph“, a
    // poslední z nich hlásí korpus uzavřený (141/141, pass 55). Sčítat je
    // nelze — `billsWithVerdictTotal` je kumulativní pokrytí, ne přírůstek —
    // takže se bere nejnovější dávka, která ho nese, a bloky BEZ něj se
    // POČÍTAJÍ a přiznají, místo aby se dopočítávaly odhadem.
    const blocks = readLawVerdictBlocks(totals);
    const newestWithCoverage = blocks.find((b) => b.cumulative != null) ?? null;
    const skippedBlocks = blocks.filter((b) => b.cumulative == null).length;

    // Záložní (starý) součet — jen když žádný blok kumulativní pokrytí nenese.
    const legacySum =
      (numOrNull(totals.existingForensic) ?? 0) +
      (numOrNull(totals.batch003NewVerdicts) ?? 0) +
      (numOrNull(totals.batch004NewVerdicts) ?? 0);
    const unitsProcessed = newestWithCoverage?.cumulative ?? (blocks.length === 0 ? legacySum : null);

    const measuredNote =
      newestWithCoverage != null
        ? `pokrytí = totals.batch${String(newestWithCoverage.batch).padStart(3, "0")}Verdicts.billsWithVerdictTotal ` +
          `(kumulativní, nesčítá se přes dávky)`
        : blocks.length === 0
          ? "pokrytí = existingForensic + batch003 + batch004 (starší tvar žurnálu — bloky batchNNNVerdicts chybí)"
          : "postup nehodnocen — žádná dávka nenese billsWithVerdictTotal";
    const skippedNote =
      skippedBlocks > 0 ? ` · ${czechInt(skippedBlocks)} blok(ů) dávek bez čitelného pokrytí přeskočeno` : "";

    // headline: nejnovější poznámka o dávce. Kořenové `batchNNNNote` klíče
    // (zero-padded — hledat je nutné PŮVODNÍM řetězcem, „batch4Note“ nesedí na
    // nic) zamrzly na 004, takže prvenství má poznámka nejnovějšího
    // verdiktového bloku a zpráva batch-NNN.md je poslední záchrana.
    const rootNoteEntries = Object.keys(ledger)
      .map((k) => ({ key: k, m: k.match(/^batch(\d+)Note$/) }))
      .filter((e): e is { key: string; m: RegExpMatchArray } => e.m != null)
      .sort((a, b) => Number(b.m[1]) - Number(a.m[1]));
    const headline =
      blocks[0]?.note ??
      (rootNoteEntries.length ? truncate(String(ledger[rootNoteEntries[0].key]), 320) : null) ??
      latestBatchReportHeadline(LAW_DIR);

    return {
      case: "law",
      labelCs,
      batchesCompleted,
      unitsProcessed,
      unitsTotal,
      progressPct: pct(unitsProcessed, unitsTotal),
      progressNoteCs: `${measuredNote}${skippedNote}`,
      latestHeadline: headline,
      openFrontier: null,
      source,
    };
  } catch {
    return emptyProgress("law", labelCs, source);
  }
}

/** Exported for the loop mission-control loader (loops/getLoopState.ts) — the
 *  three bespoke ledger parsers stay the single source of case progress. */
export function loadLoopProgress(): LoopCaseProgress[] {
  const openFrontier = loadFrontierOpenCounts();
  return [loadMoneyProgress(), loadEffortProgress(), loadLawProgress()].map((p) => ({
    ...p,
    openFrontier: openFrontier[p.case] ?? p.openFrontier,
  }));
}

// ── money-lead payloads (Q-money-5/6 class: web leads, gated, not yet an edge) ─

function loadMoneyLeads(): MoneyLeadSummary[] {
  try {
    const dir = join(ROOT, `${VAULT}/case-money/payloads`);
    if (!existsSync(dir)) return [];
    const files = readdirSync(dir).filter((f) => /^batch-\d+-lead-.+\.json$/.test(f));
    const leads: MoneyLeadSummary[] = [];
    for (const f of files) {
      const raw = readJsonSafe<Record<string, unknown>>(`${VAULT}/case-money/payloads/${f}`);
      if (!raw) continue;
      const subject = (raw.subject ?? {}) as Record<string, unknown>;
      const annotation = (raw.proposedAnnotation ?? {}) as Record<string, unknown>;
      leads.push({
        leadId: typeof raw.leadId === "string" ? raw.leadId : f,
        subjectName: typeof subject.name === "string" ? subject.name : "?",
        targetNode: typeof annotation.targetNode === "string" ? annotation.targetNode : null,
        confidence: typeof raw.confidence === "string" ? raw.confidence : null,
        signalScore: numOrNull(raw.signalScore),
        note: typeof annotation.note === "string" ? truncate(annotation.note, 280) : null,
      });
    }
    return leads.sort((a, b) => a.leadId.localeCompare(b.leadId));
  } catch (err) {
    reportLoaderFailure("getAdminData.loadMoneyLeads", err);
    return [];
  }
}

// ── live graph: review pipeline + totals ───────────────────────────────────

function asStr(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

async function loadReviewHub(): Promise<ReviewHubData> {
  const leads = loadMoneyLeads();
  const empty: ReviewHubData = { ties: null, forensic: null, leads, audit: null };
  try {
    const store = await getStore();
    if (!store) return empty;

    // ties: every linked_to edge, by review_state + review_tier (reuses the
    // exact classifyTie/reviewTier helpers the /penize/kontrola console uses,
    // so the tier split here matches the review queue's own order).
    let ties: TieReviewSummary | null = null;
    try {
      const companies = await store.listKgNodes({ kind: "company", limit: KG_READ_CAP });
      const linked = await store.listKgEdges({ rel: "linked_to", limit: KG_READ_CAP });
      if (linked.length > 0) {
        const companyById = new Map(companies.map((c) => [c.id, c]));
        let verified = 0;
        let pending = 0;
        let rejected = 0;
        const tiers: [number, number, number, number] = [0, 0, 0, 0];
        let unresolvedTotal = 0;
        for (const e of linked) {
          // Mirror the real review console's contract (getVerificationData.ts):
          // an unresolved company is dropped, never guessed at. This dashboard
          // exists to mirror /penize/kontrola's queue — fabricating a "steward"
          // classification for an edge the console itself would drop let this
          // page's totals silently diverge from the queue it's meant to monitor.
          const comp = companyById.get(e.dst);
          if (!comp) {
            unresolvedTotal++;
            continue;
          }

          const rawState = (e.props?.review_state ?? e.props?.state) as string | undefined;
          if (rawState === "verified") verified++;
          else if (rawState === "rejected") rejected++;
          else pending++;

          const role = String(e.props?.role ?? "");
          // Stored class wins over the heuristic, as on /penize (resolveTieClass) — an
          // admin tier split computed from a guess would disagree with the console it
          // is meant to describe.
          const tieClass = resolveTieClass(e.props?.tie_class, role, comp.label).tieClass;
          const corroboration = (e.props?.corroboration as "registry-confirmed" | "registry-unconfirmed" | "conflicting" | null | undefined) ?? null;
          tiers[reviewTier({ tieClass, corroboration })]++;
        }
        if (unresolvedTotal > 0) {
          console.warn(`[getAdminData] dropped ${unresolvedTotal} linked_to edge(s) with unresolved company from tie totals`);
        }
        ties = {
          total: linked.length - unresolvedTotal,
          verified,
          pending,
          rejected,
          tiers: { tier0: tiers[0], tier1: tiers[1], tier2: tiers[2], tier3: tiers[3] },
          kontrolaHref: "/penize/kontrola",
        };
      }
    } catch {
      ties = null;
    }

    // forensic: bill nodes carrying a gated forensic_* verdict.
    let forensic: ForensicReviewSummary | null = null;
    try {
      const bills = await store.listKgNodes({ kind: "bill", limit: KG_READ_CAP });
      const items: ForensicVerdictSummary[] = [];
      const bySeverity: Record<string, number> = {};
      for (const n of bills) {
        const p = (n.props ?? {}) as Record<string, unknown>;
        const state = asStr(p.forensic_review_state);
        const severity = asStr(p.forensic_severity);
        if (!state && !severity) continue;
        const sev = severity ?? "low";
        bySeverity[sev] = (bySeverity[sev] ?? 0) + 1;
        items.push({
          tiskId: Number(n.id.replace(/^bill:tisk:/, "")) || 0,
          cislo: typeof p.cislo === "number" ? p.cislo : null,
          title: n.label,
          severity: sev,
          reviewState: state ?? "pending_review",
        });
      }
      if (items.length > 0) {
        // A binary high/non-high partition only guaranteed "high" floats up —
        // "medium" and "low" kept their original iteration order relative to
        // each other, so a medium-severity item could sit behind several lows
        // in the capped 8-item preview an operator actually sees.
        const SEVERITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };
        items.sort((a, b) => (SEVERITY_RANK[a.severity] ?? 3) - (SEVERITY_RANK[b.severity] ?? 3));
        forensic = { total: items.length, bySeverity, items, zakonyHref: "/zakony" };
      }
    } catch {
      forensic = null;
    }

    // review_audit: decisions actually made through the human gate.
    let audit: ReviewAuditSummary | null = null;
    try {
      const rows = await store.listReviewAudit({ limit: 10_000 });
      if (rows.length > 0) {
        const byDecision: Record<string, number> = {};
        const byReviewer: Record<string, number> = {};
        for (const r of rows) {
          byDecision[r.decision] = (byDecision[r.decision] ?? 0) + 1;
          byReviewer[r.reviewer] = (byReviewer[r.reviewer] ?? 0) + 1;
        }
        audit = {
          totalDecisions: rows.length,
          byDecision,
          byReviewer,
          lastDecidedAt: rows[0]?.decidedAt ?? null,
        };
      }
    } catch {
      audit = null;
    }

    return { ties, forensic, leads, audit };
  } catch {
    return empty;
  }
}

// ── live graph: system totals ──────────────────────────────────────────────

async function loadSystemState(vaultHeads: VaultHeads, loopsStatus: LoopsStatusFact): Promise<SystemState> {
  const base: SystemState = {
    graph: null,
    lastPass: vaultHeads.lastPass,
    loopsRunState: loopsStatus.state,
    loopsStatusLabel: loopsStatus.labelCs,
    loopsStatusSource: LOOPS_STATUS_SOURCE,
  };
  try {
    const store = await getStore();
    if (!store) return base;
    const [nodes, edges, edgesByRel] = await Promise.all([
      store.countKgNodes(),
      store.countKgEdges(),
      store.countKgEdgesByRel(),
    ]);
    let nodesByKind: Record<string, number> = {};
    try {
      // Sčítá DB, ne JS: `listKgNodes({limit: KG_READ_CAP})` sem materializoval
      // ~154 tisíc řádků kvůli sloupci `kind`. `kgKindCounts()` je jedno indexované
      // group-by, které odpoví na totéž (lib/db/readiness.ts to takto předepisuje
      // a /data už tak čte).
      const counts = await store.kgKindCounts();
      const byKind: Record<string, number> = {};
      for (const c of counts) byKind[c.kind] = c.count;
      nodesByKind = byKind;
    } catch {
      nodesByKind = {};
    }
    const graph: GraphTotals = { nodes, edges, edgesByRel, nodesByKind };
    return { ...base, graph };
  } catch {
    return base;
  }
}

// ── entry point ──────────────────────────────────────────────────────────

export async function getAdminData(): Promise<AdminData> {
  const loopProgress = loadLoopProgress();
  const vaultHeads = loadVaultHeads();
  const loopsStatus = loadLoopsStatus();
  // Hlídky grafu sdílejí "degrade to partial, never crash": vlastní loader
  // vrací null (a hlásí přes reportLoaderFailure), zbytek stránky žije dál.
  const [reviewHub, systemState, tripwires] = await Promise.all([
    loadReviewHub(),
    loadSystemState(vaultHeads, loopsStatus),
    getTripwireData(),
  ]);
  return { loopProgress, vaultHeads, reviewHub, tripwires, systemState };
}
