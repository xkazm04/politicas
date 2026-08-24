# no-hardcoded-display-string

**Doctrine rule.** Human-language display text does not get typed into markup.
Copy goes through the message catalog.

## Why

The catalog is only an authority if display strings actually pass through it,
and nothing about writing code pushes them there. Typing Czech straight into
JSX is faster, renders correctly for the author, and survives review by
reviewers who read Czech. Extraction discipline therefore cannot be cultural —
it has to be mechanical.

politicas has an excellent catalog half: **2854/2854 cs/en keys, 0 missing /
0 extra**, enforced by 14+ colocated `features/*/messages.test.ts` suites that
run in CI. What it did not have was a door: nothing stopped the next author
bypassing the catalog entirely, which is the failure mode the standard says
culture cannot hold.

## The population was read before the pattern was written

Measured 2026-08-24 over **220 `.tsx` files** under `app/`, `features/` and
`components/`, with a TypeScript-compiler scanner written *separately* from
this rule so the two mechanisms could be cross-checked:

| shape | raw candidates |
| --- | --- |
| JSX text nodes | 856 |
| string literals in JSX child position | 421 |
| literals in consumed attributes | 30 |
| `label:`-shaped constant-table entries | 63 |

A naive "JSX text containing a letter" matcher returns 484 hits. Its tail is
**entirely technical** — 95× `·`, route breadcrumbs (`/ penize / firma`), brand
(`Politicas`), and domain tokens (`IČO` ×7, `Sb.` ×9, `č.` ×8, `psp.cz`, `RSS`,
`JSON`, `e-Sbírka`, `manifest.json`, `co_votes_with`, `fnv-1a/32`). Not one of
those 86 tail hits is a display-copy gap.

## The threshold, and why it is exactly three

A candidate is flagged only when it carries **three or more whitespace-
separated tokens containing a letter**:

| threshold | hits | false positives outside declared zones |
| --- | --- | --- |
| ≥ 1 word | 484 | 86 |
| ≥ 2 words | 287 | 9 (all route breadcrumbs) |
| **≥ 3 words** | **227** | **1** |
| ≥ 4 words | 158 | 0, but loses 69 true positives |

The single false positive at ≥ 3 was a `<style>{`@media print {…}`}</style>`
block (`features/money/EvidencePacketPage.tsx:47`) — CSS, not copy — so
`<style>` and `<script>` children are excluded by element name. **Shipped
precision: 226/226 = 100 %**, every hit hand-checked.

Recall is knowingly traded for that, and the gap is a recorded decision, not a
surprise: one- and two-word display strings (`Uložit`, `Zrušit`) are **not**
caught, and neither is text built at runtime, fetched from a server, or
laundered through a variable. The detector is a floor, not the test. The
end-to-end check is a pseudo-locale sweep — every unmarked string on screen is
an extraction gap whatever lint said.

## When it fires

1. **JSX text nodes**, outside `<style>`/`<script>`.
2. **String literals in JSX child position** through an expression container:
   `{"text"}`, `{cond ? "…" : "…"}`, `{value || "…"}`. This is the obvious
   launder of trigger 1, and the scan found 27 live instances, so it is not
   hypothetical.
3. **String literals in the attributes users actually consume**:
   `placeholder`, `title`, `alt`, `aria-label`, `aria-description`,
   `aria-placeholder`, `aria-roledescription`, `aria-valuetext`, and this
   repo's own `label` prop convention.

## What it deliberately does not flag: constant tables

The governing standard names display strings smuggled into constant tables
(`{ id: 'active', label: 'Active' }`) as a target. It was **measured here and
refused, with the numbers on the table.**

