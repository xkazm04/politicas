# Case ③ Law loop — handoff, batch 009 (presentation gate / quality remediation)

> Batch 008's handoff was **not overwritten** — it is preserved verbatim as
> `docs/data-analysis/case-law/handoff-batch-008.md`. Its action list (the F2 deletion payload, the
> re-triage debt) is still open and is not superseded by this run, which touched no graph topology.

**Run type:** quality remediation only. No new analysis, no new data, no new features. Scope was the
worst content-quality defect on `/zakony`: the forensic verdicts and bill dossiers were unreadable to
the Czech reader they are built for.

**Boundary honoured:** `features/lawwatch/`, `app/zakony/` (read only — no change was needed),
`lib/analysis/law-verdict*`, NEW `lib/analysis/language-gate*`, `scripts/case-loops/law/`,
`docs/data-analysis/case-law/`. **No commits run. No live `.pglite` write.** The bill index was read
once from the existing copy `.pglite-copy-law-005` and cached to `payloads/bill-index.json`, so no
later step needed a database at all.

---

## 1. Czech forensic verdicts — 27 of 27 rewritten

All 27 gated verdicts (`forensic_stated_reasoning`, `forensic_researched_context`,
`forensic_conflict_assessment`, plus every `unstatedEffects` entry and every `citations[].claim` —
**437 reader-facing strings**) were rewritten from English into Czech legal register.

**Payload for the orchestrator to apply (this is the file you want):**

```
docs/data-analysis/case-law/payloads/batch-009-cz-verdict-patch.json
```

