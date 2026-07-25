/* Money loop — batch 006, Job A: close the open ARES-VR corroborations using dataor's
 * bulk ISVR export instead of ARES's live REST snapshot.
 *
 * SCOPE CORRECTION (logged, not silently absorbed): the batch-006 brief's "81 open
 * corroborations" figure is the pre-purge count (23 conflicting + 58 registry-unconfirmed,
 * ledger.json batch2). Batch 004's OSVČ purge removed 49 of those 58 (the false
 * ico:04627695 edges) — the LIVE open population today is 211-tie-population's tier-3:
 * 23 conflicting + 9 registry-unconfirmed = 32. This script processes the real, current
 * open population (32), not the stale 81; see handoff.md for the reconciliation.
 *
 * Method per open tie:
 *   1. ARES subject(ico) — cheap, gives pravniForma + sidlo.kodKraje + (if the entity is
 *      ISVR-registered) a "vr" dalsiUdaje sub-record carrying spisovaZnacka.
 *   2. If ARES subject has NO "vr" sub-record at all: the entity is provably outside ISVR
 *      (dataor draws from the exact same registry ARES VR does) — dataor cannot help.
 *      Recorded as a structural negative with the ARES pravniForma code as evidence, not
 *      silently skipped.
 *   3. Otherwise resolveCourtAndForm() derives court+legalForm slug; fetch the FULL export
 *      for the most recent published year (2026) for that court×form — FULL carries
 *      complete officer history within the record (not just currently-active roles), which
 *      is exactly the gap a "conflicting" VR read (record found, no birth-date match) can
 *      hide: a resigned officer ARES's live JSON summarized thin.
 *   4. Exact-birthdate match against the roster (same discipline as reconcile-ares-vr.ts —
 *      NEVER a name-only guess). A hit upgrades corroboration to registry-confirmed with
 *      dataor as the cited source; a miss is recorded as a checked, honest negative
 *      (P36-aware: dataor's pre-2000s entries are frequently null-birthdate too — that is
 *      reported, not silently treated the same as "no match at all").
 *
 * NO LLM. Read-only on the PGlite copy. Fleet mode: no live write, no review_state change,
 * writes ONLY the payload file.
 *
 *   PGLITE_PATH=./.pglite-copy-money-b6 npx tsx scripts/case-loops/money/dataor-corroborate.ts
 */
import { getStore } from "@/lib/db/store";
import { AresClient } from "@/lib/analysis/money-feed";
import { datasetId, fetchAndFindRecord, resolveCourtAndForm, type AresSubjectForCourtForm } from "@/lib/ingest/sources/dataor";

const DATAOR_YEAR = 2026; // current-year FULL export — daily-updated, complete history within record

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
function pspIdFromNodeId(id: string): number | null {
  const tail = id.split(":").pop();
  const n = tail ? Number(tail) : NaN;
  return Number.isInteger(n) ? n : null;
}

interface OpenTie {
  src: string;
  dst: string;
  ico: string;
  company: string;
  mp: string;
  pspId: number;
  role: string;
  currentCorroboration: string;
}

