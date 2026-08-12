/**
 * Czech-language gate for reader-facing analyst prose.
 *
 * Politicas is Czech-first (`lang="cs"`). A reader-facing field written in
 * English is a DEFECT, not a stylistic preference — and it is exactly the class
 * of defect an accuracy-only gate never catches, because an English sentence can
 * be perfectly true, perfectly cited and perfectly gated against fabrication.
 *
 * Measured 2026-07-27 (batch 009 presentation gate): **27 of 27** gated
 * `forensic_*` verdicts on `/zakony` were written in English and rendered
 * verbatim to Czech readers — three long prose fields, every `unstatedEffects`
 * entry and every citation `claim`.
 *
 * This module mirrors the `lib/analysis/public-copy.ts` precedent exactly: ONE
 * rule set, imported at BOTH ends —
 *   - **persist time** — `lib/analysis/law-verdict.ts` (`validateLawVerdict`,
 *     `{ requireCzech: true }`) hard-REJECTS a verdict whose reader-facing prose
 *     is English, so a new English verdict can never enter the graph; the law
 *     loop's gate script (`scripts/case-loops/law/gate-verdicts.ts`) runs the
 *     same contract before the orchestrator writes anything live.
 *   - **render time** — `features/lawwatch/getLawData.ts` WITHHOLDS a violating
 *     string, so English prose already in the graph never reaches a reader while
 *     the Czech rewrite is being applied.
 * Render-time withholding is deliberately non-destructive: the English stays in
 * the graph (and, after the rewrite, in the `*_en` sibling props) as the
 * ground-truth source — it simply does not ship.
 *
 * The detection is DETERMINISTIC — no model call. It is a stopword-frequency
 * classifier over two closed word lists, deliberately built from words that
 * exist in ONE of the two languages only, so the ambiguous set (`a`, `to`, `on`,
 * `by`, `do`, `i`, `no`, `so`) is scored for NEITHER side. That matters here
 * because the English originals are dense with Czech legal tokens (`č.
 * 586/1992 Sb.`, `Kč`, `důvodová zpráva`, `sleva na poplatníka`) — a diacritics
 * test or a naive bag-of-words would call them Czech.
 */

/** English function words with no Czech homograph (`a`, `to`, `on`, `by`, `do`, `i`, `no`, `so` are excluded). */
const EN_STOPWORDS = new Set<string>([
  "the", "of", "and", "is", "are", "was", "were", "be", "been", "being", "am",
  "that", "this", "these", "those", "there", "their", "they", "them", "its", "it",
  "with", "from", "for", "which", "who", "whom", "whose", "what", "when", "where", "how", "why",
  "has", "have", "had", "having", "not", "but", "or", "nor", "if", "else",
  "would", "will", "shall", "should", "can", "could", "may", "might", "must",
  "does", "did", "done", "into", "onto", "than", "then", "over", "under", "between",
  "because", "while", "however", "therefore", "thus", "only", "also", "more", "most", "much", "many",
  "such", "all", "any", "some", "other", "another", "both", "each", "every",
  "after", "before", "through", "during", "against", "about", "above", "below", "upon",
  "without", "within", "whether", "though", "although", "since", "until", "unless",
  "here", "very", "just", "even", "still", "already", "rather", "instead", "per",
  "bill", "law", "act", "amendment", "government", "sponsor", "sponsors", "committee", "reading",
  "public", "budget", "state", "effect", "effects", "conflict", "interest",
  // Content words that carry this corpus's English register and have no Czech homograph.
  // (Deliberately excludes internationalisms Czech shares — index, kontakt, moment, … —
  // and, since 2026-08-12, "evidence" and "memorandum": both are ordinary Czech words,
  // and "evidence" (CZ: registry/records) alone flipped genuinely Czech registry notes
  // to English — measured 14/211 reviewer notes withheld as "Česká verze se připravuje".)
  "amended", "amends", "amend", "statute", "statutes", "repealed", "repeal", "decree",
  "records", "recorded", "holds", "held", "seat", "seats", "board", "tie", "ties", "node",
  "distributed", "listing", "documents", "document", "related", "supervisory", "company",
  "companies", "contract", "contracts", "money", "value", "year", "years", "annual",
  "new", "higher", "lower", "large", "small", "parents", "child", "children", "crime",
  "victims", "court", "courts", "tax", "taxes", "credit", "benefit", "benefits",
  "costs", "cost", "price", "prices", "market", "producers", "chamber", "print",
  "explanatory", "earning", "assessment", "confirmed", "verified",
]);

