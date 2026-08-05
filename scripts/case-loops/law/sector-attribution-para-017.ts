/* Case ③ Law loop — batch-017 P3: §-level sector attribution.
 *
 * The final act of the rework deferred since batch-004. Batch-012 wired ATTRIBUTION into the
 * triage (a conflict flag must name the amended LAW whose own label carries the company's
 * sector); this joins the batch-017 amended-§ census so every attributed (bill, company, law)
 * flag now also names WHICH §§ of that law the bill operatively amends — the difference
 * between „the bill touches the sector's statute" and „the bill touches §§ 55a and 151 of it".
 *
 * WHAT A ROW IS (batch-017 audit M9): a topological adjacency joined to a text census — a
 * DERIVED, UN-GATED lead. No row passes any human gate; the money ties underlying the
 * attribution carry their own review states on the money surfaces. Where a published forensic
 * verdict has ALREADY adjudicated a flag, the row says so verbatim-adjacent (verdictDisposition)
 * rather than republishing an adjudicated-non-credible lead as a neutral fact.
 *
 * Deterministic, read-only: ledger rows (the live attributed flags) ⋈ census rows. A flag on
 * a bill whose census row carries `partitionFallback` publishes NO § lists at all — a collapsed
 * partition's single bucket may be mislabeled, so its §§ must never ride under a sector flag
 * (the audit's latent-hazard note). Each row also carries the census's own extractor
 * diagnostics, because the census's trust rule is per-bill: per-§ rows are trustworthy exactly
 * where the diagnostics are clean. No writes; the payload is the reviewable artifact and the
 * basis for enriching /zakony's conflict rendering in a build phase.
 *
 *   npx tsx scripts/case-loops/law/sector-attribution-para-017.ts
 * → docs/data-analysis/case-law/payloads/batch-017-sector-attribution-para.json
 */
import { readFileSync, writeFileSync } from "node:fs";

const OUT = "docs/data-analysis/case-law/payloads/batch-017-sector-attribution-para.json";

/** Dispositions already published by gated verdicts — the audit's M9/M9b: every one of these
 * flags was adjudicated by a published verdict, and a re-publication may not stay silent about
 * any of them. SYMMETRY IS THE POINT (closure finding M9b): the first cut of this map carried
 * only the exculpatory closures and withheld the two adjudications that cut AGAINST the
 * sponsors — verdict-67's credible 100/2001 channel and verdict-221's medium finding. A
 * disposition map that filters by direction un-adjudicates the record. Keyed by
 * `${cislo}|${viaLawRef}|${company}`. Verbatim-faithful summaries, each naming its verdict. */
