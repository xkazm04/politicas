# Cluster: theme-grain rebellion / budget defection — PSP10

Per-cluster note for [[frontier]] **F16** (pass 5, 2026-07-23). **Fully deterministic**
— fuses *three* prior layers: `rebels_against` (pass 1, club majority) + `about`/themes
(pass 3) + contestedness (pass 4, `opposed_fraction`). No LLM; trusted by construction.
The graph write enriches `person` nodes (nested pass-5 deterministic provenance;
identity provenance unchanged). See [[graph-log]], [[cluster-bloc-theme]].

**Two lenses.** *Club rebellion by theme* = voted against the MP's club majority on a
themed vote; **`contested_rebellion_score`** = Σ(rebellions × theme `opposed_fraction`)
— a *meaningful* independence measure. *Budget bloc-defection* = voted against the MP's
**bloc** majority on `theme:fiscal-budget` votes (crossing the aisle on the sharpest
battleground). Totals: 1 774 themed votes scored · 1 199 club-rebellion events · 440
budget bloc-defection events.

## Finding 1 — rebellion concentrates where it is *cheap* (validates O8)

The top *raw* rebel (pass 1) Vladimír Pikora (MS) rebels **87×** — but almost entirely on
**state honours** (`opposed_fraction` 0.215; effectively free votes). Weighting by
contestedness reorders the "most independent" MPs:

| MP | club | contested score | top rebellion theme |
|---|---|---|---|
| Ondřej Babka | ANO2011 | 26.6 | housing-construction ×22 |
| Karel Haas | ODS | 21.1 | parliamentary-procedure ×15 |
| Vladimír Pikora | MS | 20.4 | **state-honours ×87** (low-stakes) |
| Jan Bureš | ODS | 20.0 | parliamentary-procedure ×10 |

**Raw rebellion overstates substantive independence.** Pikora's high pass-1 rate (0.082)
is mostly symbolic; Babka/Haas break on *contested* themes. This is precisely the O8
proposal — CivicScore's Independence pillar should weight rebellion by theme contestedness.

## Finding 2 — ODS is its bloc's fiscal outlier (answers F8; corroborates pass-2 P3)

The **budget bloc-defectors** — MPs voting against their *bloc* majority on fiscal-budget
votes — are overwhelmingly **ODS**: Haas 20, Bureš 11, Sokol 11, Adamec 9, Bendl 8,
Decroix 7, Slovák 7, Černochová 7. Critically their *club*-rebellion is near zero (Haas 1,
Adamec 0, Bendl 1): **they vote loyally with ODS, and ODS-the-club diverges from the rest
of its coalition bloc on the budget.** That directly **answers [[frontier]] F8** ("is ODS a
sub-bloc?") and corroborates [[cluster-blocs]] P3 (ODS = weakest-integrated bloc member) —
now localised to the *fiscal* dimension. A pass-2 question closed by a pass-5 computation.

Bloc-A crossers exist but are more *individual* (higher club-rebellion): Boris Šťastný
(MS, club 5/bloc 6), Matěj Gregor (MS), Patrik Nacher (ANO), Jan Hrnčíř (SPD).

## Caveat (honest)

On low-contestedness **free-vote themes** (honours), "rebellion vs club majority"
overstates dissent — there is no whip to rebel against. The contestedness weighting
correctly discounts it; raw counts on such themes should not be read as party defiance.