/**
 * English morphology absent from Czech word-formation. `-ment`, `-ance` and `-ence`
 * are deliberately NOT here — Czech has `dokument`, `argument`, `parlament`,
 * `reference`, `konference`. The 5-character floor keeps Czech `med`, `led`, `sed`
 * out of the `-ed` bucket.
 */
const EN_MORPHOLOGY = /(?:tions?|ing|ed|ly|ness|ship)$/;

function hasEnglishMorphology(word: string): boolean {
  return word.length >= 5 && EN_MORPHOLOGY.test(word) && !/[áčďéěíňóřšťúůýž]/.test(word);
}

/** Czech function words with no English homograph (single-letter prepositions and `a`/`i`/`to`/`on`/`do`/`by` are excluded). */
const CS_STOPWORDS = new Set<string>([
  "se", "si", "na", "ve", "ze", "ke", "že", "je", "jsou", "jsem", "jste", "jsme",
  "byl", "byla", "bylo", "byly", "byli", "být", "bude", "budou", "není", "nejsou", "nebyl", "nebyla",
  "který", "která", "které", "kterou", "kterým", "kterých", "kterého", "kteří", "kterými",
  "jako", "podle", "pro", "při", "bez", "mezi", "proti", "před", "přes", "kolem", "vůči", "podle",
  "však", "také", "tedy", "proto", "protože", "jen", "pouze", "ještě", "již", "nikoli", "ani",
  "tento", "tato", "toto", "této", "tomto", "tímto", "těchto", "tím", "tak", "takto", "takové",
  "aby", "když", "kde", "kdy", "což", "čímž", "dále", "více", "méně", "lze", "může", "mohou",
  "má", "mají", "měl", "měla", "mělo", "jeho", "její", "jejich", "svého", "svou", "svých", "své",
  "zákon", "zákona", "zákonu", "zákonem", "zákoně", "zákony", "zákonů",
  "návrh", "návrhu", "návrhem", "tisk", "tisku", "sněmovní", "sněmovny", "poslanec", "poslanci",
  "podle", "důvodová", "důvodové", "zpráva", "zprávy", "novela", "novely", "novelizuje",
  "vláda", "vlády", "vládní", "předkladatel", "předkladatele", "výbor", "výboru", "výbory",
  "střet", "střetu", "zájmů", "dopad", "dopady", "dopadů", "zdroj", "zdroje", "citace",
  "rozpočtu", "rozpočet", "veřejných", "veřejné", "veřejný", "prospěch", "prospívá",
]);

/** How the classifier scored a string. `czech`/`english` are stopword hit counts. */
export interface LanguageScore {
  tokens: number;
  czech: number;
  english: number;
  /** true ⇒ the string reads as English and must not render to a Czech reader. */
  looksEnglish: boolean;
  /** Short human reason, for the gate's error list. */
  reason: string;
}

