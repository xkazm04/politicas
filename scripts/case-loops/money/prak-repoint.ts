/* Money loop — batch 006, Job B: the PRaK re-point (Q-money-7), finally executable.
 *
 * batch-003 found the correct entity (IČO 61858111, "PRaK, a.s. v likvidaci") for the
 * ties currently mis-pointed at IČO 49683144 ("PRAK spol. s r.o.", a different, still-
 * active s.r.o. — structurally incompatible: an s.r.o. cannot have a představenstvo, and
 * the graphed tie implies 1996-1999 + dissolved). batch-004 could not close it — or.justice.cz
 * and ARES REST both 404 on a dissolved-2012 entity (batch-003/004's "dead end"). The
 * justice-sources-registry assessment (2026-07-25) proved dataor's bulk ISVR export DOES
 * carry it — this script re-derives that proof live (not hardcoded) and emits the payload.
 *
 * TWO edges point at the wrong IČO — batch-003's writeup only narrated Bendl, but the live
 * graph has BOTH Petr Bendl (psp:person:346) AND Richard Brabec (psp:person:6184)
 * mis-pointed at company:ico:49683144 (both sourced from Hlídač events naming "PRaK, a.s.").
 *
 * OPUS VERIFICATION PASS (batch 006, this file's v2) found and this version fixes FOUR real
 * defects in the v1 draft — see docs/data-analysis/case-money/batch-006.md §Opus verdict:
 *   1. A parser gap: dataor uses SEVERAL "*_CLEN" udajTyp codes for board-type seats
 *      (STATUTARNI_ORGAN_CLEN, DOZORCI_RADA_CLEN, KONTROLNI_KOMISE_CLEN, SPRAVNI_RADA_CLEN)
 *      — the v1 extractor only recognized STATUTARNI_ORGAN_CLEN, silently DROPPING a
 *      birth-date-CONFIRMED dozorčí-rada seat for Brabec (2004-03-04→2006-05-29,
 *      narozDatum=1966-07-05, exact roster match). Fixed in lib/ingest/sources/dataor.ts's
 *      OFFICER_TYPY set — this script now collects ALL matching entries per person, not
 *      the first.
 *   2. Bendl's role_valid_from was wrongly set to 1996-01-15 (his představenstvo start) —
 *      he also held dozorčí rada 1994-08-16→1996-01-15 continuously beforehand; the tie's
 *      true start is 1994-08-16.
 *   3. The v1 payload claimed vymazDatum=2002-12-31 was "a different person's re-filing" —
 *      false. It is a bulk administrative register strike affecting SIX officer entries in
 *      this record simultaneously (Opus counted them directly in the primary record); the
 *      real distinguishing fact is simply that clenstviDo is the person's own mandate end,
 *      vymazDatum is the register-entry's own (shared, non-individuating) strike date.
 *   4. `tie_class: "steward"` was asserted on an unsupported narrative ("mayoral ex-officio
 *      appointment at a Praha-Kladno rail SPV") that the primary record does NOT support:
 *      PRaK's own Předmět podnikání is ordinary trading/engineering/advertising, no rail/
 *      transit keyword anywhere in the 42KB record, no municipal shareholder, and Bendl's
 *      seat dates (1994-08-16 start) PRECEDE his mayoralty (1994-12-05) while his end
 *      (1999-07-28) OUTLASTS it (1998-11-27) — the ex-officio framing doesn't fit the
 *      dates. FIXED: this version applies the SAME deterministic classifyTie() the rest of
 *      the money graph uses (reconcile-ares-vr.ts's rule — board-management role at a
 *      non-public-marker company), with NO asserted public-appointment narrative. Bendl's
 *      representative role (člen představenstva) classifies as "manager"; Brabec's
 *      confirmed role (člen dozorčí rady, non-public company) classifies as "steward" by
 *      the classifier's own DEFAULT rule (not owner, not board-management) — which happens
 *      to reproduce "steward" but for the honest reason ("this classifier's default for a
 *      non-management board seat"), not the retracted rail-SPV/mayoral claim.
 *
 * NO LLM. Fleet mode: payload only, not applied. Node creation (company:ico:61858111 does
 * not yet exist — ARES never had it) + edge re-points are proposals for the orchestrator.
 *
 *   PGLITE_PATH=./.pglite-copy-money-b6 npx tsx scripts/case-loops/money/prak-repoint.ts
 */
