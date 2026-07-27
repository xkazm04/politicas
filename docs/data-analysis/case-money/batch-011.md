# Money batch 011 — sweeping AGROFERT, and finding the corpus is a sample

Case ① FollowTheMoney · 2026-07-27 · sibling law/effort sessions concurrent.
Driver: Opus. One Opus verification pass at maximum depth (**PARTIAL** — five framing
defects corrected, one premise refuted).

> **Headline.** The AGROFERT sweep was the point of the batch, but the bigger finding
> came from a shape noticed on the way: **the graph's entire contract corpus is a capped
> per-company sample, not a census.** 35 companies sit at exactly 25 contracts. Every CZK
> figure this case has ever rendered — including the `/penize` headline tile — was a
> truncated sum presented as a total.

## 1. The coverage defect (the important one)

Checking AGROFERT's contracts turned up a suspicious shape: nearly every AGROFERT-group
company carried 20–25 `supplies` edges, and AGROFERT's own dated contracts stopped at
**2019-02-05** even though Registr smluv runs continuously and the live sweep finds 2026
contracts. `supplies-coverage-audit.ts` tested it against the graph alone:

| signal | value |
|---|---|
| companies with ≥1 `supplies` edge | 149 |
| **companies sitting at exactly 25 contracts** | **35** |
| companies with ≥20 | 70 of 149 (47 %) |
| AGROFERT: graph vs live register | 24 vs **49** |
| group total: graph vs live register | ~165 vs **624** |

A per-company pull limit of 25 is not a coincidence. **Every per-company and per-MP CZK
total in this graph is a floor**, including the module's headline "~18.7 bn CZK reachable
across 73 MPs".

**This was rendering unlabelled.** `/penize` showed the sum as *"veřejné peníze v
dosahu"*, sourced *"registr smluv · Σ hodnot smluv"* — a capped sample presented as a
total, which is exactly what the brand rule forbids. Fixed:

- `getMoneyData` now computes `stats.contractCoverage` **from the data** (a low ceiling
  shared by ≥3 companies), so an uncapped re-ingest turns the caveat off by itself rather
  than leaving a stale hardcoded disclaimer.
- The tile renders **"nejméně X"** with a sub-line naming the cap and how many companies
  sit on it, and a source line saying "vzorek se stropem 25/firma". Both catalogs updated.
- A loader test pins the honest direction: the caveat must be **earned** — with no
  detectable ceiling the surface must not print "nejméně".

The remediation (re-ingest contracts without the cap, now cheap and token-free) is
batch-012 work; the label is the honest interim state, not the fix.

## 2. The AGROFERT sweep

9 graphed group companies, full pagination, no truncation. Correcting my own batch-010
steering: AGROFERT **had** been contract-queried — it just held 24 of its 49 records.

| | count |
|---|---|
| records across the 9 companies | **624** |
| published inside the registered sole-shareholder window (2025-10-15 → 2026-02-20) | **23** |
| stated value of those 23 | **197 261 535 CZK** |
| published from 2025-12-09 (member of government) | **16** — 9 355 026 CZK |

**92 % of that value is one item**: contract 35876177, *"Rámcová smlouva o financování
projektu spolufinancovaného z fondů EU — Modernizace zabezpečovacího zařízení vlečky
Lovochemie, a.s."*, SFDI × Lovochemie. What it actually is, after reading the document
and its attachments:

- **Public money toward an AGROFERT-group company** — the only row in the 23 carrying an
  explicit role label: SFDI = poskytovatel, Lovochemie = **příjemce**.
- **A maximum EU ceiling, not a payment**: 181 454 606,76 Kč = 49 % of eligible costs of
  370 315 524 Kč, from the Fond soudržnosti. Lovochemie funds ≥51 % itself.
- **Concluded 2025-12-01**, published 2025-12-03 — both **before** 2025-12-09.
- **Not discretionary**: awarded in the *kolová* call č. 35 of Programu Doprava
  2021–2027, applications 2025-01-13 → **2025-06-30**, i.e. the round closed months
  before the shareholding was registered. Notified state aid SA.101579.
- **Paid ex post** against approved progress reports, eligibility running to 2028-12-31 —
  so disbursement does fall after 2025-12-09, even though the award does not.

## 3. What the verification pass corrected

The pass returned **PARTIAL**. The numbers reproduced to the koruna; the framing did not.

1. **A premise was refuted.** `party_idnum` does **not** match either contracting party —
   it matches only the **non-publishing** party (`subject_idnum` is the publisher side).
   Decisive test: `party_idnum=70856508` (SFDI) for 2025-12-03 returns zero rows while
   `subject_idnum` for the same day returns the contract. Consequence here is one record,
   but the claim had been written into the client, three scripts, the onboarding doc and
   a memory entry — **all corrected**, with the correction and its test recorded so it
   cannot be re-asserted untested.