A `label:`/`text:`/`name:`/`title:`/`description:` key heuristic returns 63
assignments in this tree, of which **9 are CSS class names**
(`text: "text-cobalt"`), **6 are font families** (`name: "Archivo"`), and the
rest are paper sizes (`"A4"`), source brands (`"ARES VR"`) and domains
(`"psp.cz"`). Applying the three-word threshold to them leaves **zero hits
outside the declared zones** — the defect class does not exist here, while the
key anchor is demonstrably polluted. A rule with no live population and a noisy
anchor is a gate that can only ever cost trust.

Re-open it if a constant table with real copy ever lands.

## Escape hatch

`// i18n-ok: <reason>` on the flagged line or the line above, in the house
style of `// citation-ok:` and `// raw-format-ok:`:

```tsx
<span>/ penize / firma / detail</span> {/* i18n-ok: route breadcrumb, not copy */}
```

The annotation counts when it **ends** on the flagged line or the line above,
so a multi-line reason works. A bare `eslint-disable` is not an audit trail;
the reason is the point.

## Declared exemption zones (politicas)

Zone exemptions live in `eslint.config.mjs`, never inline, and each states what
it does **not** exempt — every exemption is a hole the next hardcoded string
will claim to fit.

| zone | hits | why | what it does NOT exempt |
| --- | --- | --- | --- |
| `app/global-error.tsx` | 10 | renders **outside** `NextIntlClientProvider` (the root layout is gone by definition), so `useTranslations` is unreachable; the copy is deliberately, statically bilingual | `app/error.tsx`, which is inside the providers and is catalog-translated, and every other route under `app/` |
| `features/labs/**` | 25 | the archived fixed-art-direction zone, already exempt from `no-hardcoded-colors`, `require-source-citation` and `no-raw-number-display` for the same reason: not reader-facing product | anything under any other feature |
| `features/admin/**`, `app/admin/**`, `features/money/components/VerificationConsole.tsx` | 140 | internal operator consoles — one shared token (`ADMIN_TOKEN` / `REVIEWER_TOKEN`), one operator, `robots: { index: false }` on both trees. Their audience is not the reader, which is the standard's own exemption criterion | the rest of `features/money/**`; and *not* the consoles' page metadata, which already comes from the catalog (`meta.kontrolaTitle`) |

## The backlog, at `warn` and named

Two **reader-facing** surfaces carry a real extraction backlog and are held at
`warn` — visible at the authoring rung, unable to fail a gate, counted:

| file | strings |
| --- | --- |
| `features/landing/referendum/ReferendumPage.tsx` | 33 (30 text + 3 `title`) |
| `features/lawwatch/components/DependencyRadar.tsx` | 18 |

Both files carry a written, dated in-file decision to stay inline, and
`DependencyRadar` records an incident: a prior conversion to `useTranslations`
against keys that were never added rendered the whole section as
`MISSING_MESSAGE` in **both** locales, and was reverted rather than backfilled.
That is a product position held by their owner, recorded here as the open
disagreement it is rather than overridden — and `warn`, not `off`, because
turning a rule off converts a visible defect class into an invisible one.

The exit is fix-as-you-touch: these two files only shrink, and each one that
reaches zero moves to `error` in the same change. Recompute with:

```
npx eslint features app components --format json
```

## Severity

`error` under `features/**/*.tsx`, `app/**/*.tsx` and `components/**/*.tsx`,
where the measured inventory is **zero**. `warn` on the two backlog files
above; `off` on the declared zones.

Note that `warn` enforces nothing here by construction: `npm run lint` sets no
`--max-warnings`, so no advisory count can fail any gate. It buys the editor
squiggle and the commit-rung display, which is a real product — just a
different one from enforcement.

## Adoption mapping

Generic in mechanism, project-scoped in configuration. To adopt:

1. Point the fix path at your catalog in the message strings.
2. Re-measure the threshold against **your** tree — three words is calibrated
   to Czech-first copy with heavy domain abbreviation, and your tail will
   differ.
3. Declare your exemption zones in config with reasons, and write down what
   each one does not exempt.

Ships in `recommended` at `warn` (the fix path names a project convention) and
in `strict` at `error`.