27 rows keyed by `billUrn` (`bill:tisk:43111` … resolved against the graph's own bill nodes), each
carrying:

| prop | content |
|---|---|
| `forensic_stated_reasoning` / `_researched_context` / `_conflict_assessment` | Czech rewrite |
| `forensic_unstated_effects`, `forensic_citations` | Czech rewrite (`evidence`, `kind`, `source` byte-identical to the English) |
| `forensic_stated_reasoning_en`, `_researched_context_en`, `_conflict_assessment_en`, `forensic_unstated_effects_en`, `forensic_citations_en` | **English original, verbatim** |
| `forensic_lang: "cs"`, `forensic_lang_rewrite` | provenance |

`severity`, `confidence` and `review_state` are **not in the patch at all** — they cannot drift.
The `*_en` props are never read by `features/lawwatch/getLawData.ts`, so the English ground truth
survives for the human reviewer and for any future audit, and never renders.

Per-print Czech sources: `docs/data-analysis/case-law/payloads/verdicts-cz/verdict-<cislo>.cz.json`
(27 files). Regenerate the patch with:

```
npx tsx scripts/case-loops/law/build-cz-verdict-patch.ts   # PREPARE only, never writes a DB
```

### Fidelity verification — the P51 lesson, run as code AND by hand

The builder refuses to emit the payload unless every one of these passes:

- **structure** — `billTisk`, `unstatedEffects` count, `citations` count;
- **citations** — every `kind` and every `source` byte-identical EN ⇄ CZ;
- **statutes** — every `č. N/RRRR Sb.` cited anywhere in English prose still cited in Czech, and none
  added;
- **URLs** — every `evidence` and every web/`bill_text` source preserved, none added, none dropped;
- **language** — every Czech string passes the gate, and the English original is re-scored as a
  control (it must still be caught).

Final run: **27/27 rewrites, 0 fidelity findings, 0 Czech gate failures, 436 English fields flagged by
the control.**

**Numeral drift (12 lines across 8 prints) is reported as advisory and was read side-by-side by
hand.** All 12 are Czech spelling conventions, not lost facts: `tisk 488 of the 9th electoral term` →
„devátého volebního období"; `~8 consequential fixes` → „zhruba osm"; `16-17 year-olds` →
„šestnácti- a sedmnáctiletých"; `10-day cap` → „desetidenní strop"; `Part 4) … Part 8)` →
„část čtvrtá … osmá"; `3x the subsistence minimum` → „trojnásobku životního minima"; `6-page PDF` →
„šestistránkové PDF"; `08.12.2025` → „8. prosince 2025". The full list is in the payload's
`numeralReview` block.

**Hedge audit — the failure mode this pass exists to prevent.** Hedge-marker density was counted per
print in both languages. Czech ≥ English on all 27 (lowest ratio 0.94 on tisk 124 — parity; median
2.4). The EN→CZ length ratio is 0.97–1.09 everywhere, so nothing was compressed away. A separate scan
for *hardened* phrasing (`prokázal`, `dopustil se`, `porušil`, `je střet zájmů`, `obohatil`, …)
returned **0 hits** — no hedge was silently turned into an assertion anywhere.

### Near-misses caught and fixed

1. **A real hedge near-miss, in my own draft, tisk 11.** The English says the sponsors
   *"requested (and per the history, achieved) first-reading passage under §90 odst. 2"*. My first
   Czech draft read „…i dosáhli **podání**", which quietly changed *what* was achieved. Fixed to
   „…i dosáhli", preserving the English claim exactly.
   **Flagged for the human reviewer, NOT silently resolved:** that English sentence contradicts the
   verdict's own `researchedContext`, which says the first reading *rejected* the expedited request.
   The contradiction is in the source verdict, and a translation is the wrong place to fix it.
2. **Two false alarms in the checker itself, fixed before trusting it.** (a) The numeral normaliser
   treated `", "` as a thousands separator, so `282, 16` glued into `28216` and the checker invented
   mismatches that were in neither text (surfaced on tisk 115 and tisk 24). (b) The statute check
   scanned prose only, so a `kind:"law"` citation whose `source` is a bare `141/1961` looked "added"
   when the Czech claim spelled it out formally as „zákon č. 141/1961 Sb.". Both fixed; without the
   fixes the run reported 46 findings, 43 of them phantom — a checker trusted unverified would have
   sent me editing correct translations.

---

## 2. The language gate — `lib/analysis/language-gate.ts` (new module, not an extension)

**Choice: a sibling module, not an extension of `public-copy.ts`.** Two reasons. (a) Different
concern, different remedy: `public-copy.ts` catches *pipeline jargon inside true sentences*; this
catches *the wrong language*. (b) `public-copy.ts` is shared code owned by the effort case
(`scripts/case-loops/effort/gate.ts` imports it) — under the fleet rule it is not this driver's to
edit. `public-copy.ts` is **untouched**. The two compose cleanly at any call site.

**Design.** A deterministic stopword-frequency classifier over two closed word lists, plus an English
morphology test (`-tion`, `-ing`, `-ed`, `-ly`, `-ness`, `-ship`, with a 5-character floor and a
diacritics veto; `-ment`/`-ance`/`-ence` are deliberately excluded because Czech has *dokument*,
*argument*, *reference*). Ambiguous tokens shared by both languages (`a`, `to`, `on`, `by`, `do`,
`i`, `no`, `so`) score for **neither** side. That matters here: the English originals are dense with
`č. 586/1992 Sb.`, `Kč` and `důvodová zpráva`, so a diacritics test or a naive bag-of-words calls them
Czech. No model call, no network, no state — the same input always scores the same.

- **Persist time — FAILS.** `validateLawVerdict()` now takes `requireCzech` (**default true**) and
  pushes one error per English reader-facing field, so the law-verdict contract rejects an English
  verdict outright; `scripts/case-loops/law/gate-verdicts.ts` runs that same contract before the
  orchestrator writes anything live. `assertCzech()` is the throwing form for write paths. Archived
  pre-rewrite verdicts can still be re-validated with `requireCzech: false`.
- **Render time — WITHHOLDS.** `features/lawwatch/getLawData.ts` runs `czechCopyOrNull()` over every
  forensic string and every derived summary. A failing string becomes `null` and simply does not ship;
  `LawForensicView.withheldFields` counts them and the UI discloses the count. Withholding is
  non-destructive — the text stays in the graph for the rewrite pass. Loader failures route through
  `reportLoaderFailure()` (`custom/no-silent-null-catch` respected).

**Result on the real 27** (`lib/analysis/language-gate.test.ts`, 12 tests, run against the actual
payload files, not fixtures):

| | reader-facing fields | flagged as English |
|---|---|---|
| BEFORE (English originals) | 437 | **436 (99.8 %)** |
| AFTER (Czech rewrites) | 437 | **0** |

The single English survivor is documented, not hidden: tisk 173's citation *"Sněmovní tisk 173/0
index page listing documents (Návrh zákona včetně důvodové zprávy, Platné znění s vyznačením změn,
…)"* — a bilingual label whose Czech document titles genuinely outnumber its English frame (4 EN
markers vs 8 CS in 24 tokens). It was rewritten to Czech anyway, so it never reaches a reader; it is
recorded here as the gate's known limit on mixed-language strings.

---

## 3. Bill summaries — 140 of 141 („co to mění")

Builder: `scripts/case-loops/law/build-bill-summaries.ts` → `payloads/bill-summaries-cz.json`.
**Deterministic, derived from the print's own cached text** (`.data/law-collision-cache/tisk-<cislo>/*.txt`,
the `pdftotext` render of the PDF on psp.cz). No model, no inference from the graph's derived fields.
Four real structures in that text carry "what changes":

