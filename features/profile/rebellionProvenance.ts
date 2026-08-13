/*
 * Původ AGREGÁTU odchylek od klubu — čistá agregace přes `provenance` hran
 * `rebels_against` jednoho poslance. Bez I/O, bez `server-only`, aby se to dalo
 * pojistit testem.
 *
 * PROČ TO NENÍ TŘI ŘÁDKY UVNITŘ STRÁNKY. Spis tiskne u agregátu jedinou citaci
 * a ta má pojmenovat průchod, ref a den přepočtu. Poslanec může mít víc než
 * jednu hranu (přestup: jedna hrana na klub), takže „původ" je AGREGÁT, ne
 * hodnota prvního řádku — přesně ta chyba, kvůli které existuje
 * `features/civicscore/provenance.ts` (loader četl pass z prvního uzlu, který
 * mu přišel pod ruku).
 *
 * A hlavně: NESHODA SE NESMÍ VYDÁVAT ZA MEZERU. První podoba téhle agregace
 * (2026-08-13) při rozejitých řádcích vykreslila větu „průchod ani den přepočtu
 * hrana neuvádí" — což je o řádcích, které pass NESOU, prostě jiný, nepravda.
 * „Nic tu není" a „neshodli jsme se" jsou dvě různá zjištění a mají dvě různé
 * věty; tuhle disciplínu drží celý zbytek produktu (`indexPassMixed`, velínova
 * hlavička, /schranka).
 *
 * Den se porovnává na DEN, ne na okamžik: dva zápisy téhož průchodu ve dvou
 * dnech jsou dva zápisy a agregát pak nemá čím se datovat (týž přísnější práh
 * jako `ContributionProvenance.computedAt`).
 */

/** Původ jednoho řádku agregátu — přesně to, co `getProfileData` z hrany vyčte. */
export interface RebellionProvenanceInput {
  pass: number | null;
  ref: string | null;
  computedAt: string | null;
}

export type RebellionProvenance =
  /** Všechny řádky se shodly na jednom úplném zápisu původu. `computedAt` smí
   *  chybět — hrana bez data je pořád hrana se známým průchodem. */
  | { state: "uniform"; pass: number; ref: string; computedAt: string | null }
  /** Řádky nesou VÍC různých zápisů — žádný jediný se tu jmenovat nedá. */
  | { state: "mixed"; distinctCount: number }
  /** Žádný řádek, nebo jediný zápis bez průchodu i bez refu: citace nemá co
   *  pojmenovat a přizná to. */
  | { state: "absent" };

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Den z případného celého okamžiku; nesmyslná hodnota není datum a nikdy se
 *  na datum neopravuje (precedens nemožných dat z korpusu). */
const dayOf = (raw: string | null): string | null => {
  if (typeof raw !== "string") return null;
  const day = raw.slice(0, 10);
  return DAY_RE.test(day) ? day : null;
};

/**
 * Deterministické: výsledek závisí jen na multimnožině vstupů, nikdy na pořadí
 * iterace.
 */
export function summarizeRebellionProvenance(
  rows: readonly RebellionProvenanceInput[],
): RebellionProvenance {
  const variants = new Map<string, RebellionProvenanceInput>();
  for (const r of rows) {
    const day = dayOf(r.computedAt);
    const pass = typeof r.pass === "number" && Number.isFinite(r.pass) ? r.pass : null;
    const ref = typeof r.ref === "string" && r.ref.length > 0 ? r.ref : null;
    variants.set(`${pass ?? "—"}|${ref ?? "—"}|${day ?? "—"}`, { pass, ref, computedAt: day });
  }

  if (variants.size === 0) return { state: "absent" };
  if (variants.size > 1) return { state: "mixed", distinctCount: variants.size };

  const [only] = [...variants.values()];
  // Citace zní „průchod {pass} · {ref}"; bez obojího není co jmenovat, a půl
  // zápisu původu je pořád chybějící zápis původu, ne polovina jistoty.
  if (only.pass === null || only.ref === null) return { state: "absent" };
  return { state: "uniform", pass: only.pass, ref: only.ref, computedAt: only.computedAt };
}
