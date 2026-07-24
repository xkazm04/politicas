# Case ② Effort — Batch 001 (calibration)

**Term** PSP10 (207 MPs) · **army** 20 · **coverage** 20/207 (9.7 %) · **mean signal** 0.771
**Engine** PGlite SQL on `.pglite-copy-effort` (R4, population < 100k) · **no live write, no commit** (fleet).
**Models** 4 Opus solo dossiers (the money-crossover absentee leads) + 4 Sonnet group agents (16 MPs).
Every rendered claim carries `{claim, url, accessedAt:2026-07-24}`; primary registries (psp.cz, ARES/justice, Hlídač, vlada.gov) outrank media. Public-role facts only.

## Triage (deterministic)

Club baselines (mean contribution score): KDU-ČSL 78.5 · STAN 76.7 · TOP09 72.5 · Piráti 69.1 · SPD 67.0 · ODS 65.3 · Motoristé(MS) 64.5 · ANO 61.5.
Army = top-5 + bottom-5 composite, all 4 `absentee_manager_lead` leads (only **4 exist**, not 5 — logged, 20th slot filled by highest contested-vote workhorse), 5 quiet workhorses, plus 3 high-contested-rebellion fillers. Full ranking in `triage.json`; machine state in `ledger.json`.

## Headline finding — the young term makes low scores structural, not lazy

PSP10 began ~Nov/Dec 2025; at analysis it is ~8 months old. The bottom cluster sits at **exactly 10.4** (Brabec, Zarzycký, Kubis) or 9.4 (Kučerová) — a floor of committee/attendance points with `participation_rate 0`. Enrichment resolved **every one** to an innocent structural cause. This is the batch's biggest calibration signal: in a fresh term the effort index's tail is dominated by role artifacts, and the Case-①×② `absentee_manager_lead` crossover mis-fires accordingly.

### Systemic pattern A — "phantom mandate" (elected, never sworn)
| MP | pspId | reason | what really happened |
|---|---|---|---|
| Roman Zarzycký | 7063 | declined_mandate | Rekordních 12 103 pref. hlasů, pak se mandátu vzdal 3.11.2025 při 1. schůzi — zůstal primátorem Plzně. Nahradil Vlastimil Hebr. |
| Richard Brabec | 6184 | declined_mandate | Rezignoval 8.10.2025, zůstal hejtmanem Ústeckého kraje. Náhradnice Jana Demjanová. Není člen vlády. |
| Petr Kubis | 7019 | declined_mandate | Slib nesložil; od 8.12.2025 hejtman Karlovarského kraje. Náhradník Jiří Penc. |
| Šárka Kučerová | 7020 | declined_mandate | Vzdala se 7.10.2025 z rodinných důvodů, před slibem. Náhradník Martin Šmída. |

The graph still holds these four as PSP10 mandate-holders, so their `contribution_score` and (for Zarzycký/Brabec) `absentee_manager_lead=true` describe people **who never took the seat**. The money footprint attaches to their *municipal/regional executive* offices (Zarzycký: Čistá Plzeň 284 M + PMDP; Brabec: pre-2014 Agrofert-chemical roles), not to parliamentary absenteeism.

### Systemic pattern B — absentee-manager crossover is a false positive here
All 4 `absentee_manager_lead` flags are structurally explained and should **not** read as "absentee cashing in":
- **Zarzycký / Brabec** — phantom mandates (above); money = executive-office board seats.
- **Jaroslav Faltýnek (6190)** — present & loyal (participation 0.7), 0 bills: a club whip. The 6.27 M CZK is **AGROFERT a.s.** (IČO 26185610), whose shares sit in Babiš's trust funds since 2017; Faltýnek left the board in 2016. Separately the index codes `leadership_count 0` although he is **club vice-chair + Organizační výbor** → it *undercounts* his organizational role.
- **Pavel Karpíšek (6603)** — triple mandate (MP + starosta Vejprnic + krajský radní), first lower-house term. The ~235 M is overwhelmingly regional public/semi-public bodies where he sits *by office* (water utility 123 M, social services, sport, chamber of commerce); only ~10 M is a genuinely private tie (Truhlářství Za farou s.r.o.).

