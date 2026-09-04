/*
 * Občanská schránka — PŘEPOČET INDEXU jako delta (moonshot 7A, vlna 2).
 *
 * „Poslancův index přispění byl přepočten" je nejsdělitelnější změna, kterou
 * graf o poslanci nese — a schránka ji do vlny 1 neuměla říct, protože deník
 * ji nevede (deník staví na smlouvách, rolích, krocích tisků a bráně).
 * Uzly osob přitom nesou `contribution_provenance = {pass, ref, computedAt}`.
 *
 * ── VELIKOST ZMĚNY: KDY ANO, KDY NE (2026-09-04, moonshot G1) ──────────────
 * Věta „o kolik se skóre pohnulo, záznam neříká" byla pravdivá do chvíle, kdy
 * přistála bitemporální vrstva: `kg_node_history` PŘEDCHOZÍ hodnoty drží a
 * `store.asOfNode` je umí přečíst. Delta proto velikost změny vysází — ale jen
 * pod třemi podmínkami, a jinak zůstává původní věta beze změny:
 *
 *   1. PŘEDCHŮDCE EXISTUJE. Uzel toho poslance nese v historii verzi
 *      s `contribution_score`. Chybí-li, magnituda se nedopočítává (missing
 *      is not zero) — poslanec bez historie dostane původní řádek.
 *   2. PŘEDCHŮDCE JE JEDNOTNÝ. Předchozí `{pass, ref}` je jeden pro celou
 *      porovnávanou množinu. Půlka sněmovny na jednom starém průchodu a půlka
 *      na jiném není jeden fakt, ale dva — táž laťka, jakou drží
 *      `recomputeFactFromProps` pro dnešek.
 *   3. VZOREC SE NEZMĚNIL. `ref` předchůdce se rovná dnešnímu. Když se změnil,
 *      rozdíl míchá opravu formule s pohybem dat a „skóre kleslo o 3,2" by
 *      byla nepravda o poslanci, ne fakt o výpočtu (MEMORY.md →
 *      recompute-replay-gate: opravená formule se musí přehrát, ne odečíst).
 *
 * `computedAt` zůstává JEDEN sdílený okamžik celého průchodu — velikost změny
 * je tedy vždy „mezi dvěma průchody", nikdy „za týden".
 *
 * ── KDY ŘÁDEK NEVZNIKNE ────────────────────────────────────────────────────
 * Jen když sněmovna nese JEDEN `{pass, ref, computedAt}`. Půlka uzlů na starém
 * průchodu (rozbitý zápis) není jeden fakt, ale dva — a schránka by pak
 * datovala poslance průchodem, který ho možná nepřepočítal. Nejednotný stav se
 * proto nehlásí jako delta vůbec a plocha to přizná v pravidlech.
 *
 * Čistý modul (žádné I/O) — čtení uzlů dělá getRecomputeFact.ts.
 */

import { summarizeContributionProvenance } from "@/features/civicscore/provenance";
import { czech } from "@/lib/format";
import type { DeltaEntry } from "./deriveDeltas";

/** Jednotný přepočet indexu, jak ho graf o sobě tvrdí. */
export interface RecomputeFact {
  /** `YYYY-MM-DD` — den `contribution_provenance.computedAt`. */
  computedAt: string;
  /** Číslo průchodu grafu. */
  pass: number;
  /** Ref vzorce (`contribution_provenance.ref`). */
  ref: string;
  /** Kolik uzlů osob ten `{pass, ref, computedAt}` nese. */
  covered: number;
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Fakt o přepočtu z props uzlů osob — nebo null, když sněmovna nedrží JEDEN
 * `{pass, ref, computedAt}`.
 *
 * JEDEN AGREGÁTOR, ne půldruhého. Jednotnost `{pass, ref}` sem odjakživa
 * počítal `summarizeContributionProvenance` (features/civicscore/provenance.ts)
 * — tentýž agregát, kterým o svém původu mluví /zebricek, /poslanec a
 * /metodika — a `computedAt` si tenhle modul dopočítával sám, protože ho tehdy
 * agregát nesledoval. Od 2026-08-11 ho nese (`ContributionProvenance
 * .computedAt`) a jeho vlastní hlavička říká, že se nemá znovu odvozovat: laťka
 * je ZÁMĚRNĚ táž přísná, jakou držel tenhle soubor — jeden průchod, jeden den,
 * a ani jeden hodnocený uzel bez razítka.
 *
 * Selhává se ZAVŘENĚ: cokoli jiného než jednotný stav s dnem znamená, že se
 * řádek o přepočtu nehlásí vůbec. Datovat poslance průchodem, který ho možná
 * nepřepočítal, je táž chyba jako číst průchod z prvního uzlu.
 */
export function recomputeFactFromProps(
  personProps: readonly Record<string, unknown>[],
): RecomputeFact | null {
  const prov = summarizeContributionProvenance(personProps);
  if (prov.state !== "uniform" || prov.pass === null || prov.ref === null) return null;
  if (prov.computedAt === null || !DAY_RE.test(prov.computedAt)) return null;

  return { computedAt: prov.computedAt, pass: prov.pass, ref: prov.ref, covered: prov.covered };
}

// ── Velikost změny ──────────────────────────────────────────────────────────

/**
 * Předchozí verze indexu JEDNOHO poslance, přečtená z historie jeho uzlu
 * (`kg_node_history` přes `store.asOfNode`). Nese i `{pass, ref}` té verze —
 * bez nich se nedá poznat, jestli je to opravdu předchůdce dnešního průchodu
 * a jestli ho napsal týž vzorec.
 */
export interface PriorScore {
  value: number;
  pass: number;
  ref: string;
}

/** Pohyb skóre jednoho poslance mezi předchozí a dnešní verzí. */
export interface ScoreMove {
  prior: PriorScore;
  current: number;
}

const finite = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

const text = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v : null);