2. **Direction of money is not in the search row at all.** Only a minority of contracts
   carry a `Plátce / příjemce` label, and only on the detail page. Of the 16 records in
   the member-of-government period, **none is evidenced as public money awarded to the
   group** — and the one whose direction was verified runs the *other way*: Kostelecké
   uzeniny **pays** the Vězeňská služba for prisoner labour, at a rate mechanically
   derived from 50 % of the minimum wage. Reporting "9 355 026 CZK in the PM period"
   without that would have implied the opposite of what the evidence shows.
3. **A date error**: the 5 881 200 CZK Bělušice item is dated 2025-12-08, one day *before*
   the appointment — I had described the PM-period total as dominated by two items when
   one of them falls outside it.
4. **"197 261 535 CZK" is not comparable money** — it mixes bez-DPH and s-DPH, includes
   7 rows with no stated value, and is 92 % a multi-year maximum ceiling.
5. **I was too timid at one end.** SZIF's own published analysis (PORTOS, 2026-02-27)
   states the shares were placed into RSVP TRUST on 2026-02-20 and that **"nejméně v
   období od 9. prosince 2025 do 20. února 2026"** the § 4c conditions were met for the
   group. That is the state paying agency's stated position — not our inference — and it
   converts the closing date from "registry výmaz" to an actual transfer. The opening
   date remains registration-only.

## 4. Legal framing — recorded as unsettled, deliberately

- **§ 4b** concerns participation in *zadávací řízení*. It does not reach the SFDI
  financing contract at all.
- **§ 4c** forbids *poskytnutí dotace*. Whether SFDI financing co-financed from the Fond
  soudržnosti is a "dotace" under it is **genuinely contested** (§ 3 písm. a) zák.
  218/2000 reaches Národní fond money; § 3 písm. c) classes státní fond money separately),
  and no court has ruled on SFDI/OPD financing under § 4c.
- **When it bites** is also unsettled: SZIF's own opinion argues the decisive moment is
  the conclusion of the agreement (which here precedes the appointment), while NSS
  1 Afs 172/2024 and 10 Afs 157/2024 hold eligibility must persist throughout
  administration.
- The ≥25 % control test **does** read through trust structures and **does** reach
  subsidiaries.

**Nothing here is a finding of illegality, and nothing here exonerates.** The loop records
what the registers establish and marks the rest unsettled.

## 5. The blind spot that bounds all of it

Registr smluv carries no subsidy granted **by decision** — and SZIF *decides*, it does not
contract (§ 1 odst. 2 písm. a) zák. 256/2000 Sb.). Agricultural and CAP support, which is
where this group's public money is largest, never enters the register. Add the statutory
exemptions (≤50 000 Kč; ordinary-course contracts of majority state-owned companies;
explosives — directly relevant to the eight valueless Synthesia↔Explosia rows) and the
2016-07-01 start, and **624 records across 9 of the group's many companies is a lower
bound on one partial channel**. Magnitude of the subsidy channel: **UNVERIFIED** — SZIF's
beneficiary search and cedr.mfcr.cz were both unreachable.

## 6. Live writes (pass 40)

| write | scope | result |
|---|---|---|
| Q-money-21 window corroboration | 1 `linked_to` props-merge (Babiš ↔ AGROFERT) | applied, with the SZIF corroboration, the contract findings, the direction caveat and the blind spot |

**No `review_state` touched — 211 ties remain `pending_review`.**

## 7. Open items for batch 012

1. **Re-ingest contracts without the 25-cap.** This is now the highest-value work in the
   case: it lifts every CZK figure from floor to actual and retires the caveat added in §1.
   The client and the sweep pattern already exist.
2. **Read direction on the remaining 22 window rows** (and on the batch-009 parent leads)
   from the detail documents. Direction is per-contract and cannot be inferred.
3. **The subsidy channel is the real question for this group** and Registr smluv cannot
   answer it. Assess whether SZIF's beneficiary lists or cedr.mfcr.cz are ingestible.
4. `subject_idnum` sweeps for any company that is itself a publishing authority — the
   `party_idnum`-only sweeps miss those.
5. Finish the steward class (23) + Teplárny Brno + ČSOB + České dráhy, all still
   UNMEASURED.
6. Q-money-13's 21 residue items remain with law (14) and effort (7).

## 8. Lessons

1. **A number's provenance includes its completeness.** "Σ hodnot smluv" was true of what
   we had and false about what it implied. The brand rule is not only "cite the source" —
   it is "do not let a floor read as a total". A coverage flag computed *from the data* is
   the durable form of that, because it cannot go stale.
2. **The verification pass earned its keep again, on a deflationary result.** The trigger
   exists for money-touching claims about named people, and the instinct is to fire it on
   accusatory findings — but here it prevented an *implied* accusation (a big CZK number
   in the PM window whose only verified item ran the other way). Deflationary results need
   the same scrutiny as damning ones.
3. **An untested premise propagates at the speed of copy-paste.** "matches EITHER party"
   was asserted once in batch 009, never tested, and by batch 011 sat in the client, three
   scripts, the onboarding doc and a memory entry. Assertions about a source's semantics
   should carry the test that established them, or be marked untested.
