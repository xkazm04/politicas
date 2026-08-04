/*
 * PŘÍSPĚVKOVÝ INDEX JAKO CITACE — slovník hodnotového claimu /zebricek.
 *
 * Vlajkové číslo platformy bylo jediné necitovatelné: features/civicscore/**
 * neobsahovalo jediný claim-ref, přestože je to NEJLÉPE doložené číslo v grafu —
 * všech 207 uzlů nese `contribution_provenance {pass, ref}`, kód deklaruje
 * `CONTRIBUTION_FORMULA_REF` a /metodika vysvětluje formuli řádek po řádku.
 *
 * Čistý modul (žádný server, žádné I/O) ze stejného důvodu jako u peněz: claim
 * razí PLOCHA i BRÁNA a musí složit bajtově týž ref.
 *
 * PRAVIDLA
 *  1. RAZÍ SE KOMPOZIT, ne šest složek. Citovat se dá číslo, které se vysází a
 *     opíše — šest vážených bodových podílů nikdo necituje a šest dalších adres
 *     by jen zředilo jednu skutečnou.
 *  2. CITACE NESE VLASTNÍ PROVENIENCI. `derivation` je `<ref formule>@<pass>` z
 *     KOMOROVÉHO agregátu (./provenance.ts), ne z prvního uzlu — a když se
 *     komora na jedné dvojici neshodne (`mixed`) nebo ji nenese (`absent`),
 *     základ se VYNECHÁ. Poloviční přepočet nemá jednu provenienci a claim,
 *     který by si nějakou vybral, by tvrdil víc, než data nesou.
 *  3. INDEX NEPROCHÁZÍ LIDSKOU BRANOU. Je to deterministický přepočet z dumpů
 *     psp.cz, jako otisk pohledu na graf — proto `ungated`, ne „čeká na
 *     kontrolu": nikdo takovou kontrolu nechystá a věta by lhala.
 *  4. METODIKA JE SOUČÁST TVRZENÍ — `methodologyUrl` míří na /metodika, kde
 *     každá váha i saturace pochází z importu, ne z literálu.
 */

import { makeClaimRef, type Claim } from "@/lib/claims/claim";
import type { ContributionProvenance } from "./provenance";

/** Dataset ve slovníku SourceNote. Je součástí refu, takže je fixní — verze
 *  formule se nese v `derivation`, nikdy v datasetu (jinak by každý přepočet
 *  zneplatnil všechny dosud vydané adresy). */
export const SCORE_CLAIM_DATASET = "psp.cz — příspěvkový index";

export const SCORE_METRIC = {
  /** Kompozit 0–100 (`contribution_score`) jednoho poslance. */
  contribution: "prispevkovy-index",
} as const;

export const SCORE_METRICS: readonly string[] = Object.values(SCORE_METRIC);

/** Předmět claimu — id uzlu osoby, týž tvar, jaký čte `pspIdFromEntityId`. */
export const scoreSubject = (pspId: number): string => `psp:person:${pspId}`;

/** Základ odvození: `<ref formule>@<pass>`, nebo null, když komora nemá jednu
 *  provenienci (pravidlo 2). Verdikt brány porovnává právě tohle — shoda čísla
 *  pod dvěma různými formulemi je náhoda, ne potvrzení. */
export function scoreDerivation(p: ContributionProvenance): string | null {
  if (p.state !== "uniform" || p.ref === null || p.pass === null) return null;
  return `${p.ref}@${p.pass}`;
}

export interface ScoreFigure {
  claim: Claim;
  value: number;
}

/** Claim nad kompozitem jednoho poslance. `score` se předává tak, jak ho nese
 *  žebříček — modul nic nepočítá; kdyby počítal, byla by to druhá formule. */
export function contributionScoreClaim(
  pspId: number,
  score: number,
  provenance: ContributionProvenance,
): ScoreFigure {
  const subject = scoreSubject(pspId);
  const derivation = scoreDerivation(provenance);
  return {
    claim: {
      ref: makeClaimRef({ dataset: SCORE_CLAIM_DATASET, metric: SCORE_METRIC.contribution, subject }),
      dataset: SCORE_CLAIM_DATASET,
      metric: SCORE_METRIC.contribution,
      subject,
      methodologyUrl: "/metodika",
      // Deterministický přepočet — lidskou branou neprochází (pravidlo 3).
      reviewStatus: "ungated",
      ...(derivation !== null && { derivation }),
    },
    value: score,
  };
}
