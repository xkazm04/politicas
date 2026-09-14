# English copy style (messages/en.json)

The house delta over the registry's `english` subject (localization bundle). Rules are cited by
ID and never restated; the subject is the rule, this file is the delta. Contract:
`docs/i18n/copy-contract.json`. Checker: `npm run copy:check` (native-copy skill).

## English is derived here

Czech is the source locale (`lib/i18n/config.ts` `defaultLocale: "cs"`); `messages/en.json` is a
translated target. **EN-FIDELITY applies first**: check meaning against `messages/cs.json` before
polishing fluency, then the de-translationese and interference rules (EN-ARTICLE, EN-ORDER,
EN-FALSE-FRIEND, EN-SOURCE-RESIDUE). Fix a meaning error in the Czech source, not only in English.
`messages/cs.json` is out of scope for this gate: Czech typography accepts the long dash (registry
`czech` subject), so nothing below applies to it.

## Declared mechanics

| mechanic | declared | rule | count at adoption (2026-09-14) |
| --- | --- | --- | --- |
| variant | US | EN-SPELLING | UK 31, US 16 (mixed, UK-leaning) - UK forms are baselined debt |
| em dash | banned | EN-DASH | 875 em dashes in 829 strings - all baselined debt |
| spaced hyphen as dash | warn | EN-DASH | 8 (all in `metodika.*`) |
| double quotes | curly | EN-QUOTES | curly 180, straight 14 |
| ellipsis | character | EN-ELLIPSIS | char 34, dots 0 |
| heading/button case | sentence | EN-CASE | 20 of 221 judgeable headings Title Case (9%), no deliberate class |

Heading class includes `kicker` keys (eyebrow-class here); button class includes `cta<Suffix>`.
Section names that are proper names (Journal of the Republic, Civic Inbox, Open Data Quality Atlas,
Testimony of the Numbers, Evidence Journal) and named Acts are in `terms.accept`. Numbers take no
space before `%` and English quotes, never `„ “` (EN-SOURCE-RESIDUE; 5 baselined).

## House rulings

- **2026-09-14 - US English** (operator, fleet-wide). Replace UK forms when a string is touched.
- **2026-09-14 - em dash banned in English product copy** (operator, fleet-wide). Use a colon,
  comma, parentheses or a full stop by sense (EN-DASH). Title separators become `Poster | Politicas`
  or a colon. A standalone no-data glyph (a string with no letters) is not copy and is not checked.
  **Supersedes for English** the 2026-07 rejection of the impeccable `em-dash-overuse` advisory
  (`docs/design/impeccable-pass-01.md`); that rejection reasoned from Czech typography and still
  stands for Czech UI.
- **2026-09-14 - sentence case** for headings, titles and buttons (EN-CASE). Title Case survives
  only in proper names listed in `terms.accept`.

## Gate and escape hatch

- `lefthook.yml` `pre-push` job `copy-check` runs the full catalog against `.ai/copy-baseline.json`;
  new error findings block, warnings print. It skips loudly when the gitignored skill link is
  absent (fresh clone, CI): run `ai-registry/scripts/link-registry.mjs`. Not part of `npm run
  check`, which mirrors CI.
- A deliberate exception is made visible, never bypassed: re-baseline in its own commit whose
  message says why (`node .claude/skills/native-copy/scripts/copy-check.mjs --baseline write`), or
  turn a rule `off` in the contract with the reason recorded here. Agents never use `--no-verify`
  or `LEFTHOOK=0` to pass this gate.
- Baseline at adoption: 889 fingerprints covering 865 error findings (EN-DASH 829, EN-SPELLING 31,
  EN-SOURCE-RESIDUE 5) and 26 warnings. Drain debt by fixing strings, then re-write the baseline
  to tighten the ratchet.