| method | prints | example |
|---|---|---|
| `title_preamble` — the „kterým se mění …" clause | 65 | tisk 11 → „Mění zákon č. 589/1992 Sb., o pojistném na sociální zabezpečení a příspěvku na státní politiku zaměstnanosti." |
| `cast_captions` — the drafter's own `Změna …` heading per ČÁST | 60 | tisk 24 → „Mění 9 předpisů — změna obecního zřízení, zákona o obecní policii, zákona o odpovědnosti za škodu způsobenou při výkonu veřejné moci … a 6 dalších předpisů." |
| `new_act` — the `ZÁKON ze dne …, o <subject>` head | 13 | tisk 6 → „Nový zákon o Úřadu pro prevenci korupce a střetu zájmů." |
| `repeal` — the „kterým se zrušuje …" clause | 2 | tisk 116 → „Ruší zákon č. 353/2019 Sb., o výběru osob do řídících a dozorčích orgánů právnických osob s majetkovou účastí státu (nominační zákon)." |

**Coverage: 140/141. The one gap is tisk 87**, whose cache directory holds only `index.html` — the
print's PDF was never fetched, so there is no text to derive from. It renders the honest placeholder
(„Shrnutí zatím není — text tohoto tisku nemáme v archivu ve strojově čitelné podobě…"), never a
guess. Fetching tisk 87's PDF into the cache would close it; that is an ingest task, not a
presentation one, and is left for the orchestrator.

Three parser defects were found and fixed while building this, each verified against raw text:

- **the annex trap** — a print caches two texts, and the „Platné znění … s vyznačením navrhovaných
  změn" annex is usually the *larger* one but carries no preamble and no ČÁST structure. Picking by
  size silently lost 12 prints (tisk 40, 120 and 10 others). The body is now selected by the enacting
  formula „Parlament se usnesl na tomto zákoně".
- **wrapped captions** — a ČÁST caption often has a *blank line inside it* in the pdftotext render
  (measured on tisk 28's ČÁST DRUHÁ), which truncated captions mid-phrase.
- **`ÚČINNOST` counted as a change** — only `Změna …` captions are kept now; listing „účinnost" among
  the things a bill changes would have been a false statement.

Every derived summary passes the Czech language gate before it is written (the builder throws
otherwise), and again at render time.

---

## 4. The forensic block, restructured (`features/lawwatch/components/BillDetail.tsx`)

Reading order is now the order a reader actually thinks in:

1. **Status strip, full width, solid cobalt, first thing in the block:** „odvozený návrh · čeká na
   revizi člověkem · **není to verdikt o pochybení**". Unmissable by construction — a filled bar, not
   a footnote.
2. **Compact header:** závažnost · jistota N/5 · stav `pending_review` · „kontrola proti fabrikaci ·
   průchod grafu N".
3. **„co to mění"** — the derived one-liner, or the honest placeholder.
4. **„co analýza zjistila"** — deklarovaný důvod, posouzení střetu zájmů, and (behind one disclosure
   toggle) nezávislý kontext + nedeklarované dopady, each with its linked source.
5. **„co analýza NETVRDÍ"** — a real, data-driven list, not boilerplate: that no wrongdoing is
   asserted and the finding is stored as `pending_review`; that severity and confidence are the
   analysis's own rating, not a court's or a regulator's; that a sponsor money tie is an indicium, not
   proof; **when there are no unstated effects, that the absence is itself the finding**; and **when
   the language gate withheld N strings, that the block is therefore incomplete** (with N declined
   correctly: 1 „část textu" / 2–4 „části textu" / 5+ „částí textu").
6. **References** — a numbered `<ol>`: `[1] claim · kind · registry · label ↗`. Every citation now
   resolves through `citationRef()` in `lawwatchLabels.ts`: psp.cz links keep the print number
   („psp.cz · sněmovní tisk 58"), `kind:"law"` links to **e-Sbírka**
   (`e-sbirka.gov.cz/sb/RRRR/N`, the same URL shape `lib/kg/sourceLinks.ts` uses), and a `graph_fact`
   urn renders as a readable identifier („firma IČO 26185610") with **no link**, because no public
   page exists for it and guessing one would be worse than silence. **No raw serialized object
   anywhere.**

Also on the dossier: the „co to mění" line is now the lead, directly under the print number and above
the 200-character legal title; in the list (`BillBrowser`) the summary is the bold first line, the
official title drops to secondary, and free-text search now matches summaries too — which is what
makes 141 rows navigable.

Konstrukt discipline: tokens only (`signal`/`cobalt`/`ochre`/`steel`/`hairline`), mono meta at 11 px
bold, `border-t` / `border-l-4` section rules, `SourceNote` on every derived claim, body copy ≥ 13 px.

---

## 5. Proofread pass over `/zakony`

| where | was | now |
|---|---|---|
| `LawWatchPage` | „hrany amends + assigned_to" | „vazby tisk → zákon a přikázání výborům" |
| `LawWatchPage` | „Case ③, 4 dávky close-readu." | „Vychází ze čtyř dávek ručního porovnání textů obou tisků." |
| `LawWatchPage` | **„u 2 tiskuů"** (declension bug — `"tisku" + "ů"`) | „u 1 tisku" / „u 2 tisků" |
| `LawWatchPage` | „Otevřete konkrétní tisk pro jeho vlastní census" (calque) | „Vlastní census má každý tisk ve svém detailu, pokud pro něj existuje." |
| `LawWatchPage` | raw counts in the section aside | `f.int()` (Czech thousands separators, DESIGN §2) |
| `LawWatchPage` | „(pass 20)", „(hist_vybory)" | „(průchod grafu 20)", dataset name dropped |
| `BillDetail` | „(Case ①)", „psp.cz hist_vybory ⋈ hist (F15)" | plain Czech |
| `BillDetail` | „N zákonů" for every N | 1 „zákon" / 2–4 „zákony" / 5+ „zákonů" |
| `BillDetail` | „gate „law-verdict" · pass N" | „kontrola proti fabrikaci · průchod grafu N" |
| `BillBrowser` | „graf pass N" | „průchod grafu N" |
| `CollisionsPage` | „close-read", „partitioned pre-check (v2) + LLM close-read", „ověřeny grepem", „post-regen", a raw repo path shown to readers | Czech equivalents; the repo path removed |

---

## 6. `npm run check`

**PASS.** typecheck clean · lint 0 errors (1 pre-existing `react-hooks/exhaustive-deps` **warning** in
`features/graph/components/NodeSearch.tsx`, outside this boundary and untouched) · **421 tests in 40
files, all passing**.

One lint error was introduced and fixed during the run (`prefer-const` in the summary builder).
`lib/analysis/law-verdict.test.ts` needed its fixture rewritten to Czech — the contract now rejects
English by default, which is the point; three new tests cover it (English rejected; English inside an
effect or a citation claim rejected; `requireCzech: false` escape hatch).

---

## 7. Files added / changed

**Added**
- `lib/analysis/language-gate.ts`, `lib/analysis/language-gate.test.ts`
- `scripts/case-loops/law/build-bill-summaries.ts`
- `scripts/case-loops/law/build-cz-verdict-patch.ts`
- `docs/data-analysis/case-law/payloads/verdicts-cz/verdict-<cislo>.cz.json` × 27
- `docs/data-analysis/case-law/payloads/batch-009-cz-verdict-patch.json` ← **apply this**
- `docs/data-analysis/case-law/payloads/bill-summaries-cz.json`
- `docs/data-analysis/case-law/payloads/bill-index.json` (cislo → bill urn, so no later step opens the DB)
- `docs/data-analysis/case-law/handoff-batch-008.md` (batch 008's handoff, preserved)

**Changed**
- `lib/analysis/law-verdict.ts` (+`requireCzech`, default true), `lib/analysis/law-verdict.test.ts`
- `features/lawwatch/getLawData.ts` (render-time withholding, `summary`/`summarySource`,
  `summaryCount`, `forensicWithheldCount`)
- `features/lawwatch/lawwatchLabels.ts` (`esbirkaUrl`, `CITATION_KIND_CZ`, `citationRef`)
- `features/lawwatch/components/BillDetail.tsx` (summary lead, restructured block, `CitationList`)
- `features/lawwatch/components/BillBrowser.tsx` (summary-first rows, search over summaries)
- `features/lawwatch/LawWatchPage.tsx`, `features/lawwatch/CollisionsPage.tsx` (proofread)

**Deliberately untouched:** `lib/analysis/public-copy.ts`, `lib/analysis/kg-verdict.ts`,
`messages/*.json`, `app/zakony/**`, every other case.

---

## 8. For the orchestrator

1. Apply `payloads/batch-009-cz-verdict-patch.json` with the props-merge writer. Re-verify first with
   `npx tsx scripts/case-loops/law/build-cz-verdict-patch.ts` — it refuses to emit on any finding.
2. **Human-review item, not a translation bug:** tisk 11's English `statedReasoning` says the sponsors
   *achieved* first-reading passage while its own `researchedContext` says the first reading
   *rejected* that request. The Czech preserves the English exactly. Somebody should decide which is
   right before this verdict is ever promoted past `pending_review`.
3. Ingest gap: tisk 87 has no cached PDF text, so it is the only print without a „co to mění" line.
4. Shared-vault addition this driver did **not** make (fleet rule) — proposed text for
   `docs/case-loops.md` §6, presentation gate: *„Czech is enforced deterministically at both ends —
   `lib/analysis/language-gate.ts`, rejected by `validateLawVerdict` at persist time and withheld by
   `getLawData` at render time. A bill's one-line summary is derived from its own cached text, never
   written by a model; a print with no cached text says «shrnutí zatím není» and shows nothing."*