const ADJUDICATED = new Map<string, string>([
  ...["IF Holding a.s.", "IF FACILITY a.s.", "Hartenberg Holding, s.r.o.", "IMOBA, a.s."].map(
    (c) => [`11|589/1992|${c}`, "archivovaný posudek k tisku 11 shodu sektoru uzavřel jako shodu okolností bez mechanické vazby na předmět novely (vyměřovací základ pojistného jediné OSVČ, žádný kanál k povinnostem firem)"] as [string, string],
  ),
  ...["AGROFERT, a.s.", "Kostelecké uzeniny a.s.", "AGROPROFIT, spol. s r.o.", "Lovochemie, a.s.", "AGRONOVA CS s.r.o."].map(
    (c) => [`67|139/2002|${c}`, "archivovaný posudek k tisku 67 tuto skupinu uzavřel jako nevěrohodný konflikt (legislativně-technická záměna slov bez věcného dopadu)"] as [string, string],
  ),
  // the INCULPATORY adjudication — verdict-67 judged this the credible, if economy-wide, channel
  ...["CS CABOT, spol. s r.o.", "PRECHEZA a.s.", "Fatra, a.s.", "Synthesia, a.s."].map(
    (c) => [`67|100/2001|${c}`, "archivovaný posudek k tisku 67 tento kanál hodnotí jako věrohodný, byť plošný (jednotné povolovací řízení s věcným dopadem na provozovatele podléhající posuzování vlivů)"] as [string, string],
  ),
  [
    "67|100/2001|SynBiol, a.s.",
    "archivovaný posudek k tisku 67 tuto vazbu posoudil pod zákonem č. 258/2000 Sb. (jiný zákon, než pod kterým ji vede tato atribuce) jako týž plošný kanál jednotného řízení, nikoli samostatný nález",
  ],
  ...["IF Holding a.s.", "IF FACILITY a.s."].map(
    (c) => [`67|235/2004|${c}`, "archivovaný posudek k tisku 67 tuto dvojici uzavřel jako nevěrohodnou (žádný věrohodný ekonomický kanál k obchodování s pozemky ani k výstavbě)"] as [string, string],
  ),
  ...["Hartenberg Holding, s.r.o.", "IMOBA, a.s."].map(
    (c) => [`67|235/2004|${c}`, "archivovaný posudek k tisku 67 tuto vazbu ponechal otevřenou s neurčeným směrem dopadu (druhý, nekvantifikovaný kanál přes definici stavebního pozemku pro DPH)"] as [string, string],
  ),
  ["77|12/2020|NEXNET, a.s.", "archivovaný posudek k tisku 77 vazbu uzavřel bez doložitelné spojitosti s obsahem novelizovaných ustanovení (terminologické přizpůsobení; sektorová shoda jako shoda náhod)"],
  ["77|187/2006|MAE invest a.s.", "archivovaný posudek k tisku 77 vazbu uzavřel bez doložitelné spojitosti s obsahem novelizovaných ustanovení (terminologické přizpůsobení; sektorová shoda jako shoda náhod)"],
  ...["ZPS holding s.r.o.", "ČSOB Pojišťovna, a. s., člen holdingu ČSOB"].map(
    (c) => [`103|155/1995|${c}`, "archivovaný posudek k tisku 103 lead uzavřel jako artefakt heuristiky sdíleného zákona bez věcného opodstatnění (jediný operativní obsah je nová informační povinnost § 57a)"] as [string, string],
  ),
  [
    "121|187/2006|Teleky Medicus s.r.o.",
    "archivovaný posudek k tisku 121 nenašel žádný věrohodný kanál (plošná rodinná politika vyplácená zákonným třídám fyzických osob, nikoli firmám)",
  ],
  ...["Hartenberg Holding, s.r.o.", "IMOBA, a.s."].map(
    (c) => [`154|634/2004|${c}`, "archivovaný posudek k tisku 154 sektorovou atribuci uzavřel jako neodpovídající žádnému věrohodnému ekonomickému kanálu"] as [string, string],
  ),
  ...["IF Holding a.s.", "IF FACILITY a.s."].map(
    (c) => [`201|348/2005|${c}`, "archivovaný posudek k tisku 201 vazbu hodnotí jako neprokázanou (formální průnik; plošné opatření bez vztahu k oboru podnikání skupiny)"] as [string, string],
  ),
  // the MEDIUM adjudication — verdict-221 confirmed both signals genuinely touch the amended provisions
  [
    "221|218/2000|MAE invest a.s.",
    "archivovaný posudek k tisku 221 (závažnost střední) potvrdil, že se oba vedoucí signály skutečně týkají novelizovaných ustanovení o střetu zájmů při poskytování dotací",
  ],
  [
    "221|252/1997|AGROCENTRUM JIZERAN a.s.",
    "archivovaný posudek k tisku 221 (závažnost střední) potvrdil, že se oba vedoucí signály skutečně týkají novelizovaných ustanovení o střetu zájmů při poskytování dotací",
  ],
]);

