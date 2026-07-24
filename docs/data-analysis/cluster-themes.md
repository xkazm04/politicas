# Cluster: themes — PSP10

Per-cluster note for [[frontier]] **F2** (pass 3, 2026-07-23). Themes are *named*
by a gated Sonnet subagent over the **179 distinct legislative subjects** the 2 014
non-voided PSP10 roll calls collapse to (many votes repeat on one bill). The
subagent themed the **47 head subjects** (count ≥4 → >90% of titled votes); the
verdict (`.kg-analysis/verdicts/F2.json`) passed the gate against 11 074 known ids
and was promoted at pass 3. Vote counts are the deterministic layer's; the subagent
only grouped subjects into policy domains. See [[graph-log]], [[patterns]], [[graph-schema]].

## Finding — the agenda's thematic shape

13 themes over the 47 head subjects (1 775 roll calls). `about` edge weight = the
subject's roll-call count.

| theme node | votes | note |
|---|---|---|
| `theme:parliamentary-procedure` | **807** | ~40% of the whole chamber — "Pořad schůze" alone is 717 (process churn, not policy) |
| `theme:fiscal-budget` | 276 | FY2026 budget + evidence tržeb — the largest *policy* theme |
| `theme:housing-construction` | 199 | stavební zákon (170) + podpora bydlení |
| `theme:state-honours-symbolic` | 182 | state honours (165) + Landsmannschaft stance |
| `theme:social-health` | 77 | sociální podpora, pojistné, sociální služby, penze |
| `theme:civil-service-public-admin` | 63 | státní zaměstnanci + nominační zákon |
| `theme:public-appointments` | 56 | VZP, Rada ČT, delegace |
| `theme:financial-market-regulation` | 33 | ceny, kapitálový trh, fin. služby |
| `theme:animal-welfare-environment` | 26 | týrání zvířat, obaly, rostlinolékařská péče |
| `theme:government-confidence` | 18 | jmenování vlády + důvěra |
| `theme:oversight-interpellations` | 12 | interpelace + vyšetřovací komise Dozimetr |
| `theme:eu-transposition-digital-transport` | 16 | digitální ekonomika, silniční provoz, komunikace |
| `theme:justice-criminal-law` | 10 | trestní zákoník + trestní řízení |

## Key reads (fed to the frontier)

- **Procedural churn dominates.** ~40% of all roll calls are Chamber self-governance,
  not policy — a strong reason VoteTrack should *separate* procedure from policy (→ O5).
- **`- EU` is a legal basis, not a theme.** The 8 EU-tagged subjects scatter across
  four unrelated policy domains — themed by subject-matter, not by the EU tag (P7).
- **Two dominant legislative pushes:** fiscal-budget (276) and housing-construction
  (199) exceed every other policy theme combined.

## Coverage caveat

47 head subjects (>90% of titled votes) themed; the ~132 long-tail subjects and the
53 untitled votes are **not yet themed** → spawned F13. This pass sampled the head —
stated honestly, not hidden.
