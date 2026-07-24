// Target predicates for the sem_filter benchmark + their DETERMINISTIC keyword
// baseline (the free "Execution Plane only" arm). Keywords are deliberately a
// crude regex over the Czech title — the whole question of direction #9 is how
// far the LLM arms beat this floor, and at what token cost.

export interface Predicate {
  id: string;
  /** Natural-language predicate handed to the LLM (Czech, with an English gloss). */
  question: string;
  /** Crude deterministic matcher over the raw title. */
  keywords: RegExp;
}

export const PREDICATES: Predicate[] = [
  {
    id: "fiscal-budget",
    question:
      "Týká se toto hlasování státního rozpočtu, daní, veřejných financí nebo dotací? (state budget, taxes, public finance, or subsidies)",
    keywords: /rozpoč|daň|dan[ěií]|daňov|finanč|deficit|dotac|dotač|clo|poplat|schodk|účetní závěrk|fiskál/i,
  },
  {
    id: "personnel-appointments",
    question:
      "Jde o hlasování o volbě, jmenování, ustavení nebo obsazení osob do orgánů (výbory, komise, delegace, správní/dozorčí rady, vláda)? (electing, appointing, or establishing people to bodies — committees, commissions, delegations, boards, government)",
    // Deliberately crude baseline: covers the common verbs but NOT the many
    // paraphrases (Správní rada, delegace, náhradník, obsazení…) the LLM should catch.
    keywords: /volb|volba|jmenován|ustavení|ustanoven/i,
  },
  {
    id: "housing-construction",
    question:
      "Týká se toto hlasování bydlení, výstavby nebo stavebního práva? (housing, construction, or building law)",
    keywords: /bydlen|byt[oy]|výstavb|stavebn|nájem|nemovitost|územní plán|katastr/i,
  },
];

export function predicateById(id: string): Predicate | undefined {
  return PREDICATES.find((p) => p.id === id);
}
