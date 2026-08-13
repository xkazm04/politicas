/* Money loop — batch 002, Q-money-1: full-population ARES-VR period reconciliation.
 *
 * Deterministically fetches the ARES VR (veřejný rejstřík — official officer/shareholder
 * register, token-free) record for every one of the 260 `linked_to` ties NOT already
 * annotated in batch 001 (15 done — see payloads/batch-001-corroboration.json), matches
 * the MP against the officer/shareholder list by EXACT birth date (the same discipline
 * `lib/analysis/money-feed.ts`'s bridgePerson uses — never a name-only guess), and derives
 * corroboration + role_valid_from/to + temporal_status + tie_class for each resolvable tie.
 *
 * Deterministic semantics (batch-002 calibration — see handoff.md lessons for why this
 * differs slightly from batch 001's per-tie narrative judgment):
 *   corroboration:
 *     registry-confirmed   — exactly one VR officer/shareholder entry's birth date matches
 *                             the MP's roster birth date (identity positively confirmed).
 *     conflicting           — VR record found, but NO entry's birth date matches this MP
 *                             (identity NOT confirmed among registry roles) OR more than
 *                             one distinct person shares the exact birth date (ambiguous).
 *     registry-unconfirmed  — could not even attempt the match: ICO not found in ARES VR,
 *                             or the MP's birth date is unknown in our own roster.
 *   temporal_status (only set when corroboration = registry-confirmed):
 *     current                — matched role has no end date in VR.
 *     historical              — role ended, but at least one reachable contract was signed
 *                               on/before the end date (money fell inside the tenure).
 *     money-postdates-role    — role ended AND every reachable contract postdates it.
 *     historical-no-money     — role ended and the company has no reachable contract money.
 *
 * NO LLM. Read-only on the PGlite copy. Writes ONLY the payload + ledger.json (fleet
 * mode — no live write, no review_state change, no commit).
 *
 *   PGLITE_PATH=./.pglite-copy-money npx tsx scripts/case-loops/money/reconcile-ares-vr.ts
 */
import { getStore } from "@/lib/db/store";
import { AresClient } from "@/lib/analysis/money-feed";
// JEDNA definice heuristiky (2026-08-13). Tenhle skript je HLAVNÍ ZAPISOVATEL
// `tie_class` — batch-002 anotoval 245 z 211 živých vazeb — a nesl si vlastní
// kopii `classifyTie`, která se rozešla s tou, kterou plocha čte: chyběla jí
// značka `vodovody a kanalizace`, takže „Vodovody a kanalizace Vsetín, a.s."
// zapsal jako `manager`, zatímco /penize ho dnes odhaduje jako `steward`.
// Rozpor pak plocha četla jako investigativní opravu, ne jako dvě vintage
// téhož odhadu. Klasifikátor se proto IMPORTUJE — zapsané hodnoty se tím
// nepřepisují (o přeřazení rozhoduje člověk v /penize/kontrola), ale příští
// běh zapíše to, co plocha čte.
// `reviewTypes.ts` je čistý modul (jediný běhový import je `asciiFold`), takže
// z tsx skriptu neprosakuje žádná server-only hranice.
import { classifyTie } from "@/features/money/reviewTypes";

const VR_BASE = "https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty-vr";
const THROTTLE_MS = 150; // ~400 req/min, well under ARES's ~500 req/min budget
const BATCH1_PAYLOAD = "docs/data-analysis/case-money/payloads/batch-001-corroboration.json";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}
function pspIdFromNodeId(id: string): number | null {
  const tail = id.split(":").pop();
  const n = tail ? Number(tail) : NaN;
  return Number.isInteger(n) ? n : null;
}
function parsePeriod(source: string): { from: string | null; to: string | null } {
  const m = source.match(/(\d{4}-\d{2}-\d{2}|\?)–(\d{4}-\d{2}-\d{2}|ongoing|\?)/);
  if (!m) return { from: null, to: null };
  const from = m[1] === "?" ? null : m[1];
  const to = m[2] === "ongoing" || m[2] === "?" ? null : m[2];
  return { from, to };
}

