// Výsledek hlasování tak, jak ho nese `vote_event.outcome` — a jak se smí vysázet.
//
// Katalog (`common.voteResult.*`) pojmenovává PŘESNĚ dva výsledky: přijato a
// zamítnuto. Do 2026-09-07 sázely deník i pohled do sálu každý výsledek, který
// nebyl „accepted", větví „zamítnuto" — výchozí větev, která pojmenovala hodnotu,
// kterou nikdo nezkontroloval. Témata (VoteThemeFilter) měla poctivou variantu
// s vlastní lokální množinou; tohle je ta množina, jednou, pro všechny tři plochy
// (a pro kompas, který si dnes drží čtvrtou kopii).
//
// Neznámý token se sází DOSLOVA a v neutrálním tónu: strojová hodnota se nikdy
// nepovyšuje na větu, kterou katalog nemá (pravidlo receipt.ts `relLabelKey`).

export const KNOWN_OUTCOMES: ReadonlySet<string> = new Set(["accepted", "rejected"]);

export const isKnownOutcome = (outcome: string): outcome is "accepted" | "rejected" =>
  KNOWN_OUTCOMES.has(outcome);

export type OutcomeTone = "accepted" | "rejected" | "other";

/** Tón výsledku pro sazbu: kobalt pro přijato, signální pro zamítnuto, tlumený
 *  pro cokoli, co katalog nezná. */
export const outcomeTone = (outcome: string): OutcomeTone =>
  outcome === "accepted" ? "accepted" : outcome === "rejected" ? "rejected" : "other";