function main() {
  const ledger = JSON.parse(readFileSync("docs/data-analysis/case-law/ledger.json", "utf8")) as {
    rows: { cislo: number | null; sectorAdjacency?: boolean; sectorAdjacentCompanies?: { company: string; sector: string; sponsor: string; viaLaw?: { ref: string; title: string } | null }[] }[];
  };
  const census = JSON.parse(readFileSync("docs/data-analysis/case-law/payloads/batch-017-amended-paragraph-census.json", "utf8")) as {
    rows: {
      cislo: number;
      partitionFallback: boolean;
      statutes: { lawRef: string; operativeParagraphs: string[]; citedOnlyParagraphs: string[] }[];
      extractorMissedRefs: string[];
      extractorExtraRefs: string[];
    }[];
  };
  const censusByCislo = new Map(census.rows.map((r) => [r.cislo, r]));

  const flags: {
    cislo: number;
    company: string;
    sector: string;
    sponsor: string;
    viaLawRef: string | null;
    viaLawTitle: string | null;
    attributionStatus: "derived-ungated";
    operativeParagraphs: string[] | null;
    citedOnlyParagraphs: string[] | null;
    partitionFallback: boolean | null;
    extractorMissedRefs: string[] | null;
    extractorExtraRefs: string[] | null;
    diagnosticsClean: boolean | null;
    verdictDisposition: string | null;
    note: string;
  }[] = [];
  for (const r of ledger.rows) {
    if (!r.sectorAdjacency || !Array.isArray(r.sectorAdjacentCompanies) || r.cislo === null) continue;
    const c = censusByCislo.get(r.cislo) ?? null;
    for (const a of r.sectorAdjacentCompanies) {
      const ref = a.viaLaw?.ref ?? null;
      // a partition-fallback row's single bucket may be mislabeled (footnote-harvested ref) —
      // publish NO § lists under the flag, ever, rather than risk the whole bill's §§ riding
      // under one statute's name (batch-017 audit M12, latent-hazard note).
      const st = ref && c && !c.partitionFallback ? c.statutes.find((s) => s.lawRef === ref) ?? null : null;
      let note: string;
      if (!ref) note = "attribution via the bill's own title — no single statute carries the sector, so no §-list applies";
      else if (!c) note = "no census row for this bill (no cached text)";
      else if (c.partitionFallback) note = "census row is a partition-fallback collapse — no § list is published for this flag, because the collapsed bucket's label itself may be wrong";
      else if (!st)
        note =
          "the census carries no § bucket for this statute — either an annex-only amendment (no § token exists in the block, e.g. správní-poplatky položky) or a partitioner limit; the flag itself remains a bare topological adjacency, §-level unavailable";
      else if (st.operativeParagraphs.length === 0)
        note = "the bill touches this statute in the census only via citations, no operative § isolated — a lead to re-read, not a §-level confirmation";
      else note = "operative §§ of the attributed statute, from the amended-§ census (citedOnly §§ are a lead list — they may belong to text quoted about another act)";
      flags.push({
        cislo: r.cislo,
        company: a.company,
        sector: a.sector,
        sponsor: a.sponsor,
        viaLawRef: ref,
        viaLawTitle: a.viaLaw?.title ?? null,
        attributionStatus: "derived-ungated",
        operativeParagraphs: st?.operativeParagraphs ?? null,
        citedOnlyParagraphs: st?.citedOnlyParagraphs ?? null,
        partitionFallback: c?.partitionFallback ?? null,
        extractorMissedRefs: c?.extractorMissedRefs ?? null,
        extractorExtraRefs: c?.extractorExtraRefs ?? null,
        diagnosticsClean: c ? c.extractorMissedRefs.length === 0 && c.extractorExtraRefs.length === 0 : null,
        verdictDisposition: ADJUDICATED.get(`${r.cislo}|${ref}|${a.company}`) ?? null,
        note,
      });
    }
  }
  const withParas = flags.filter((f) => (f.operativeParagraphs?.length ?? 0) > 0).length;
  const adjudicated = flags.filter((f) => f.verdictDisposition !== null).length;
  writeFileSync(
    OUT,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        method:
          `Live attributed sector flags (ledger, batch-012 wiring) joined to the batch-017 amended-§ census. EVERY row is a DERIVED, UN-GATED lead (attributionStatus) — a topological adjacency between a sponsor's company sector and an amended statute's domain, joined to a text census; no human gate has reviewed any of it, and the underlying money ties carry their own pending states on the money surfaces. Where the census isolated the statute, the flag names its operative §§; every other case states exactly why it could not (fallback collapse — which also suppresses the § lists entirely, annex-only/extractor limit, citation-only) rather than pretending §-precision it lacks. Rows carry the census's per-bill extractor diagnostics because the census's own trust rule is per-bill (clean diagnostics → trustworthy §§). Flags already adjudicated by a published forensic verdict say so in verdictDisposition — ${adjudicated} of ${flags.length} flags carry one (every flagged bill has a published verdict), inculpatory and exculpatory alike: filtering dispositions by direction would un-adjudicate the record. A flag with no disposition would mean a bill no verdict has reached.`,
        flags: flags.length,
        flagsWithOperativeParagraphs: withParas,
        flagsWithVerdictDisposition: adjudicated,
        rows: flags.sort((a, b) => a.cislo - b.cislo),
      },
      null,
      1,
    ),
  );
  console.log(`${flags.length} attributed flags · ${withParas} carry operative §§ · ${adjudicated} carry a published-verdict disposition → ${OUT}`);
  for (const f of flags)
    console.log(
      `  tisk ${f.cislo} · ${f.company} (${f.sector}) via ${f.viaLawRef ?? "title"} · §§ ${f.operativeParagraphs?.join(",") ?? "—"} · ${f.verdictDisposition ? "ADJUDICATED · " : ""}${f.note.slice(0, 50)}`,
    );
}
main();