const WORD_RE = /[\p{L}][\p{L}\p{M}'-]*/gu;

/** Minimum tokens before the frequency rule is trusted; below it, a stricter presence rule applies. */
const MIN_TOKENS_FOR_RATE = 16;
/** English stopword share of all tokens above which the string reads as English. */
const EN_RATE_THRESHOLD = 0.05;

/**
 * Deterministic Czech-vs-English classification of a reader-facing string.
 * Never throws; an empty/blank string scores as neither (and is not "English").
 */
export function scoreLanguage(text: string): LanguageScore {
  const words = (text.match(WORD_RE) ?? []).map((w) => w.toLocaleLowerCase("cs"));
  let czech = 0;
  let english = 0;
  for (const w of words) {
    if (CS_STOPWORDS.has(w)) czech++;
    else if (EN_STOPWORDS.has(w) || hasEnglishMorphology(w)) english++;
  }
  const tokens = words.length;
  if (tokens === 0) return { tokens, czech, english, looksEnglish: false, reason: "prázdný text" };

  // Short strings (a citation claim can be a single clause): a frequency rate is
  // noise at n<12, so require an outright English majority with at least two hits.
  if (tokens < MIN_TOKENS_FOR_RATE) {
    // `>=` not `>`: a short bilingual citation label ("Amended statute: zákon č. …")
    // ties on hits, and a tie in a Czech-first product resolves against rendering.
    const looksEnglish = english >= 2 && english >= czech;
    return {
      tokens,
      czech,
      english,
      looksEnglish,
      reason: looksEnglish
        ? `krátký text: ${english} anglických funkčních slov vs ${czech} českých`
        : "text neprošel jako anglický (krátký text)",
    };
  }

  const rate = english / tokens;
  const looksEnglish = english > czech && rate >= EN_RATE_THRESHOLD;
  return {
    tokens,
    czech,
    english,
    looksEnglish,
    reason: looksEnglish
      ? `${english} anglických funkčních slov z ${tokens} (${(rate * 100).toFixed(1)} %), českých jen ${czech}`
      : `česky nebo neurčeno (${english} EN / ${czech} CS z ${tokens})`,
  };
}

/** True when the string reads as English and must NOT be shown to a Czech reader. */
export function looksEnglish(text: string | null | undefined): boolean {
  return typeof text === "string" && text.length > 0 && scoreLanguage(text).looksEnglish;
}

/** True when the string is non-empty and safe to render on a Czech-first surface. */
export function isCzechSafe(text: string | null | undefined): boolean {
  return typeof text === "string" && text.length > 0 && !scoreLanguage(text).looksEnglish;
}

/**
 * RENDER-TIME gate: the string if it may be shown to a Czech reader, otherwise
 * `null` — never a partial, never a machine translation. Callers substitute the
 * honest placeholder (`CZECH_WITHHELD_CZ`) so the reader learns the analysis
 * exists but its Czech wording is still pending.
 */
export function czechCopyOrNull(text: string | null | undefined): string | null {
  return isCzechSafe(text) ? (text as string) : null;
}

/** The honest placeholder shown in place of a withheld (not-yet-Czech) field. */
export const CZECH_WITHHELD_CZ = "Česká verze tohoto textu se připravuje — do té doby ho nezobrazujeme.";

/**
 * PERSIST-TIME gate: every reader-facing string of a payload, checked at once.
 * Returns one error line per English-looking field (empty ⇒ the payload may be
 * persisted). `label` names the field for the error message.
 */
export function czechGateErrors(fields: { label: string; text: string | null | undefined }[]): string[] {
  const out: string[] = [];
  for (const { label, text } of fields) {
    if (typeof text !== "string" || text.length === 0) continue;
    const score = scoreLanguage(text);
    if (score.looksEnglish) out.push(`${label}: čtenářský text není česky — ${score.reason}`);
  }
  return out;
}

/** PERSIST-TIME gate, throwing form — for write paths that must fail loudly. */
export function assertCzech(fields: { label: string; text: string | null | undefined }[]): void {
  const errors = czechGateErrors(fields);
  if (errors.length > 0) {
    throw new Error(`language-gate: reader-facing prose must be Czech\n  - ${errors.join("\n  - ")}`);
  }
}
