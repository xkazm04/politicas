# `ai-manifest` — specification

**Status:** vendored into this repository, 2026-08-24. `schemaVersion: 0.1.0`.
**Artifact this describes:** [`.ai/manifest.yaml`](../.ai/manifest.yaml).

## Why this document exists in this repository

`.ai/manifest.yaml` used to cite its own specification as
`docs/AI_MANIFEST_SPEC.md` plus an absolute path into a sibling checkout on one
particular machine. Neither resolved: the file did not exist here, and the
sibling did not carry it either. So the contract's definition lived nowhere,
which is worse than living somewhere inconvenient — an auditor reading this
repository from a fresh clone, offline, had no way to learn what any field
meant.

The rule that fixes it is that **the specification travels inside the adopting
repository**: the manifest's pointer to its spec resolves relative to the
repository root, in a fresh clone, with no network. That is the whole
requirement. This file is that copy, and because the source of truth for this
contract is now this document — in this repository — there is no second
authority and nothing to drift against.

## The reimplementation clause

> Any reader that performs the checks this document describes is conformant.
> Any writer that produces a file satisfying this document produces a valid
> manifest. The tooling in this repository is tooling, not the definition.

If a question about the manifest cannot be answered from this document, that is
a hole in this document, not a detail to look up in a script.

## Format

A manifest is a single YAML 1.2 mapping at `.ai/manifest.yaml`, UTF-8, at the
repository root under `.ai/`. Comments are not part of the contract but are
expected: this file's own comments carry the reasoning that the field names
cannot.

## The one rule that makes the contract survive

> **A reader MUST ignore fields it does not recognize.**

Not "may" — MUST. This is what lets the schema grow without a coordinated
upgrade of every reader, and it is the reason the version below can stay at
`0.x` without churn. A reader that errors on an unknown key converts every
additive change into a breaking one.

## Fields

### `schema` (required, string)

Constant `ai-manifest`. Identifies the *kind* of document. A reader MUST refuse
a file whose `schema` is anything else, rather than guessing.

### `schemaVersion` (required, string, semver)

The version of **this specification** that the file claims to satisfy —
deliberately separate from `schema` so the kind and the revision are not one
overloaded token.

Evolution is additive: within a major version, new optional fields may appear
and existing fields MUST NOT change meaning. A reader compares the major
component; a higher minor or patch than it knows is not an error, because of the
must-ignore-unknown rule above. Removing a field, or changing what an existing
field means, requires a major bump.

### `generatedAt` (optional, string, `YYYY-MM-DD`) and `generatedFrom` (optional, list of paths)

Provenance. `generatedFrom` names the files the manifest's content was derived
from — for this repository, `package.json`, `CLAUDE.md`, `AGENTS.md`. Their
purpose is to make staleness answerable: a manifest whose `generatedFrom` files
have moved on is a manifest under suspicion.

A manifest is allowed to be hand-written. It is not allowed to *claim* a
derivation it does not have.

### `repo` (required, mapping)

| key | type | meaning |
|---|---|---|
| `name` | string | the repository's own name |
| `purpose` | string | one sentence, what the repository is for — written for a reader who has never seen it |
| `languages` | list of strings | the implementation languages, lowercase |
| `archetype` | string | one of `product`, `library`, `service`, `tool`, `dataset` |

### `capabilities` (required, mapping)

The heart of the contract, and the field most often written wrong.

**Capabilities are named by what they DO, not by the tool that does them.** The
key is a capability name (`test`, `lint`, `typecheck`, `build`, `gate`,
`smoke`, …); the value is a mapping:

| key | type | meaning |
|---|---|---|
| `command` | string, required | a shell command that fulfils the capability from the repository root |
| `verified` | boolean, required | whether something has actually RUN this command and seen it work |

The vocabulary rule exists because a reader must not need to know that this
repository uses Vitest rather than Jest, or Next rather than Vite, to run its
tests. `test: { command: "npm run test" }` survives replacing the runner;
`vitest: { ... }` does not.

Two consequences, both enforceable:

- **Every `command` MUST be executable as written from the repository root.**
  In this repository every command is a real `scripts` entry in
  `package.json`; naming a script that does not exist, or one that cannot exit
  0, makes the capability a lie.
