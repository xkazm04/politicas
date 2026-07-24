# Cluster: per-vote contestedness — blocs & independence (F3/F7)

Pass 12, 2026-07-23. **Fully deterministic.** Introduces a per-vote **contestedness
(margin)** measure — `contestedness(vote) = 1 − |yes−no|/(yes+no)` chamber-wide, 0 =
unanimous → 1 = even split — and uses it for two long-open items. 2 013 non-voided votes;
**1 057 (52.5%) are contested** (c ≥ 0.5, i.e. the losing side had ≥ 25%). Enriches person +
bloc nodes. See [[graph-log]], [[cluster-blocs]], [[cluster-theme-rebellion]].

## F7 — the blocs are REAL, not a lopsided-vote artifact (the knockout test)

Restricting to the 1 057 close votes:

| measure | all votes | contested only |
|---|---|---|
| **bloc opposition rate** (A-maj ≠ B-maj) | 0.62 | **0.998** |
| intra-bloc cohesion — bloc A (ANO-SPD-MS) | 0.976 | 0.989 |
| intra-bloc cohesion — bloc B (ODS-STAN-Piráti-KDU-TOP09) | 0.924 | 0.945 |

**When a vote is actually close, the two blocs oppose each other 99.8% of the time** — and each
bloc is *more* internally cohesive than on the average vote. The earlier 0.62 overall opposition
was diluted by lopsided/consensual votes (procedure setup, honours, treaties); strip those out and
the two-bloc structure is near-perfect. This is the definitive answer to "are the blocs a genuine
party system or a statistical artifact?" — **genuine, and sharpest exactly when it matters.**

## F3 — the CivicScore Independence pillar, finalized

Weighting each MP's rebellion by the **contestedness of the vote** (`contested_vote_rebellion =
Σ contestedness over rebellion events`) gives the substantive-independence ranking:

| MP | club | score | rebellions |
|---|---|---|---|
| Ondřej Babka | ANO2011 | 21.8 | 45 |
| Karel Haas | ODS | 21.4 | 32 |
| Jan Bureš | ODS | 14.9 | 33 |
| Petr Sokol | ODS | 12.7 | 20 |
| Patrik Nacher | ANO2011 | 11.8 | 22 |

**Vladimír Pikora — the raw-rebellion #1 — drops out of the top 12 entirely.** His 87 rebellions
were on low-contestedness state-honours free votes; weighting by per-vote margin demotes him, just
as the O1/O8 hypothesis predicted. Three independent measures now agree on the correction: raw
rebellion (pass 1) → theme-contestedness weighted (pass 5) → **per-vote-margin weighted (pass 12)**,
each pushing free-vote rebels down and genuine cross-pressure MPs (Babka, Haas) up.

**Pillar proposal (O1/O8, now concrete):** CivicScore Independence = a function of
`contested_vote_rebellion` (person-node prop), NOT raw rebellion rate — grounded, computed, and
demonstrably better-ordered. The bloc nodes carry `opposition_rate_contested` (0.998) for the
VoteTrack bloc view.