/**
 * Předchozí verze skóre z props historického uzlu — nebo null, když ta verze
 * skóre či razítko původu nenesla. Nic se nedosazuje: uzel bez
 * `contribution_score` NENÍ uzel se skóre nula.
 */
export function priorScoreFromProps(props: Record<string, unknown> | null | undefined): PriorScore | null {
  if (!props) return null;
  const value = finite(props.contribution_score);
  const prov = props.contribution_provenance;
  if (value === null || prov === null || typeof prov !== "object" || Array.isArray(prov)) return null;
  const p = prov as Record<string, unknown>;
  const pass = finite(p.pass);
  const ref = text(p.ref);
  if (pass === null || ref === null) return null;
  return { value, pass, ref };
}

/**
 * Jednotný předchůdce celé porovnávané množiny, nebo null. Podmínka 2 výše:
 * `{pass, ref}` musí být JEDEN — a musí být to, co dnešnímu průchodu
 * předcházelo, ne on sám. Prázdná množina je null, ne „jednotná".
 */
export function uniformPrior(
  priors: readonly (PriorScore | null)[],
): { pass: number; ref: string } | null {
  const seen = priors.filter((p): p is PriorScore => p !== null);
  if (seen.length === 0 || seen.length !== priors.length) return null;
  const { pass, ref } = seen[0];
  return seen.every((p) => p.pass === pass && p.ref === ref) ? { pass, ref } : null;
}

/**
 * O kolik se skóre pohnulo — nebo null, když se to poctivě říct nedá.
 *
 * Vrací PŘESNÝ rozdíl (sazbu obstará lib/format.ts na ploše); nula je platná
 * odpověď a znamená „přepočteno, hodnota se nezměnila", což je jiná věta než
 * „velikost neznáme".
 */
export function scoreMagnitude(move: ScoreMove | null, fact: RecomputeFact): number | null {
  if (move === null) return null;
  // Předchůdce z TÉHOŽ průchodu není předchůdce — historie nezaznamenala nic,
  // co by se dalo odečíst.
  if (move.prior.pass === fact.pass) return null;
  // Jiný vzorec ⇒ rozdíl by míchal opravu formule s pohybem dat (podmínka 3).
  if (move.prior.ref !== fact.ref) return null;
  const delta = move.current - move.prior.value;
  return Number.isFinite(delta) ? delta : null;
}

/** Klíč sledování je poslanec? Přepočet indexu se týká JEN jich. */
export function isPoslanecKey(key: string): boolean {
  return key.startsWith("poslanec:");
}

/**
 * Řádek delty za přepočet indexu — nebo null, když se přepočet do okna
 * čtenáře nevešel, fakt není jednotný nebo klíč není poslanec.
 *
 * `id` je deterministické z průchodu a klíče: dvě sestavení téže delty jsou
 * byte-identická a řádek se v seznamu nezdvojí.
 */
export function recomputeDelta(
  fact: RecomputeFact | null,
  key: string,
  since: string,
  /** Pohyb skóre TOHOTO poslance z historie uzlu; null = neznáme (výchozí). */
  move: ScoreMove | null = null,
): DeltaEntry | null {
  if (fact === null || !isPoslanecKey(key)) return null;
  if (!DAY_RE.test(fact.computedAt) || fact.computedAt < since) return null;
  // Magnituda se sází, JEN když ji lze poctivě odečíst (viz scoreMagnitude);
  // jinak zůstává původní věta „o kolik se skóre pohnulo, záznam neříká".
  const magnitude = scoreMagnitude(move, fact);
  const sized = magnitude !== null;
  return {
    id: `recompute:${fact.pass}:${key}`,
    date: fact.computedAt,
    kind: "recompute",
    // `titleCs`/`source` zůstávají doslovná čeština (feedy jsou jednojazyčné
    // artefakty a čtou je dál); dvojjazyčná plocha sází `titleKey`/`sourceKey`
    // z katalogu `schranka.*` (precedens features/overeni/verdict.ts — čistý
    // modul vrací klíče, plocha překládá). Číslo do české věty jde přes
    // lib/format.ts, ne přes String() — desetinná čárka je pravidlo produktu.
    titleCs: sized
      ? `Index přispění přepočten pro celou sněmovnu — průchod ${fact.pass}; skóre tohoto poslance se posunulo o ${czech(magnitude)} bodu oproti průchodu ${move!.prior.pass}`
      : `Index přispění přepočten pro celou sněmovnu — průchod ${fact.pass}; o kolik se skóre pohnulo, záznam neříká`,
    titleKey: sized ? "schranka.delta.recomputeTitleSized" : "schranka.delta.recomputeTitle",
    titleParams: sized
      ? { pass: fact.pass, delta: czech(magnitude), priorPass: move!.prior.pass }
      : { pass: fact.pass },
    pending: false,
    // Přepočet je čas ZÁZNAMU (kdy jsme počítali), ne čas světa.
    timeBasis: "zaznamenano",
    source: `výpočet politicas — ${fact.ref}`,
    sourceKey: "schranka.delta.recomputeSource",
    sourceParams: { ref: fact.ref },
    tone: "cobalt",
    // Metodika je jediná stránka, která ten vzorec vysvětluje.
    internalHref: "/metodika",
  };
}
