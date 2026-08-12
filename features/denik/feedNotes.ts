/**
 * UPOZORNĚNÍ V POPISU KANÁLU — čistá projekce pokrytí a mezí čtení na JEDNU
 * českou větu, kterou strojové podoby deníku přibalí do `<description>` /
 * `description`.
 *
 * Proč to vůbec vzniklo (2026-08-12): obě routy feedů četly `getDenikData()`
 * a `coverage` i `limits` z něj ZAHAZOVALY. Tmavá peněžní vrstva se tak
 * odběrateli jevila přesně jako klidný týden — HTTP 200, platný feed, míň
 * položek. Plocha /denik má na obojí prapor; čtečka neměla nic, a přitom je to
 * jediný kanál, kterým se k části čtenářů deník vůbec dostane.
 *
 * Pravidla, která tenhle modul drží:
 *   • Věta se skládá z DAT, nikdy se nepíše ručně — počty i stropy jdou
 *     z `DenikLimits`, jména vrstev z klíčů `DenikCoverage`.
 *   • Mez, která se dat nedotkla, mlčí (precedens limitNotes.ts): nulová
 *     pojistka není sdělení.
 *   • Přiznává se ZTRÁTA, ne evidence. `malformedIco` řádek neztrácí (jen mu
 *     chybí čip firmy) a `changesFromGate` je záměrná deduplikace — do
 *     upozornění o neúplnosti výpisu proto nepatří ani jedno.
 *   • Nic se neopravuje ani neslibuje.
 *
 * ČEŠTINA NATVRDO JE ZDE ZÁMĚR: feed je jednojazyčný artefakt a mluví
 * brankovanou češtinou stejně jako `denikEntrySummaryCs` — kanál nemá locale
 * čtenáře ani překladač. Čtenářské verze týchž vět žijí v katalogu pod
 * `denik.coverage.*` / `denik.limits.*` a sází je plocha.
 */

import { formatInt } from "@/lib/format";
import type { DenikCoverage, DenikLimits } from "./getDenikData";

/** Jméno vrstvy pro větu feedu — pořadí je pořadí praporu pokrytí na ploše. */
const LAYER_NAMES: { key: keyof DenikCoverage; name: string }[] = [
  { key: "money", name: "peněžní vrstva" },
  { key: "law", name: "legislativní vrstva" },
  { key: "reviews", name: "lidská brána" },
  { key: "changes", name: "proud „zaznamenáno“" },
];

const int = (n: number) => formatInt(n, "cs");

/** Meze, které z výpisu SKUTEČNĚ berou zápisy (viz pravidla v hlavičce). */
function truncationClauses(limits: DenikLimits): string[] {
  const out: string[] = [];
  if (limits.companiesOverCap > 0) {
    out.push(
      `smlouvy ${int(limits.companiesOverCap)} firem nad stropem ${int(limits.companyCap)} se nečetly vůbec`,
    );
  }
  if (limits.companiesEdgeTruncated > 0) {
    out.push(
      `u ${int(limits.companiesEdgeTruncated)} firem se dosáhlo stropu ${int(limits.edgeCap)} smluv na firmu`,
    );
  }
  if (limits.auditTruncated) {
    out.push(`čtení lidské brány se zastavilo na stropu ${int(limits.auditCap)} řádků`);
  }
  if (limits.changesTruncated) {
    out.push(
      `proud „zaznamenáno“ se čte od nejnovějších a zastavil se na stropu ${int(limits.changeCap)} událostí`,
    );
  }
  if (limits.changesUndisplayable > 0) {
    out.push(
      `${int(limits.changesUndisplayable)} záznamů grafu nese druh, který tahle verze deníku neumí vyslovit`,
    );
  }
  return out;
}

/**
 * Jedna věta, nebo `null` — mlčení znamená „nic se neztratilo", nikdy „nevíme".
 * `null` na vstupu je ovšem samo o sobě neznalost: bez pokrytí i bez mezí se
 * netvrdí nic.
 */
export function denikFeedNotice(
  coverage: DenikCoverage | null,
  limits: DenikLimits | null,
): string | null {
  const dark = coverage === null ? [] : LAYER_NAMES.filter((l) => !coverage[l.key]).map((l) => l.name);
  const cut = limits === null ? [] : truncationClauses(limits);

  const clauses: string[] = [];
  if (dark.length > 0) {
    clauses.push(`nečitelné vrstvy (${dark.join(", ")}) — zápisy těchto skupin tenhle výpis nenese`);
  }
  if (cut.length > 0) {
    clauses.push(`useknuté čtení (${cut.join("; ")}) — část zápisů tenhle výpis nenese`);
  }
  if (clauses.length === 0) return null;
  return `Upozornění k tomuto vydání: ${clauses.join(". Dále: ")}.`;
}
