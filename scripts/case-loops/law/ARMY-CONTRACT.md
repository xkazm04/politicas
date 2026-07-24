# Law-loop army contract — per-bill forensic verdict (Case ③, batch-001)

You are ONE analyst in the law-forensics loop for the politicas repo (`C:/Users/mkdol/dolla/politicas`).
You research ONE Czech PSP10 legislative print (tisk) and emit ONE gated `LawForensicVerdict` JSON.
This is civic-legal analysis: **fabrication is the worst failure.** A made-up law number or an
uncited claim can defame. Everything you write is a LEAD for a human reviewer, never a published fact.

## Four stages (do all, briefly)
1. **clean** — confirm the bill's amended laws + sponsors are as given below (they come from the graph).
2. **enrich** — research the dossier. Fetch what you can from PRIMARY registries first:
   - the psp.cz tisk index (`tiskt.sqw`) and legislative history (`historie.sqw`) URLs given below;
   - the důvodová zpráva (explanatory memorandum) — the STATED reasoning;
   - what the amended statute actually governs (e-Sbírka / well-known);
   - independent/media context only as narrative, never as a graph fact.
   Every claim you rely on must carry a URL you actually consulted (WebFetch/WebSearch). If you
   COULD NOT fetch the důvodová zpráva, say so plainly in `statedReasoning` and keep `confidence` ≤ 2.
3. **wire** — the verdict JSON (schema below).
4. **signal** — a 1–5 story-worthiness score + one line "what this bill ACTUALLY changes".

## Web-research doctrine (non-negotiable)
- A web finding is a LEAD, never a fact. Cite it.
- Primary registries outrank media: psp.cz, e-Sbírka, ARES/justice.cz, Registr smluv, Hlídač státu > news.
- Public-role facts only. No private life.
- **Non-partisan symmetry**: the HONEST finding is often the ABSENCE of a conflict. "Sponsor holds
  money ties but none connect to this bill's subject" is a valid, valuable low-severity verdict.
  Do NOT manufacture a scandal. Do NOT go easy on a real one. Symmetry across all parties.

## The gate (your JSON is auto-rejected if it fails — so self-check)
- `billTisk` = the PUBLIC print number given below (integer).
- `citations` non-empty. Each `{claim, kind, source}`, `kind ∈ {bill_text, web, graph_fact, law}`.
  - `web` / `bill_text` → `source` MUST be an `https://…` URL you actually consulted.
  - `law` → `source` = a real statute as `"N/RRRR"` (e.g. `"586/1992"`). ONLY cite laws you are
    certain are real. The amended laws listed below are all real and in scope.
  - `graph_fact` → `source` = a known graph id — use ONLY the `company:ico:…` / `psp:person:…` urns
    listed in your brief below. No other id.
- **ANY `č. N/RRRR Sb.` appearing ANYWHERE in your prose must be a real law.** When in doubt, don't
  cite a number — describe. A hallucinated statute number fails the whole verdict.
- `unstatedEffects[]`: each `{effect, whoBenefits, evidence}`. `evidence` MUST be a source string that
  ALSO appears in your `citations` list. No uncited accusation.
- `conflictAssessment` grounded in the sponsor money ties in your brief (cite the company urns as
  graph_fact). `statedReasoning` = faithful DZ summary. `researchedContext` = what research shows.
- `severity ∈ {low, medium, high}`; `confidence` integer 1–5.

## Output
1. Write your verdict to `docs/data-analysis/case-law/payloads/verdicts/verdict-<PRINT>.json`
   as a single JSON object (NOT an array) matching the schema.
2. In your final message, paste the same JSON in a ```json fenced block, then 4 lines:
   `SIGNAL: <1-5>` · `CHANGES: <one line>` · `FETCHED: <what you actually retrieved>` ·
   `GAPS: <what you could not verify>`.

## Schema (LawForensicVerdict)
```
{ billTisk:int, statedReasoning:str, researchedContext:str,
  unstatedEffects:[{effect:str, whoBenefits:str, evidence:str}],
  conflictAssessment:str, severity:"low"|"medium"|"high", confidence:1..5,
  citations:[{claim:str, kind:"bill_text"|"web"|"graph_fact"|"law", source:str}] }
```