**Consequence for the product:** keep Case-① `pending_review`, but the effort loop should annotate these as executive-role / phantom rather than surface them as effort-shirking. Recommended deterministic pre-filter (feature-opportunity): flag `never_cast_ballot = participation_rate==0 && committee_count==0` before applying the absentee heuristic.

### Executive-role artifact
- **Petr Fiala (6074)** — 28.6 is the *former* PM (caretaker to ~Dec 2025) + *former* ODS chair (to Jan 2026), now opposition backbencher; took his first committee seat only 16.1.2026. The first third of the term went to government handover, not to bench absence.

## Positive symmetry — the quiet workhorses (the story the portal can't tell)

- **Jan Richter (6500, ANO)** — 5 co-sponsored tisky incl. the **jednací řád novela (tisk 72) now in the Senate** and the NKÚ-act novela (217) before his own Control Committee, which he vice-chairs — **0 floor speeches**. Headline: *"Tichý pracant kontroly: 5 tisků včetně novely jednacího řádu už v Senátu, ani jedno vystoupení v sále."*
- **Monika Brzesková (6994, KDU-ČSL)** — **chairs** the Social Policy Committee, 9 tisky incl. a government-opposed pension novela (tisk 50) steered through her own committee, only 8 speeches. (Flag: `absence_rate 0.7` unexplained by any public record — logged for review, cause not asserted.)
- **Gabriela Sedláčková (7041, MS)** & **Michal Ratiborský (6523, ANO)** — heavy oversight load (NBÚ / odposlechy commissions, foreign/defense), few or zero bills. Surfaced distinction: **legislative-authorship workhorse** vs **oversight-institutional workhorse** — the app should label both, not collapse them.
- **Karel Beran (6990, MS)** — vice-chair Defense, never spoke, resigned May 2026 for the Czech UN mission in Geneva → `declined_mandate` (term-length artifact, not disengagement).

## Contested-vote independents (does the work AND breaks on close votes)

- **Ondřej Babka (6623, ANO)** — 100 % attendance, **highest contested-vote rebellion 21.8 %**; sole bill amends the Supreme Audit Office act.
- **Petr Sokol (7045, ODS)** — chairs the European Affairs Committee AND is **ODS club vice-chair**, yet breaks the club line on 12.7 % of contested votes — an internal-tension signal, stated factually.
- **Jan Bureš (5899, ODS)** — highest score of the trio (90.5) yet regional press's "biggest absentee" (absence 0.5); two committee vice-chairs → work off the plenary floor.

## Top contributors — a co-sponsorship caveat

Haas (96.8), Šťastný (94.4), Vesecká (95.4) score high but are **never first signatory** — `bills_authored` counts co-signing of party-group legislation. Only **Ožanová (tisk 116)** and **Malá (tisk 216)** front their own bills. Real bill fates enriched: tisk 11 → zákon 90/2026 Sb., tisk 119 → 128/2026 Sb., tisky 67/72/76 passed to the Senate. Feature-opportunity: distinguish *předkladatel* (first) from co-signer in the legislative component.

## Gate

`scripts/case-loops/effort/gate.ts` on the copy: **20 / 20 PASS, 0 DROP** — every proposal targets a real `psp:person:*` node, is `effort_*`-namespaced, and touches no deterministic-owned number. Two edge ideas (`controls_as_mayor` for Zarzycký→Čistá Plzeň, `officer_by_office` tags for Karpíšek) reference real IČOs but need **new edge rels / prop conventions** → deferred to handoff (not persisted this batch).

## Metrics

| metric | value |
|---|---|
| units done / total | 20 / 207 |
| mean signal (yield proxy) | 0.771 |
| cost/unit | 4 Opus + 16 Sonnet dossiers over 8 agents |
| gate pass rate | 20/20 (100 %) |
| absentee leads found | 4 (all structural false-positives) |
| phantom mandates found | 4 |
| quiet workhorses surfaced | 5 (16 in population) |

## No silent truncation

- Only **4** `absentee_manager_lead` MPs exist (skill asked for 5) — took all 4, filled the slot with the top contested-vote workhorse. Logged.
- PSP9 participation/attendance for the build are **not** computed (roll-call dump `hl-2021ps.zip` not ingested; psp.cz network-blocked from this env) — the 4 vote-independent components ARE computed for 109 continuing MPs; the gap is the handoff item.