- **`verified` is a claim, and it starts `false`.** It is flipped to `true`
  only by something that has actually executed the command and observed its
  exit status. A manifest generator MUST NOT write `verified: true` for a
  command it merely transcribed.

### `paths` (required, mapping)

Pointers to heavy subsystems: `contextMap`, `memory`, `memoryIndex`, `design`,
`routeRecords`, `docMap`, `lintRules`, and any others a repository has.

**Pointers, never embeds.** The manifest names *where* the context map lives; it
does not inline it. This is what allows those subsystems to change format
underneath without breaking this contract, and it keeps the manifest small
enough to be read whole.

Every value MUST resolve, relative to the repository root, to a file or
directory that exists. A pointer to a missing path is the same defect as a
capability naming a missing script.

### `context` (optional, mapping)

Free-form guidance for a reader about to make a change. This repository carries
one key, `rule`, stating that every route has a dated detail record under
`docs/routes/` which must be read before that surface is touched.

### `boundaries` (required, mapping)

| key | type | meaning |
|---|---|---|
| `neverTouch` | list of paths | directories a reader MUST NOT write to or delete under any instruction |
| `brandRule` | string | the repository's single load-bearing product invariant, stated in one sentence |

`neverTouch` is the strongest statement in the file. In this repository it names
`.pglite/` (a 1.6 GB live single-writer store), `.next/` and `data/raw/`.

### `controls` (optional, mapping)

Where each capability is **primarily** enforced, as lists of capability names:

| key | meaning |
|---|---|
| `prePush` | what the local push rung runs |
| `ciHardPass` | what the merge pipeline runs and refuses on |

This is the placement matrix in miniature. Its value is that placement becomes
explicit and reviewable — the common failure is not a wrong placement but an
unconsidered one. The binding rung is the last one: a check that appears in
`prePush` and not in `ciHardPass` is a courtesy, not a gate.

### `registry` (optional, mapping) and `knowledge` (optional, mapping)

The organization's knowledge registry this repository consumes: `remote` (a
`github:owner/repo` reference), `local` (a relative path to a checkout, which is
machine state and may be absent), `machine`, `contributor`; and
`knowledge.domains`, the list of knowledge bundles this repository reads.

`local` is the only field in the manifest that is allowed not to resolve —
it names a checkout on one machine, and a reader on another machine MUST treat
its absence as normal rather than as drift.

### `skills` (optional, list of strings)

Shared skills this repository uses from the registry's skills lane. The list is
the reviewable *declaration*; the filesystem link that makes them present is
machine state and is gitignored. A skill not on this list is project-owned and
lives as a real directory under `.claude/skills/`.

## Conformance checks

A conforming checker performs exactly these, and reports each one by name:

1. `schema` equals `ai-manifest`; otherwise refuse the file.
2. `schemaVersion` parses as semver.
3. `repo.name`, `repo.purpose`, `repo.languages`, `repo.archetype` are present
   and non-empty; `repo.archetype` is one of the five listed values.
4. `capabilities` is non-empty, and every entry has a non-empty string
   `command` and a boolean `verified`.
5. Every `capabilities.*.command` of the form `npm run <script>` names a script
   that exists in `package.json`. (A command in another form is out of scope for
   this check and MUST be reported as unchecked rather than as passing — see
   below.)
6. Every `paths.*` value resolves to an existing file or directory, relative to
   the repository root.
7. `boundaries.neverTouch` is a non-empty list, and every entry resolves or is
   documented as gitignored machine state.
8. Every capability name appearing in `controls.prePush` or
   `controls.ciHardPass` exists as a key in `capabilities`.
9. The spec pointer in the file's own header resolves to a file in this
   repository.

**Checked and skipped are different results.** A checker MUST report how many
items it examined and how many it could not, and MUST NOT report an unexamined
item as passing. A check that quietly skips its input and exits 0 is
indistinguishable from a check that ran — which is the failure this
repository's own gate doctrine exists to abolish.

## What this specification does not do

It does not say a manifest must be generated. It does not say which capabilities
a repository must have — a repository with no `smoke` capability simply omits
the key, and a reader must not infer that smoke testing was forgotten. And it
does not describe the shape of any subsystem the `paths` block points at; those
own their own formats, which is the entire point of pointing rather than
embedding.