async function main() {
  const store = await getStore();
  if (!store) throw new Error("no store (set PGLITE_PATH to the copy)");
  const fs = await import("node:fs/promises");

  const linked = await store.listKgEdges({ rel: "linked_to", limit: 100_000 });
  const companies = await store.listKgNodes({ kind: "company", limit: 100_000 });
  const persons = await store.listKgNodes({ kind: "person", limit: 100_000 });
  const rosterPersons = await store.listPersons();
  const companyById = new Map(companies.map((c) => [c.id, c]));
  const personById = new Map(persons.map((p) => [p.id, p]));
  const birthByPspId = new Map(rosterPersons.map((p) => [p.pspId, p.birthDateUnknown ? null : p.birthDate]));

  const openTies: OpenTie[] = [];
  for (const e of linked) {
    const corrob = String(e.props?.corroboration ?? "");
    if (corrob !== "conflicting" && corrob !== "registry-unconfirmed") continue;
    const comp = companyById.get(e.dst);
    const pspId = pspIdFromNodeId(e.src);
    const person = personById.get(e.src);
    if (!comp || pspId == null) continue;
    const ico = String(comp.props?.ico ?? comp.id.split(":").pop() ?? "");
    // PRaK (IČO 49683144) — BOTH edges pointing here (Bendl pspId 346 AND Brabec pspId
    // 6184) are handled explicitly by Job B's re-point payload. Exclude the whole IČO, not
    // just Bendl's edge — an earlier version of this script only excluded pspId 346 and
    // produced a competing "network-budget-exceeded" annotation on Brabec's same edge
    // while Job B was proposing to re-point it entirely (caught before finalizing batch 006).
    if (ico === "49683144") continue;
    openTies.push({
      src: e.src, dst: e.dst, ico, company: comp.label,
      mp: person?.label ?? String(pspId), pspId, role: String(e.props?.role ?? ""),
      currentCorroboration: corrob,
    });
  }
  console.log(`=== dataor corroboration: ${openTies.length} open ties to process (32 expected: 23 conflicting + 9 registry-unconfirmed, PRaK excluded — handled by Job B) ===`);

  const ares = new AresClient();
  const results: { src: string; rel: "linked_to"; dst: string; mp: string; company: string; propsMerge: Record<string, unknown> }[] = [];
  const datasetCache = new Map<string, boolean>(); // datasetId -> exists, avoid duplicate fetchAndFindRecord for same file when logging only
  let closed = 0, structuralNegative = 0, checkedNoMatch = 0, courtUnresolved = 0, datasetMissing = 0;

  for (const tie of openTies) {
    console.log(`\n--- ${tie.mp} ↔ ${tie.company} (IČO ${tie.ico}, currently ${tie.currentCorroboration}) ---`);
    type Subject = AresSubjectForCourtForm & { obchodniJmeno?: string; pravniForma?: string };
    let subject: Subject | null = null;
    try {
      subject = (await ares.subject(tie.ico)) as Subject;
    } catch (err) {
      console.log(`  ARES subject fetch failed: ${(err as Error).message}`);
    }
    await sleep(120);

    const hasVrSubrecord = subject?.dalsiUdaje?.some((d) => d.datovyZdroj === "vr") ?? false;
    if (!subject || !hasVrSubrecord) {
      structuralNegative++;
      console.log(`  STRUCTURAL NEGATIVE: not ISVR-registered (pravniForma=${subject?.pravniForma ?? "?"}, no VR sub-record) — dataor draws from the same registry, cannot help.`);
      results.push({
        src: tie.src, rel: "linked_to", dst: tie.dst, mp: tie.mp, company: tie.company,
        propsMerge: {
          flags: ["dataor-checked-not-isvr-registered"],
          dataor_check: {
            checked: true, result: "not-isvr-registered",
            pravniForma: subject?.pravniForma ?? null,
            note: "ARES subjekt nemá zdroj 'vr' (veřejný rejstřík) — subjekt zvláštního zákona (např. veřejná instituce), NENÍ v ISVR (Informační systém veřejných rejstříků), stejný zdroj jako ARES VR i dataor.justice.cz bulk export. dataor tedy nemůže tuto vazbu ověřit ani vyvrátit — jde o strukturální mez, ne o chybějící data.",
            checkedAt: new Date().toISOString().slice(0, 10),
          },
        },
      });
      continue;
    }

    const guess = resolveCourtAndForm(subject);
    if (!guess.courtSlug || !guess.legalFormSlug) {
      courtUnresolved++;
      console.log(`  COURT/FORM UNRESOLVED (source=${guess.source}) — needs a manual aggregator lead like PRaK's, not attempted this batch.`);
      results.push({
        src: tie.src, rel: "linked_to", dst: tie.dst, mp: tie.mp, company: tie.company,
        propsMerge: {
          flags: ["dataor-court-form-unresolved"],
          dataor_check: { checked: true, result: "court-form-unresolved", resolverSource: guess.source, checkedAt: new Date().toISOString().slice(0, 10) },
        },
      });
      continue;
    }

    const id = datasetId(guess.legalFormSlug, "full", guess.courtSlug, DATAOR_YEAR);
    console.log(`  dataset: ${id} (resolved via ${guess.source})`);
    const fsSync = await import("node:fs");
    const isCached = fsSync.existsSync(`.dataor-cache/${id}.csv`);
    let lookup;
    try {
      // A dataset already on disk returns instantly — only bound the wait for a NOT-yet-
      // cached file (some court×form combos are 200MB+ gz over a connection this batch
      // measured at well under 1MB/s in places; a single such file must never stall the
      // whole 31-tie sweep). Uncached fetches get a 25s budget per attempt; a miss here is
      // logged honestly as a network-budget gap, never silently dropped.
      lookup = isCached
        ? await fetchAndFindRecord(id, tie.ico)
        : await Promise.race([
            fetchAndFindRecord(id, tie.ico),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error("batch network-budget exceeded (25s, uncached large file)")), 25_000)),
          ]);
    } catch (err) {
      console.log(`  dataor fetch failed: ${(err as Error).message}`);
      results.push({
        src: tie.src, rel: "linked_to", dst: tie.dst, mp: tie.mp, company: tie.company,
        propsMerge: {
          flags: ["dataor-fetch-incomplete"],
          dataor_check: { checked: true, result: "fetch-incomplete", datasetId: id, error: (err as Error).message, note: "Nedokončeno v rámci síťového rozpočtu této dávky — soubor je velký (desítky až stovky MB) a spojení bylo v této dávce pomalé. Nejde o strukturální zápor, jen o nedokončenou kontrolu.", checkedAt: new Date().toISOString().slice(0, 10) },
        },
      });
      continue;
    }
    datasetCache.set(id, lookup.datasetExists);

    if (!lookup.datasetExists) {
      datasetMissing++;
      console.log(`  dataset does not exist for ${guess.courtSlug}/${guess.legalFormSlug}/${DATAOR_YEAR} — form/court guess likely wrong.`);
      results.push({
        src: tie.src, rel: "linked_to", dst: tie.dst, mp: tie.mp, company: tie.company,
        propsMerge: { flags: ["dataor-dataset-not-found"], dataor_check: { checked: true, result: "dataset-not-found", datasetId: id, checkedAt: new Date().toISOString().slice(0, 10) } },
      });
      continue;
    }
    if (!lookup.record) {
      console.log(`  IČO not present in ${id} (current-year FULL export) — entity may have dissolved before this year or the court guess is wrong.`);
      results.push({
        src: tie.src, rel: "linked_to", dst: tie.dst, mp: tie.mp, company: tie.company,
        propsMerge: { flags: ["dataor-ico-not-in-dataset"], dataor_check: { checked: true, result: "ico-not-in-dataset", datasetId: id, checkedAt: new Date().toISOString().slice(0, 10) } },
      });
      continue;
    }

    const birthDate = birthByPspId.get(tie.pspId) ?? null;
    const matches = birthDate ? lookup.officers.filter((o) => o.birthDate === birthDate) : [];
    const officersWithoutBirthdate = lookup.officers.filter((o) => o.kind === "officer" && !o.birthDate).length;
    const src = `https://dataor.justice.cz/api/file/${id}.csv.gz`;

    if (matches.length > 0) {
      closed++;
      // Merge ALL birth-date-matched entries, not just the first — a batch-006 Opus
      // verification pass caught a real understatement here: Černochová/Komwag actually
      // holds FOUR consecutive terms in the record (2007–2021), and reporting only the
      // last would understate a 14-year tie as 2.5 years. Sort chronologically for the
      // per-term note; the edge's own valid_from/to spans the full confirmed history.
      const sorted = [...matches].sort((a, b) => (a.validFrom ?? "").localeCompare(b.validFrom ?? ""));
      const roleValidFrom = sorted.map((m) => m.validFrom).filter((x): x is string => !!x).sort()[0] ?? null;
      const validTos = sorted.map((m) => m.validTo).filter((x): x is string => !!x).sort();
      const anyOngoing = sorted.some((m) => !m.validTo);
      const roleValidTo = anyOngoing ? null : (validTos[validTos.length - 1] ?? null);
      const primary = sorted[sorted.length - 1]; // most recent term for the headline role label
      const roleLabel = primary.role === primary.organNazev || !primary.organNazev
        ? (primary.role ?? tie.role)
        : `${primary.role} (${primary.organNazev})`; // bare "člen" gets its organ qualifier back — Opus fix
      const termsNote = sorted.length > 1
        ? ` Historie funkcí v záznamu (${sorted.length} období): ` + sorted.map((m) => `${m.role ?? "?"} ${m.validFrom ?? "?"}→${m.validTo ?? "trvá"}`).join("; ") + "."
        : "";
      console.log(`  MATCH: ${roleLabel} ${roleValidFrom ?? "?"}→${roleValidTo ?? "trvá"} (birth date ${birthDate} confirmed against dataor officer record, ${sorted.length} matching term(s)).`);
      results.push({
        src: tie.src, rel: "linked_to", dst: tie.dst, mp: tie.mp, company: tie.company,
        propsMerge: {
          corroboration: "registry-confirmed",
          corroboration_source: src,
          role_valid_from: roleValidFrom,
          role_valid_to: roleValidTo,
          // Honest about what's KNOWN, not a claim about why the earlier ARES-VR reconcile
          // (batch 002) marked this "conflicting" — an Opus verification pass found ARES
          // VR's own live endpoint DOES carry this exact membership, so the original v1
          // draft's "ARES VR did not see this" claim was false; the actual cause of the
          // batch-002 mismatch was not re-diagnosed this batch (flagged as an open item).
          reviewer_note: `dataor.justice.cz (bulk ISVR export, ${id}): ${roleLabel} ${roleValidFrom ?? "?"}→${roleValidTo ?? "trvá"} — datum narození poslance (${birthDate}) potvrzeno proti záznamu úředníka v ${lookup.spisovaZnacka ?? "OR"}.${termsNote} (Pozn.: příčina, proč tuto shodu nezachytila dřívější ARES-VR rekonciliace, nebyla v této dávce zjištěna — ARES VR live endpoint tuto shodu při zpětné kontrole obsahuje.)`,
          flags: ["dataor-closed"],
          dataor_check: { checked: true, result: "match", datasetId: id, matchingTerms: sorted.length, checkedAt: new Date().toISOString().slice(0, 10) },
        },
      });
      continue;
    }

    checkedNoMatch++;
    const reason = !birthDate
      ? "person-birthdate-unknown"
      : officersWithoutBirthdate > 0
        ? "dataor-no-match-some-officers-birthdate-null" // honest P36 flag — a null-birthdate officer entry could still be this MP, unconfirmable either way
        : "dataor-no-match";
    console.log(`  NO MATCH (${lookup.officers.length} officer/shareholder entries read, ${officersWithoutBirthdate} without a birth date; reason=${reason}).`);
    results.push({
      src: tie.src, rel: "linked_to", dst: tie.dst, mp: tie.mp, company: tie.company,
      propsMerge: {
        flags: [reason],
        dataor_check: {
          checked: true, result: "no-match", datasetId: id,
          officersRead: lookup.officers.length, officersWithoutBirthdate,
          note: !birthDate
            ? "Datum narození poslance v roster psp.cz chybí — dataor záznam nelze porovnat vůbec."
            : `Žádný záznam v dataor (${id}) nemá shodné datum narození (${birthDate}) — vazba tvrzená grafem NENÍ potvrzena ani po kontrole úplné historie funkcí z bulk ISVR exportu.` +
              (officersWithoutBirthdate > 0 ? ` Pozn.: ${officersWithoutBirthdate} záznam(ů) v tomto souboru nemá datum narození vyplněné (typicky pre-2000 zápisy) — u těch nelze shodu ani vyloučit.` : ""),
          checkedAt: new Date().toISOString().slice(0, 10),
        },
      },
    });
  }

  const dir = "docs/data-analysis/case-money";
  const payload = {
    batch: 6,
    track: "money",
    kind: "linked_to-dataor-corroboration-annotation",
    generatedAt: new Date().toISOString().slice(0, 10),
    note:
      "PROPOSALS ONLY — props-merge onto EXISTING linked_to edges. dataor.justice.cz bulk-ISVR corroboration " +
      "sweep over the current open population (32 ties: 23 conflicting + 9 registry-unconfirmed; PRaK excluded, " +
      "handled by the separate Job B re-point payload). Deterministic (no LLM), exact-birthdate matching only, " +
      "same discipline as reconcile-ares-vr.ts. Never creates a person↔company edge, never touches review_state.",
    scopeCorrection: "Batch-006 brief cited '81 open corroborations' (pre-OSVČ-purge count, ledger.json batch2: " +
      "23 conflicting + 58 registry-unconfirmed). Batch 004's purge removed 49 of the 58 (false ico:04627695 " +
      "edges) — the live open population today is 32, not 81. This payload covers all 32 minus PRaK (Job B).",
    provenanceStamp: { track: "money", pass: null, method: "verdict", ref: "case-money/batch-006 · dataor bulk-ISVR corroboration sweep (deterministic)", computedAt: new Date().toISOString().slice(0, 10) },
    edges: results,
  };
  await fs.writeFile(`${dir}/payloads/batch-006-dataor-corroboration.json`, JSON.stringify(payload, null, 2));

  console.log("\n=== SUMMARY ===");
  console.log(`processed: ${openTies.length}`);
  console.log(`closed (registry-confirmed via dataor): ${closed}`);
  console.log(`structural negative (not ISVR-registered): ${structuralNegative}`);
  console.log(`court/form unresolved: ${courtUnresolved}`);
  console.log(`dataset missing (wrong guess): ${datasetMissing}`);
  console.log(`checked, no match (honest negative): ${checkedNoMatch}`);
  await fs.writeFile(`${dir}/dataor-corroboration-summary.json`, JSON.stringify({ processed: openTies.length, closed, structuralNegative, courtUnresolved, datasetMissing, checkedNoMatch }, null, 2));

  await store.close();
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