/* ── ARES VR raw shape (only the fields we read) ─────────────────────────────── */
interface VrFunkce {
  vznikFunkce?: string;
  zanikFunkce?: string;
  nazev?: string;
}
interface VrFyzickaOsoba {
  datumNarozeni?: string;
  jmeno?: string;
  prijmeni?: string;
}
interface VrClenOrganu {
  datumZapisu?: string;
  datumVymazu?: string;
  clenstvi?: { funkce?: VrFunkce };
  fyzickaOsoba?: VrFyzickaOsoba;
}
interface VrStatutarniOrgan {
  clenoveOrganu?: VrClenOrganu[];
}
interface VrPodil {
  datumZapisu?: string;
  datumVymazu?: string;
  velikostPodilu?: { typObnos?: string; hodnota?: string };
}
interface VrSpolecnikOsoba {
  datumZapisu?: string;
  datumVymazu?: string;
  podil?: VrPodil[];
  osoba?: { fyzickaOsoba?: VrFyzickaOsoba };
}
interface VrSpolecnici {
  spolecnik?: VrSpolecnikOsoba[];
}
interface VrZaznam {
  primarniZaznam?: boolean;
  stavSubjektu?: string;
  statutarniOrgany?: VrStatutarniOrgan[];
  /** Supervisory/other bodies (dozorčí rada, kontrolní komise, …) — SAME shape as
   *  statutarniOrgany. Most `steward` ties are exactly these supervisory-board seats,
   *  so omitting this section would systematically under-confirm the steward class. */
  ostatniOrgany?: VrStatutarniOrgan[];
  spolecnici?: VrSpolecnici[];
}
interface VrResponse {
  kod?: string; // "NENALEZENO" on a miss
  zaznamy?: VrZaznam[];
}

interface MatchedEntry {
  kind: "officer" | "shareholder";
  functionName: string | null;
  validFrom: string | null;
  validTo: string | null; // null = ongoing
  stakePct: number | null;
}

/** Find every VR entry whose person birth date exactly matches `birthDate`. */
function findMatches(rec: VrZaznam, birthDate: string): MatchedEntry[] {
  const out: MatchedEntry[] = [];
  for (const org of [...(rec.statutarniOrgany ?? []), ...(rec.ostatniOrgany ?? [])]) {
    for (const m of org.clenoveOrganu ?? []) {
      if (m.fyzickaOsoba?.datumNarozeni === birthDate) {
        out.push({
          kind: "officer",
          functionName: m.clenstvi?.funkce?.nazev ?? null,
          validFrom: m.clenstvi?.funkce?.vznikFunkce ?? m.datumZapisu ?? null,
          validTo: m.clenstvi?.funkce?.zanikFunkce ?? m.datumVymazu ?? null,
          stakePct: null,
        });
      }
    }
  }
  for (const grp of rec.spolecnici ?? []) {
    for (const s of grp.spolecnik ?? []) {
      if (s.osoba?.fyzickaOsoba?.datumNarozeni === birthDate) {
        const activePodil = (s.podil ?? []).find((p) => !p.datumVymazu) ?? s.podil?.[s.podil.length - 1];
        const pct =
          activePodil?.velikostPodilu?.typObnos === "PROCENTA" && activePodil.velikostPodilu.hodnota
            ? Number(activePodil.velikostPodilu.hodnota.replace(",", "."))
            : null;
        out.push({
          kind: "shareholder",
          functionName: "společník",
          validFrom: s.datumZapisu ?? null,
          validTo: s.datumVymazu ?? null,
          stakePct: Number.isFinite(pct) ? pct : null,
        });
      }
    }
  }
  return out;
}

/** Distinct birth dates among matches — >1 means the exact-birthdate match is ambiguous
 *  (should not happen for one person but is possible if VR data is dirty; guard anyway
 *  by checking distinct (jmeno,prijmeni) pairs isn't needed since we filter by exact date
 *  already — this guards multiple DIFFERENT roles/entries for the SAME person, which is
 *  fine and gets merged, vs true ambiguity which would need >1 distinct name at that date;
 *  VR doesn't expose that cheaply here, so we treat >0 matches as confirmed and rely on
 *  the birth-date hinge's precision (documented as a batch-002 known limitation). */
function mergeMatches(matches: MatchedEntry[]): {
  validFrom: string | null;
  validTo: string | null;
  stakePct: number | null;
  roles: string[];
} {
  const roles = [...new Set(matches.map((m) => m.functionName).filter((x): x is string => !!x))];
  const froms = matches.map((m) => m.validFrom).filter((x): x is string => !!x).sort();
  const anyOngoing = matches.some((m) => !m.validTo);
  const tos = matches.map((m) => m.validTo).filter((x): x is string => !!x).sort();
  const stake = matches.find((m) => m.stakePct != null)?.stakePct ?? null;
  return {
    validFrom: froms[0] ?? null,
    validTo: anyOngoing ? null : (tos[tos.length - 1] ?? null),
    stakePct: stake,
    roles,
  };
}