import { getStore } from "@/lib/db/store";
import { datasetId, fetchAndFindRecord, type DataorOfficer } from "@/lib/ingest/sources/dataor";

const OLD_ICO = "49683144";
const NEW_ICO = "61858111";

interface Candidate {
  pspId: number;
  lastName: string;
  firstName: string;
}
const CANDIDATES: Candidate[] = [
  { pspId: 346, lastName: "Bendl", firstName: "Petr" },
  { pspId: 6184, lastName: "Brabec", firstName: "Richard" },
];

// Same rule as scripts/case-loops/money/reconcile-ares-vr.ts's classifyTie — kept
// deterministic and IDENTICAL to the rest of the money graph's 260-tie classification, so
// this one re-point doesn't invent a bespoke standard. No public-marker keyword in "PRaK,
// a.s. v likvidaci" (verified against the record's own Předmět podnikání — ordinary
// trading/engineering/advertising, zero rail/transit/municipal terms).
const PUBLIC_MARKERS = [
  "nemocnice", "univerzita", "vysoká škola", "vodárna", "vodárenská", "kraj", "krajsk",
  "městsk", "město", "obec", "nadace", "nadační", "o.p.s", "z.ú", "z.s", "z. ú", "z. s",
  "příspěvková", "muzeum", "museum", "galerie", "divadlo", "knihovna", "akademie",
  "komora", "svaz", "spolek", "fakultní", "služba čr", "dopravní podnik", "technické služby",
  "správa", "ústav", "fond", "sportovní", "rekreační", "lidských zdrojů", "centrum",
];
const OWNER_ROLES = ["jednatel", "společník", "spolecnik", "akcionář", "akcionar", "majitel", "vlastník"];
const BOARD_MGMT_ROLES = ["představenstv", "predstavenstv"];
function foldLowerLite(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}
function classifyTie(role: string, company: string): "owner-operator" | "manager" | "steward" {
  const r = foldLowerLite(role);
  const c = foldLowerLite(company);
  const isPublic = PUBLIC_MARKERS.some((m) => c.includes(foldLowerLite(m)));
  if (!isPublic && OWNER_ROLES.some((k) => r.includes(k))) return "owner-operator";
  if (!isPublic && BOARD_MGMT_ROLES.some((k) => r.includes(k))) return "manager";
  return "steward"; // classifier's own default for a non-owner, non-board-management role
}

function earliest(dates: (string | null)[]): string | null {
  const d = dates.filter((x): x is string => x != null).sort();
  return d[0] ?? null;
}
function latest(dates: (string | null)[]): string | null {
  const d = dates.filter((x): x is string => x != null).sort();
  return d[d.length - 1] ?? null;
}

