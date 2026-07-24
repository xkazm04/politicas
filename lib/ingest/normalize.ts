// Text normalization for the Czech entity graph.
//
// WHY THIS EXISTS: the corpus is Czech, so every human-facing key ("Nováková",
// "Poslanecký klub Starostové a nezávislí") carries diacritics, and search /
// entity-resolution has to match "Novakova" against "Nováková". Postgres solves
// this with the `unaccent` extension — which PGlite does NOT ship. So folding is
// done in application code at INGEST time and persisted into a `*_norm` column
// that carries a plain btree index. Never fold at query time: that defeats the
// index and re-introduces the dependency we are avoiding.

// Czech + Slovak letters, plus the German/Polish neighbours that appear in the
// person registry (naturalized MPs, historical records). Explicit table rather
// than String.normalize("NFD") + strip-combining, because ď/ť/ľ/đ/ø do not
// decompose and would survive the strip.
const FOLD: Record<string, string> = {
  á: "a", à: "a", â: "a", ä: "a", ą: "a", ā: "a", å: "a", ã: "a",
  č: "c", ć: "c", ç: "c",
  ď: "d", đ: "d",
  é: "e", ě: "e", è: "e", ê: "e", ë: "e", ę: "e", ē: "e",
  í: "i", ì: "i", î: "i", ï: "i", ī: "i",
  ĺ: "l", ľ: "l", ł: "l",
  ň: "n", ń: "n", ñ: "n",
  ó: "o", ô: "o", ö: "o", ő: "o", ò: "o", õ: "o", ø: "o",
  ŕ: "r", ř: "r",
  š: "s", ś: "s", ş: "s",
  ť: "t",
  ú: "u", ů: "u", ü: "u", ű: "u", ù: "u", û: "u", ū: "u",
  ý: "y", ÿ: "y",
  ž: "z", ź: "z", ż: "z",
  ß: "ss", æ: "ae", œ: "oe",
};

/**
 * Fold a Czech string to lowercase ASCII for indexing and matching.
 * Non-letter characters are kept as-is; whitespace is collapsed and trimmed.
 * Deterministic and allocation-cheap — it runs once per ingested row.
 */
export function asciiFold(input: string): string {
  const lower = input.toLowerCase();
  let out = "";
  for (const ch of lower) out += FOLD[ch] ?? ch;
  return out.replace(/\s+/g, " ").trim();
}

/** `Ing.` + `Petra` + `Nováková` + `Ph.D.` → "Petra Nováková" (display order). */
export function fullName(firstName: string | null, lastName: string | null): string {
  return [firstName, lastName].filter((p): p is string => !!p && p.trim().length > 0)
    .map((p) => p.trim())
    .join(" ");
}

/**
 * psp.cz writes `1900-01-01` as the "birth date unknown" sentinel (documented on
 * the publisher's own schema page). Surfacing that as a real 1900 birthday would
 * put phantom 126-year-old MPs in the corpus, so it is detected and recorded as
 * a null date + an explicit flag.
 */
export const BIRTH_DATE_UNKNOWN_SENTINEL = "1900-01-01";

export function readBirthDate(iso: string | null): { date: string | null; unknown: boolean } {
  if (!iso) return { date: null, unknown: true };
  if (iso === BIRTH_DATE_UNKNOWN_SENTINEL) return { date: null, unknown: true };
  return { date: iso, unknown: false };
}

/**
 * hl_poslanec.vysledek → a stable, documented choice vocabulary.
 *
 * Codes and meanings are quoted from the publisher's schema page (k=1302):
 *   A  ano                          B / N  ne
 *   C  zdržel se (pressed X)        F      nehlasoval (logged in, pressed nothing)
 *   @  nepřihlášen                  M      omluven
 *   W  vote taken before the MP's oath
 *   K  zdržel se / nehlasoval — MERGED, and the merge is not our doing: since the
 *      1995 amendment of the rules of procedure (90/1995 Sb.) the Chamber itself
 *      stops distinguishing the two, so a modern term contains K and never C/F.
 *      Any product metric that needs "abstained" separately from "did not press"
 *      CANNOT be computed for post-1995 terms. Say so; do not split the number.
 */
export type VoteChoice =
  | "yes"
  | "no"
  | "abstain"
  | "not_voting"
  | "abstain_or_not_voting"
  | "not_logged_in"
  | "excused"
  | "pre_oath"
  | "unknown";

export function voteChoice(code: string | null): VoteChoice {
  switch ((code ?? "").trim().toUpperCase()) {
    case "A":
      return "yes";
    case "B":
    case "N":
      return "no";
    case "C":
      return "abstain";
    case "F":
      return "not_voting";
    case "K":
      return "abstain_or_not_voting";
    case "@":
      return "not_logged_in";
    case "M":
      return "excused";
    case "W":
      return "pre_oath";
    default:
      return "unknown";
  }
}

/** Choices that mean the MP was at the desk and logged in (the attendance base). */
export const PRESENT_CHOICES: ReadonlySet<VoteChoice> = new Set<VoteChoice>([
  "yes",
  "no",
  "abstain",
  "not_voting",
  "abstain_or_not_voting",
]);

/** Choices that express a position the party line can be measured against. */
export const POSITIONAL_CHOICES: ReadonlySet<VoteChoice> = new Set<VoteChoice>(["yes", "no"]);

/** hl_hlasovani.vysledek → outcome vocabulary (publisher schema page k=1302). */
export function voteOutcome(code: string | null): string {
  switch ((code ?? "").trim().toUpperCase()) {
    case "A":
      return "accepted";
    case "R":
      return "rejected";
    case "X":
      return "unknown";
    case "Q":
      return "unknown_non_public";
    case "K":
      return "quorum_not_reached";
    default:
      return "void";
  }
}

/** hl_hlasovani.druh_hlasovani → N normal · R manual (no per-MP ballots) · E technical fault. */
export function voteKind(code: string | null): string {
  switch ((code ?? "").trim().toUpperCase()) {
    case "N":
      return "normal";
    case "R":
      return "manual";
    case "E":
      return "technical_fault";
    default:
      return "unknown";
  }
}

/** `PSP10` from the chamber organ's abbreviation `PSP10`; falls back to the id. */
export function termCode(abbrev: string | null, organId: number): string {
  const a = (abbrev ?? "").trim();
  return /^PSP\d+$/i.test(a) ? a.toUpperCase() : `ORGAN${organId}`;
}
