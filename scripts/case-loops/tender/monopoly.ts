/* Tender loop — the MONOPOLY-COUNTERPARTY class (b005 calibration catch, durable).
 *
 * Some winners are statutory network operators: any construction touching their grid
 * (přeložky, connections) is by law contracted with THEM — single-source is the nature of
 * the counterparty, not a market signal. Their wins therefore carry no trailing-window
 * flags and are EXCLUDED from winner signal listings, but always DISCLOSED (named class,
 * never silently dropped). Defined by legal basis, keyed by IČO; membership is a fact
 * about the entity, not about this corpus (two of the four have zero wins in CPV 45
 * today — they stay, the class is stable).
 *
 * Deliberately NOT here: PRAGOPROJEKT ← ŘSD and similar framework-agreement dependences.
 * A rámcová dohoda concentration is a REAL shape a reader should see (explainable, but
 * not statutory); putting it in this class would launder it out of the picture.
 */
const DSO_ELEKTRO = "provozovatel elektrické distribuční soustavy — přeložky zajišťuje dle § 47 zák. č. 458/2000 Sb. výhradně vlastník/provozovatel soustavy";
const DSO_PLYN = "provozovatel plynárenské distribuční soustavy — přeložky dle § 70 zák. č. 458/2000 Sb.";

export const MONOPOLY_COUNTERPARTIES: Record<string, { name: string; basis: string }> = {
  "24729035": { name: "ČEZ Distribuce, a. s.", basis: DSO_ELEKTRO },
  "28085400": { name: "EG.D, a.s.", basis: DSO_ELEKTRO },
  "25376516": { name: "PREdistribuce, a. s.", basis: DSO_ELEKTRO },
  "27295567": { name: "GasNet, s.r.o.", basis: DSO_PLYN },
};

export const isMonopolyCounterparty = (companyId: string): boolean => {
  const ico = companyId.startsWith("company:ico:") ? companyId.slice("company:ico:".length) : companyId;
  return ico in MONOPOLY_COUNTERPARTIES;
};
