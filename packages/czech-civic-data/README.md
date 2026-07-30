# czech-civic-data

**CZ** · Jak správně číst česká občanská otevřená data. Normalizační vrstva
projektu [politicas](../../README.md) vytažená jako samostatný balíček:
escape-korektní parser formátu UNL (Informix UNLOAD, publikuje psp.cz),
striktní dekodér windows-1250, ZIP čtečka bez závislostí s ochranou proti
zip-bombám, převod české diakritiky na ASCII pro indexování a **zdokumentované
slovníky hlasovacích kódů psp.cz** — včetně zrádného kódu `K`, který od roku
1995 slučuje „zdržel se" a „nehlasoval".

**EN** · How to read Czech civic open data correctly. The normalization layer
of [politicas](../../README.md) extracted as a standalone package: an
escape-correct parser for the UNL format (Informix UNLOAD, as published by
psp.cz), a strict windows-1250 decoder, a dependency-free zip-bomb-capped ZIP
reader, Czech-diacritics-to-ASCII folding for indexing, and the **documented
psp.cz vote-code vocabularies** — including the treacherous `K` code that has
merged "abstained" and "did not vote" since 1995.

- Zero runtime dependencies / žádné běhové závislosti (Node builtins only:
  `node:zlib`; `TextDecoder` for cp1250).
- Pure functions over bytes and strings — no IO, no framework.
- Doctrine: **missing beats wrong / chybějící je lepší než špatné.** Every
  parser returns `null` or throws a named error instead of guessing.

## Status / stav

In-repo package consumed by politicas via re-export shims
(`lib/ingest/{normalize,unl,zip}.ts`). Not yet published to a registry;
licence for the *code* is decided at publish time. Note the *data* licences of
each source below — psp.cz requires citing the Chamber as the source.

## API

Everything is exported from the package root (`src/index.ts`); the three
modules can also be imported individually.

### `unl` — Informix UNLOAD parsing (psp.cz bulk dumps)

| export | what it does |
| --- | --- |
| `parseUnl(body)` / `parseUnlLine(line)` | Escape-aware split: `\|` inside a value is a literal pipe (vote titles DO contain pipes), `\\` a backslash, `\n`/`\r`/`\t` controls; empty column → SQL `NULL` → `null`. Splits physical newlines FIRST, then unescapes, so an escaped `\n` survives. |
| `decodeUnl(bytes)` | windows-1250 → string with `fatal: true`: an unmappable byte (corrupt download, wrong encoding) **throws** instead of silently writing U+FFFD into a name. |
| `col(row, i)` / `colInt(row, i)` | Null-safe column access. `colInt` requires the FULL trimmed value to be digits — `"123abc"` is `null`, never `123`. |
| `czDateToIso` / `czDateHourToIso` / `czDateTimeToIso` | `DD.MM.YYYY`, `datetime(year to hour)`, and date+`HH:MM` → ISO. Range-validated; malformed input → `null`, never a guess. |

### `normalize` — folding, sentinels, vote vocabularies

| export | what it does |
| --- | --- |
| `asciiFold(s)` | Lowercase ASCII fold for `*_norm` index columns ("Nováková" → "novakova"). Explicit table, because `ď/ť/ľ/đ/ø` do not NFD-decompose. Fold at INGEST time and index the folded column; never fold at query time. |
| `fullName(first, last)` | Display-order join, dropping empties. |
| `readBirthDate(iso)` / `BIRTH_DATE_UNKNOWN_SENTINEL` | psp.cz writes `1900-01-01` for "birth date unknown" — detected and returned as `{ date: null, unknown: true }`, not a phantom 126-year-old MP. |
| `voteChoice(code)` → `VoteChoice` | `hl_poslanec.vysledek` → stable vocabulary (table below). |
| `voteOutcome(code)` / `voteKind(code)` | `hl_hlasovani.vysledek` / `druh_hlasovani` vocabularies. |
| `PRESENT_CHOICES` / `POSITIONAL_CHOICES` | The two counting bases: "at the desk" (attendance) vs "expressed yes/no" (party-line math). |
| `termCode(abbrev, organId)` | `PSP10` term codes with a loud `ORGAN<id>` fallback. |

#### The vote-code table (psp.cz schema page k=1302)

| code | meaning (CZ) | `voteChoice` |
| --- | --- | --- |
| `A` | ano | `yes` |
| `B` / `N` | ne | `no` |
| `C` | zdržel se (stiskl X) | `abstain` |
| `F` | nehlasoval (přihlášen, nestiskl nic) | `not_voting` |
| `K` | zdržel se / nehlasoval — **sloučeno** | `abstain_or_not_voting` |
| `@` | nepřihlášen | `not_logged_in` |
| `M` | omluven | `excused` |
| `W` | hlasování před slibem poslance | `pre_oath` |
| *other* | — | `unknown` |

