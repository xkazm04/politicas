/*
 * REJSTŘÍK VYDANÝCH FIGUR — aditivní rozšíření slovníku claimů (moonshot 6C).
 *
 * Civic Claim Gate (/overeni) potřebuje pro claim-ref a data-claim-* payload
 * druhou stranu rovnice: „jak zní tatáž figura DNES?" Tenhle modul je jediné
 * místo, které to ví — eviduje každou figuru, kterou aplikace vydala přes
 * <CitableNumber>, spolu s pravidlem, odkud se její dnešní hodnota odvozuje.
 *
 * Pravidla:
 *   1. ADITIVNÍ. claim.ts se nemění; rejstřík jen konzumuje jeho slovník.
 *      (Poznámka pro follow-up konsolidace ClaimReview: /svedectvi dnes
 *      definuje tytéž claimy lokálně — až bude stránka na řadě, má je
 *      importovat odsud, aby vydání i ověření četly týž řádek.)
 *   2. TÝŽ ZDROJ JAKO PLOCHA. Hodnota figury se odvozuje ze stejného řádku
 *      vzorkové vrstvy lib/civic, ze kterého ji sází vydávající plocha —
 *      žádná druhá pravda, žádné opsané literály bez původu.
 *   3. POCTIVÉ NEZNÁMO. Figura, jejíž zdrojový řádek zmizel nebo se nedá
 *      přečíst, z rejstříku vypadne (resolveClaimRef vrátí null) — brána pak
 *      řekne „rejstřík tuhle figuru nezná", nikdy nedosadí nulu.
 */

import { CHAMBER_STATS } from "@/lib/civic/data";
import { CHAMBER_SUMMARY } from "@/lib/civic/leaderboard";
import type { CitableKind } from "@/lib/format";
import { makeClaimRef, type Claim } from "./claim";

/** Jedna vydaná figura: claim + dnešní hodnota + kde je vydaná. */
export interface IssuedFigure {
  claim: Claim;
  /** Formátovač, kterým figuru sází vydávající plocha (dec/int/czk). */
  kind: CitableKind;
  /** Dnešní strojová hodnota, odvozená z téhož zdroje jako plocha. */
  value: number;
  /** Cesta plochy, která figuru vydává (pro odkaz „kde figura žije"). */
  issuedAt: string;
}

/** „78,3 %" → 78.3 — čte ULOŽENOU hodnotu dlaždice velína (lib/civic/data),
 *  jedinou podobu, ve které vzorková vrstva figuru nese. Nečíselný řetězec
 *  vrací null a figura z rejstříku poctivě vypadne (pravidlo 3). */
export function czechTileNumber(display: string): number | null {
  const cleaned = display.replace(/[^\d,.−-]/g, "").replace("−", "-").replace(",", ".");
  if (cleaned === "" || cleaned === "-") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Datum vzorkové vrstvy — vzorková data jsou statická, datum odvození je
 *  datum jejich pořízení (drží se v sync s retrievedAt na /svedectvi). */
const SAMPLE_RETRIEVED_AT = "2026-07-30";

function buildRegistry(): IssuedFigure[] {
  const figures: IssuedFigure[] = [];

  // Ústavní velikost sněmovny — jediný ručně OVĚŘENÝ claim (čl. 16 odst. 1
  // Ústavy ČR); konstanta je zdroj, žádná vzorková dlaždice neexistuje.
  figures.push({
    claim: {
      ref: makeClaimRef({ dataset: "Ústava ČR", metric: "pocet-poslancu" }),
      dataset: "Ústava ČR, čl. 16 odst. 1",
      metric: "pocet-poslancu",
      unit: "poslanců",
      sourceUrl: "https://www.psp.cz/docs/laws/constitution.html",
      retrievedAt: SAMPLE_RETRIEVED_AT,
      reviewStatus: "verified",
    },
    kind: "int",
    value: 200,
    issuedAt: "/svedectvi",
  });

  // Průměrný kompozit — z CHAMBER_SUMMARY (jediný zdroj pravdy pro agregáty
  // žebříčku), přesně jak ho sází /svedectvi.
  figures.push({
    claim: {
      ref: makeClaimRef({ dataset: "civicscore v1.4", metric: "prumerny-kompozit" }),
      dataset: "civicscore v1.4",
      metric: "prumerny-kompozit",
      retrievedAt: SAMPLE_RETRIEVED_AT,
      reviewStatus: "pending",
    },
    kind: "dec",
    value: CHAMBER_SUMMARY.avg,
    issuedAt: "/svedectvi",
  });

  // Průměrná docházka — z dlaždice velína (CHAMBER_STATS), jediné podoby,
  // ve které vzorková vrstva hodnotu nese. Chybějící/nečitelná dlaždice
  // figuru z rejstříku vyřadí (pravidlo 3), nikdy nedosadí nulu.
  const attendanceTile = CHAMBER_STATS.find((s) => s.key === "attendance");
  const attendance = attendanceTile ? czechTileNumber(attendanceTile.value) : null;
  if (attendanceTile && attendance !== null) {
    figures.push({
      claim: {
        ref: makeClaimRef({ dataset: attendanceTile.source, metric: "prumerna-dochazka" }),
        dataset: attendanceTile.source,
        metric: "prumerna-dochazka",
        unit: "%",
        retrievedAt: SAMPLE_RETRIEVED_AT,
        reviewStatus: "pending",
      },
      kind: "dec",
      value: attendance,
      issuedAt: "/svedectvi",
    });
  }

  return figures;
}

/** Všechny figury, které aplikace vydala (deterministické pořadí vydání). */
export const ISSUED_FIGURES: readonly IssuedFigure[] = buildRegistry();

/** Figura podle claim-ref; null = rejstřík ji nezná (brána řekne neznámý odkaz). */
export function resolveClaimRef(ref: string): IssuedFigure | null {
  return ISSUED_FIGURES.find((f) => f.claim.ref === ref) ?? null;
}