async function main() {
  const store = await getStore();
  if (!store) throw new Error("no store (set PGLITE_PATH to the copy)");
  const fs = await import("node:fs/promises");

  const persons = await store.listPersons();
  const edges = await store.listKgEdges({ rel: "linked_to", limit: 100_000 });
  const newNodeExists = (await store.listKgNodes({ kind: "company", limit: 100_000 })).some((n) => n.id === `company:ico:${NEW_ICO}`);
  console.log(`company:ico:${NEW_ICO} already in graph: ${newNodeExists}`);

  const id = datasetId("as", "full", "praha", 2012);
  console.log(`fetching ${id} ...`);
  const lookup = await fetchAndFindRecord(id, NEW_ICO);
  if (!lookup.record) throw new Error(`IČO ${NEW_ICO} not found in ${id} — proof did not reproduce, ABORTING (never persist an unverified re-point)`);
  const src = `https://dataor.justice.cz/api/file/${id}.csv.gz`;
  const companyName = lookup.record.nazev;

  const edgeRepoints: unknown[] = [];
  const openItems: string[] = [];

  for (const cand of CANDIDATES) {
    const oldEdge = edges.find((e) => e.src === `psp:person:${cand.pspId}` && e.dst === `company:ico:${OLD_ICO}`);
    if (!oldEdge) {
      console.log(`no existing edge for ${cand.firstName} ${cand.lastName} (pspId ${cand.pspId}) → company:ico:${OLD_ICO} — skipping.`);
      continue;
    }
    const person = persons.find((p) => p.pspId === cand.pspId);
    const rosterBirthDate = person && !person.birthDateUnknown ? person.birthDate : null;

    const allEntries: DataorOfficer[] = lookup.officers.filter((o) => o.lastName === cand.lastName && o.firstName === cand.firstName);
    if (allEntries.length === 0) {
      console.log(`${cand.firstName} ${cand.lastName} NOT found in the dataor PRaK record — cannot re-point this edge (would be unverified).`);
      openItems.push(`${cand.firstName} ${cand.lastName}'s edge (psp:person:${cand.pspId} → company:ico:${OLD_ICO}) exists in the graph but no matching officer entry was found in the dataor PRaK record — NOT re-pointed, left as-is pending further research.`);
      continue;
    }
    console.log(`${cand.firstName} ${cand.lastName}: ${allEntries.length} entr${allEntries.length === 1 ? "y" : "ies"} found:`);
    for (const e of allEntries) console.log(`    ${e.role} ${e.validFrom}→${e.validTo ?? "trvá"} birthDate=${e.birthDate ?? "null"}`);

    const confirmedEntries = allEntries.filter((e) => e.birthDate != null && e.birthDate === rosterBirthDate);
    const identityConfirmed = confirmedEntries.length > 0;
    // Representative entry for role/dates: the birth-date-confirmed one if any exist
    // (Opus's fix #1/#3 — don't silently prefer an unconfirmed entry when a confirmed one
    // exists), otherwise the full role history's outer bounds.
    const primary = identityConfirmed ? confirmedEntries[0] : allEntries[0];
    const roleValidFrom = earliest(allEntries.map((e) => e.validFrom));
    const roleValidTo = identityConfirmed
      ? latest(confirmedEntries.map((e) => e.validTo)) // only the confirmed span's own end — never borrow an unconfirmed entry's date into a "confirmed" claim
      : latest(allEntries.map((e) => e.validTo));
    const roleHistory = allEntries.map((e) => `${e.role} ${e.validFrom}→${e.validTo ?? "trvá"}${e.birthDate === rosterBirthDate && e.birthDate != null ? " [datum narození potvrzeno]" : ""}`).join("; ");

    const tieClass = classifyTie(primary.role ?? "", companyName);
    console.log(`  → identity ${identityConfirmed ? "CONFIRMED" : "NOT birth-date-confirmed"}, representative role="${primary.role}", tie_class=${tieClass}`);

    const confidenceNote = identityConfirmed
      ? `datum narození (${rosterBirthDate}) potvrzeno proti dataor.justice.cz záznamu (entrie: ${primary.role}, ${primary.validFrom}→${primary.validTo ?? "trvá"})`
      : `IDENTITA NENÍ potvrzena datem narození u žádné z ${allEntries.length} nalezených položek (pre-2000 zápisy bez narozDatum, P36) — shoda pouze podle jména, firmy a období (střední jistota)`;

    edgeRepoints.push({
      oldEdge: { src: `psp:person:${cand.pspId}`, rel: "linked_to", dst: `company:ico:${OLD_ICO}` },
      newEdge: {
        src: `psp:person:${cand.pspId}`, rel: "linked_to", dst: `company:ico:${NEW_ICO}`,
        // carries the SAME base props as the old edge, with the corrected role/dates/class
        // merged in — the orchestrator's repoint step should copy `review_state` (stays
        // pending_review — human gate untouched) from the old edge, not reset it.
        propsMerge: {
          role: primary.role ?? "člen představenstva",
          corroboration: identityConfirmed ? "registry-confirmed" : "conflicting",
          corroboration_source: src,
          role_valid_from: roleValidFrom,
          role_valid_to: roleValidTo,
          tie_class: tieClass, // deterministic classifyTie() — NOT an asserted public-appointment claim (Opus fix #4)
          role_history: roleHistory,
          reviewer_note:
            `Q-money-7 (batch 006): vazba přepojena z chybného IČO ${OLD_ICO} ("PRAK spol. s r.o.", stále aktivní s.r.o., strukturálně neslučitelné se zaniklou a.s. vazbou) na IČO ${NEW_ICO} ` +
            `("${companyName}", zaniklá 2012-12-13). ${cand.firstName} ${cand.lastName} — historie funkcí v záznamu: ${roleHistory}. ${confidenceNote}. ` +
            `tie_class="${tieClass}" je výstup stejného deterministického klasifikátoru jako zbytek grafu (representativní role="${primary.role}", firma nemá znak veřejného subjektu) — ` +
            `NEJDE o tvrzení o veřejném/starostenském mandátu (tato hypotéza z v1 návrhu batch 006 byla po ověření Opus modelem zamítnuta jako nepodložená primárním záznamem — viz batch-006.md).`,
          flags: identityConfirmed ? ["dataor-closed", "prak-repoint-batch006"] : ["dataor-checked-name-only-match", "prak-repoint-batch006"],
          dataor_check: {
            checked: true, result: identityConfirmed ? "match" : "name-only-match", datasetId: id,
            entriesFound: allEntries.length, confirmedEntries: confirmedEntries.length,
            checkedAt: new Date().toISOString().slice(0, 10),
          },
        },
      },
    });
  }

  if (edgeRepoints.length === 0) {
    console.error("ABORT: no re-pointable edges found (neither candidate has both a graph edge AND a dataor record match). Not writing a payload.");
    await store.close();
    process.exit(1);
  }

  const dir = "docs/data-analysis/case-money";
  const payload = {
    batch: 6,
    track: "money",
    kind: "prak-repoint",
    generatedAt: new Date().toISOString().slice(0, 10),
    version: 2, // v2 — Opus verification pass caught 4 defects in v1 (parser gap + 3 payload claims); see file header
    note:
      "Q-money-7 CLOSED — batch-003's PRaK candidate (IČO 61858111) is now corroborated via dataor's bulk " +
      "ISVR export (ARES REST 404s on this dissolved-2012 entity, the batch-003/004 dead end). This v2 payload " +
      "incorporates a batch-006 Opus verification pass's corrections (a parser gap that silently dropped a " +
      "birth-date-confirmed dozorčí-rada seat, a wrong role_valid_from, a false claim about vymazDatum's " +
      "meaning, and an unsupported 'mayoral ex-officio public appointment' narrative behind tie_class:steward — " +
      "tie_class now comes from the SAME deterministic classifier the rest of the graph uses, no narrative " +
      "claim attached). Proposals TO BE APPLIED TOGETHER: the node create + every edge re-point (with its own " +
      "tie_class, computed per-edge from the representative role actually found).",
    nodeCreateProposal: {
      id: `company:ico:${NEW_ICO}`,
      kind: "company",
      label: companyName,
      props: {
        ico: NEW_ICO,
        legalForm: "a.s.",
        status: "zaniklá (v likvidaci, vymazána 2012-12-13)",
        spisovaZnacka: lookup.spisovaZnacka,
        source: "dataor.justice.cz bulk ISVR export (as-full-praha-2012)",
        sourceUrl: src,
      },
      provenance: { track: "money", pass: null, method: "verdict", ref: "case-money/batch-006 · dataor PRaK re-point (Q-money-7)", computedAt: new Date().toISOString().slice(0, 10) },
    },
    edgeRepointProposals: edgeRepoints,
    openItems: [
      ...openItems,
      "Bendl's role_valid_from is 1994-08-16 (dozorčí rada start), not his 1996-01-15 představenstvo start — he held a continuous seat across a role change, and the tie's true start predates the board-seat entry alone.",
      "vymazDatum=2002-12-31 on Bendl's představenstvo entry is a bulk administrative register strike shared by SIX officer entries in this record (Opus-verified by direct count against the primary record) — it is NOT a distinct person's re-filing. clenstviDo=1999-07-28 remains Bendl's own, individuating mandate-end date.",
      "Brabec's re-point is registry-confirmed via a DIFFERENT entry than the one v1 of this payload checked: a dozorčí rada seat 2004-03-04→2006-05-29 (narozDatum=1966-07-05, exact roster match) that the v1 extractor missed due to a parser gap (now fixed in lib/ingest/sources/dataor.ts). His earlier 1994-1996 představenstvo seat remains unconfirmed by birth date and is recorded only in role_history, not used for the edge's own corroboration/dates.",
    ],
  };

  await fs.writeFile(`${dir}/payloads/batch-006-prak-repoint.json`, JSON.stringify(payload, null, 2));
  console.log(`\nPayload written: docs/data-analysis/case-money/payloads/batch-006-prak-repoint.json (${edgeRepoints.length} edge re-point(s), v2)`);
  await store.close();
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