**The `K` footgun / zrádný kód `K`:** since the 1995 amendment of the rules of
procedure (90/1995 Sb.) the Chamber itself stops distinguishing "abstained"
from "did not press", so a modern term contains `K` and never `C`/`F`. Any
metric that needs the two separately **cannot be computed for post-1995
terms**. Say so in your product; do not split the number. That is why
`abstain_or_not_voting` is a first-class vocabulary member and why
`POSITIONAL_CHOICES` contains only `yes`/`no`.

### `zip` — dependency-free bulk-dump reader

`readZip(bytes)` / `readZipMap(bytes)` (keyed by lower-cased basename).
Deliberately minimal — stored + deflate only, single-disk, with a 512 MiB
inflate cap per member. ZIP64, encryption, other methods, truncated entries
and bad signatures are **rejected with named errors** rather than silently
mis-read: fewer moving parts to trust in a civic-data supply chain.

## Per-source examples / příklady podle zdroje

### 1. PSP (psp.cz UNL dumps) — roll-call votes, MPs, terms

The dumps at `https://www.psp.cz/sqw/hp.sqw?k=1300` are ZIPs of windows-1250
UNL members. This is the package's home turf — the full pipeline:

```ts
import {
  readZipMap, decodeUnl, parseUnl, col, colInt, czDateToIso,
  voteChoice, voteOutcome, termCode, readBirthDate, asciiFold, fullName,
} from "czech-civic-data";

const zip = await fetch("https://www.psp.cz/eknih/cdrom/opendata/poslanci.zip");
const members = readZipMap(new Uint8Array(await zip.arrayBuffer()));

// osoby.unl: id|...|surname|firstName|...|birthDate|...
for (const row of parseUnl(decodeUnl(members.get("osoby.unl")!))) {
  const id = colInt(row, 0);
  const name = fullName(col(row, 3), col(row, 2));
  const birth = readBirthDate(czDateToIso(col(row, 5))); // 1900-01-01 → unknown
  const nameNorm = asciiFold(name); // "Nováková" → "novakova" for the index
}

// hl_poslanec.unl per-MP ballots — NEVER split the merged K bucket:
const choice = voteChoice(col(ballotRow, 2)); // "K" → "abstain_or_not_voting"
```

Licence: reuse permitted, **citation of the Chamber (psp.cz) as the source is
required**. / Licence: užití dovoleno, **s povinným uvedením zdroje psp.cz**.

### 2. Dataor (dataor.justice.cz) — commercial-register bulk export

JSON, not UNL — the package's job here is identity matching: officer names
from the Ministry's ISVR archive against your own roster, diacritics- and
case-insensitively.

```ts
import { asciiFold } from "czech-civic-data";

// "MUDr. Řehoř ČÍŽEK" (dataor) vs "Řehoř Čížek" (roster):
const officerNorm = asciiFold(stripTitles(officer.name)); // "rehor cizek"
const isSameName = officerNorm === asciiFold(rosterPerson.name);
// dataor birth dates are GDPR-sensitive: use them ONLY as matching keys
// against your own record, never as displayed content (politicas doctrine).
```

Licence: non-commercial reuse; the recipient of officer personal data becomes
a GDPR controller — fold names, don't republish birth dates.

### 3. Kiosek (kiosek.justice.cz) — official notice boards (JSON-LD)

OFN "Úřední deska" postings name courts and natural persons with full Czech
diacritics and inconsistent casing; folding both sides makes the join to a
roster or court registry robust:

```ts
import { asciiFold } from "czech-civic-data";

const courtNorm = asciiFold(posting.provozovatel.název); // "Okresní soud v Chebu"
const court = courtIndex.get(courtNorm);                  // index built with asciiFold too
```

Postings are not append-only (they vanish after `relevantní_do`) — that is a
feed-cadence concern for your adapter, not for this package; the package's
guarantee is only that the text you key on is folded deterministically.

## Testing / testy

```
cd packages/czech-civic-data
npm test        # runs the package suite standalone (uses the repo root's vitest)
npm run typecheck
```

The same files also run inside the politicas root suite (`npm test` at the
repo root), and `lib/ingest/shims.test.ts` there pins the shim surface to this
package's exports — the two can never drift apart silently.

## Ecosystem / ekosystém

Part of the politicas transparency toolchain — see also
[`eslint-plugin-civic-transparency`](../eslint-plugin-civic-transparency/)
(the provenance lint doctrine as a shippable plugin) and the public faces of
the same story: the politicas `/data` page (what is ingested, under which
licence) and `/atlas` (published per-source data-quality scores).