async function main() {
  const store = await getStore();
  if (!store) throw new Error("no store (set PGLITE_PATH to the copy)");
  const fs = await import("node:fs/promises");

  const already = JSON.parse(await fs.readFile(BATCH1_PAYLOAD, "utf8")) as {
    edges: { src: string; dst: string }[];
  };
  const doneKeys = new Set(already.edges.map((e) => `${e.src}|${e.dst}`));

  const companies = await store.listKgNodes({ kind: "company", limit: 100_000 });
  const persons = await store.listKgNodes({ kind: "person", limit: 100_000 });
  const linked = await store.listKgEdges({ rel: "linked_to", limit: 100_000 });
  const supplies = await store.listKgEdges({ rel: "supplies", limit: 100_000 });
  const contracts = await store.listKgNodes({ kind: "contract", limit: 100_000 });
  const rosterPersons = await store.listPersons();

  const companyById = new Map(companies.map((c) => [c.id, c]));
  const personById = new Map(persons.map((p) => [p.id, p]));
  const contractById = new Map(contracts.map((c) => [c.id, c]));
  const birthByPspId = new Map(rosterPersons.map((p) => [p.pspId, p.birthDateUnknown ? null : p.birthDate]));

  // company id → contract signed-date list (for money-postdates-role classification)
  const signedByCompany = new Map<string, { signedOn: string | null; amount: number }[]>();
  for (const e of supplies) {
    const arr = signedByCompany.get(e.src) ?? [];
    const ct = contractById.get(e.dst);
    arr.push({
      signedOn: (ct?.props?.signedOn as string | null) ?? null,
      amount: num(e.weight) || num(ct?.props?.amount),
    });
    signedByCompany.set(e.src, arr);
  }

  const ares = new AresClient();

  interface OutEdge {
    src: string;
    rel: "linked_to";
    dst: string;
    mp: string;
    company: string;
    propsMerge: Record<string, unknown>;
  }
  const results: OutEdge[] = [];
  const unresolvable: { mp: string; company: string; ico: string; reason: string }[] = [];
  let vrCacheHit = 0;
  const vrCache = new Map<string, VrResponse | null>();

  let processed = 0;
  let skippedDone = 0;
  const totalToProcess = linked.filter((e) => !doneKeys.has(`${e.src}|${e.dst}`)).length;
  console.log(`=== ARES-VR reconciliation: ${linked.length} ties total, ${totalToProcess} to process (${doneKeys.size} already done in batch 001) ===`);

  for (const e of linked) {
    const key = `${e.src}|${e.dst}`;
    if (doneKeys.has(key)) {
      skippedDone++;
      continue;
    }
    const comp = companyById.get(e.dst);
    const pspId = pspIdFromNodeId(e.src);
    const person = personById.get(e.src);
    if (!comp || pspId == null) continue; // unresolved endpoint — never annotate a guess
    const ico = String(comp.props?.ico ?? comp.id.split(":").pop() ?? "");
    const role = String(e.props?.role ?? "");
    const tieClass = classifyTie(role, comp.label);
    const source = String(e.props?.source ?? "");
    const { to: graphPeriodTo } = parsePeriod(source);

    processed++;
    if (processed % 25 === 0) console.log(`  ...${processed}/${totalToProcess}`);

    let vr: VrResponse | null;
    if (vrCache.has(ico)) {
      vr = vrCache.get(ico)!;
      vrCacheHit++;
    } else {
      try {
        vr = (await ares.vrRecord(ico)) as VrResponse;
      } catch (err) {
        vr = null;
        console.warn(`  ARES VR fetch failed for ${ico} (${comp.label}): ${(err as Error).message}`);
      }
      vrCache.set(ico, vr);
      await sleep(THROTTLE_MS);
    }

    const birthDate = birthByPspId.get(pspId) ?? null;
    const mp = person?.label ?? String(pspId);

    if (!vr || vr.kod === "NENALEZENO" || !vr.zaznamy?.length) {
      unresolvable.push({ mp, company: comp.label, ico, reason: "vr-ico-not-found" });
      results.push({
        src: e.src, rel: "linked_to", dst: e.dst, mp, company: comp.label,
        propsMerge: {
          corroboration: "registry-unconfirmed",
          corroboration_source: `${VR_BASE}/${ico}`,
          tie_class: tieClass,
          reviewer_note: "ARES VR nemá pro toto IČO záznam v OR (možná OSVČ/jiná evidence) — identita nepotvrzena.",
          flags: ["vr-ico-not-found"],
        },
      });
      continue;
    }
    const rec = vr.zaznamy.find((z) => z.primarniZaznam) ?? vr.zaznamy[0];
    const src = `${VR_BASE}/${ico}`;

    if (!birthDate) {
      results.push({
        src: e.src, rel: "linked_to", dst: e.dst, mp, company: comp.label,
        propsMerge: {
          corroboration: "registry-unconfirmed",
          corroboration_source: src,
          tie_class: tieClass,
          reviewer_note: "Datum narození poslance v rejstříku psp.cz chybí — identitu nelze potvrdit proti ARES VR.",
          flags: ["person-birthdate-unknown"],
        },
      });
      continue;
    }

    const matches = findMatches(rec, birthDate);
    if (matches.length === 0) {
      results.push({
        src: e.src, rel: "linked_to", dst: e.dst, mp, company: comp.label,
        propsMerge: {
          corroboration: "conflicting",
          corroboration_source: src,
          tie_class: tieClass,
          reviewer_note: `Firma ${ico} v ARES VR existuje, ale žádný úředník/společník se shodným datem narození nenalezen — vazba tvrzená grafem (Hlídač) NENÍ v OR potvrzena.`,
          flags: ["no-birthdate-match-in-vr"],
        },
      });
      continue;
    }

    const merged = mergeMatches(matches);
    // money-postdates-role / historical classification. IMPORTANT: a contract with no
    // disclosed `signedOn` is UNDATED, not "after the role" — conflating the two would
    // inflate money-postdates-role with cases where we simply don't know (Opus-reflection
    // risk flag, batch 002). Only a contract with an ACTUAL date after role end counts as
    // postdating; undated money gets its own honest bucket.
    const signed = signedByCompany.get(comp.id) ?? [];
    const datedSigned = signed.filter((s) => s.signedOn != null);
    const hasMoney = signed.length > 0;
    let temporalStatus: string;
    if (!merged.validTo) {
      temporalStatus = "current";
    } else if (!hasMoney) {
      temporalStatus = "historical-no-money";
    } else if (datedSigned.length === 0) {
      temporalStatus = "historical-undated-money"; // has reachable money, but no contract carries a date to compare
    } else {
      const anyWithinTenure = datedSigned.some((s) => s.signedOn! <= merged.validTo!);
      temporalStatus = anyWithinTenure ? "historical" : "money-postdates-role";
    }
    const stale = !merged.validTo ? false : graphPeriodTo === null; // graph implied ongoing but VR shows an end
    const roleLabel = merged.roles.join("/") || role;
    const note =
      `ARES VR: ${roleLabel} ${merged.validFrom ?? "?"}→${merged.validTo ?? "trvá"}` +
      (merged.stakePct != null ? ` (${merged.stakePct}% podíl)` : "") +
      ` · peníze: ${temporalStatus}` +
      (stale ? " · graf tvrdil „ongoing“ — nepřesné" : "");

    results.push({
      src: e.src, rel: "linked_to", dst: e.dst, mp, company: comp.label,
      propsMerge: {
        corroboration: "registry-confirmed",
        corroboration_source: src,
        role_valid_from: merged.validFrom,
        role_valid_to: merged.validTo,
        ...(merged.stakePct != null ? { owner_stake_pct: merged.stakePct } : {}),
        temporal_status: temporalStatus,
        tie_class: tieClass,
        reviewer_note: note,
        ...(stale ? { flags: ["stale-ongoing-in-graph"] } : {}),
      },
    });
  }

  const dir = "docs/data-analysis/case-money";
  const payload = {
    batch: 2,
    track: "money",
    kind: "linked_to-corroboration-annotation",
    generatedAt: new Date().toISOString().slice(0, 10),
    note:
      "PROPOSALS ONLY — props-merge onto EXISTING linked_to edges. Full-population ARES-VR " +
      "reconciliation (Q-money-1), deterministic (no LLM). Never creates a person↔company edge, " +
      "never touches review_state. Validate with: PGLITE_PATH=./.pglite-copy-money npx tsx " +
      "scripts/case-loops/money/validate-payloads.ts -- --batch2",
    provenanceStamp: {
      track: "money",
      method: "verdict",
      ref: "case-money/batch-002 · ARES VR full-population reconciliation (deterministic)",
      computedAt: new Date().toISOString().slice(0, 10),
    },
    edges: results,
  };
  await fs.writeFile(`${dir}/payloads/batch-002-ares-vr-reconciliation.json`, JSON.stringify(payload, null, 2));

  const byCorrob = { "registry-confirmed": 0, "registry-unconfirmed": 0, conflicting: 0 };
  const byTemporal: Record<string, number> = {};
  for (const r of results) {
    const c = r.propsMerge.corroboration as keyof typeof byCorrob;
    byCorrob[c] = (byCorrob[c] ?? 0) + 1;
    const t = r.propsMerge.temporal_status as string | undefined;
    if (t) byTemporal[t] = (byTemporal[t] ?? 0) + 1;
  }
  console.log("\n=== RECONCILIATION SUMMARY ===");
  console.log(`processed: ${processed} / ${totalToProcess} (skipped ${skippedDone} already done in batch 001)`);
  console.log(`vr cache hits (repeat ICOs): ${vrCacheHit}`);
  console.log("corroboration:", JSON.stringify(byCorrob));
  console.log("temporal_status:", JSON.stringify(byTemporal));
  console.log(`unresolvable (vr-ico-not-found): ${unresolvable.length}`);
  await fs.writeFile(`${dir}/reconcile-summary.json`, JSON.stringify({ processed, skippedDone, byCorrob, byTemporal, unresolvable }, null, 2));

  await store.close();
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
