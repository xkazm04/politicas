/**
 * @catalog Citační řádek — sází se podle DÉLKY: krátké je štítek verzálkami, dlouhé je věta.
 *
 * Důkaz na prvním místě je značka Politicas (politicas.md §6): každé vykreslené
 * číslo nese citaci datasetu. Tohle je kanonický tvar té citace — nesázet ručně,
 * importovat odsud.
 *
 * ── Proč se to 2026-07-29 změnilo ────────────────────────────────────────
 * Audit /impeccable (docs/design/impeccable-pass-01.md) našel, že primitiv,
 * který nese značkové pravidlo, byl vysázený tak, že se nedal přečíst:
 * `text-[11px] uppercase tracking-widest text-steel` = 4,11:1 kontrast, místy
 * 10 px, a proložené verzálky na řetězcích až 115 znaků.
 *
 * Jádro problému nebyla sazba, ale pravidlo: docs/DESIGN.md §2 povoluje
 * „uppercase tracked labels only for meta" a citace META JE, takže prošla.
 * Pravidlo třídí podle ROLE, nikdy podle DÉLKY — a stodvacetiznaková věta
 * v kabátě štítku jím propadne. Tenhle komponent to zavírá v kódu: rozhoduje
 * MĚŘENÝ počet znaků, ne úsudek volajícího, takže se to nedá zapomenout.
 *
 * Sazba: `text-xs` (12 px) v obou režimech — nad prahem 11 px z §5 a bez
 * arbitrární hodnoty `text-[…]`. Barvy jsou AA: `steel-aa` (4,90:1) a
 * `signal-deep` (5,31:1) místo `steel` (4,11:1) a `signal` (4,10:1).
 *
 * ── Kapsle původu (batch 2A, aditivní) ───────────────────────────────────
 * Volitelný prop `provenance` povyšuje citaci na doklad: text se vysází
 * beze změny, ale stane se triggerem dialogu s účtenkou původu (záznam
 * grafu, stav lidské brány, registry, trvalá adresa /zdroj/<ref>).
 * Bez propu se nemění ani bajt výstupu — všech ~158 stávajících volajících
 * sází přesně to co dřív. Účtenku odvozuje server
 * (features/shared/provenance/receipt.ts), sem přichází hotová a
 * serializovatelná.
 */

import ProvenanceCapsule from "@/features/shared/provenance/ProvenanceCapsule";
import type { ProvenanceReceipt } from "@/features/shared/provenance/receipt";
// The rule itself (threshold + walker) is a pure, tested module beside this file.
import { citationMode } from "./sourceNoteMode";

export { LABEL_MAX_CHARS } from "./sourceNoteMode";

const TONE = {
  steel: "text-steel-aa",
  signal: "text-signal-deep",
  paper: "text-paper/90",
} as const;

export default function SourceNote({
  children,
  tone = "steel",
  dot = false,
  as,
  className = "",
  provenance,
}: {
  children: React.ReactNode;
  /** Barevný tón textu; `paper` pro tmavé/barevné plochy. */
  tone?: keyof typeof TONE;
  /** Předsadit signální tečku (●) — pro zdrojové stopy u obrázků. */
  dot?: boolean;
  /** Vynutit režim, když měření lže (např. citace složená až za běhu). */
  as?: "label" | "sentence";
  className?: string;
  /** Účtenka původu (batch 2A) — s ní se citace stane klikacím dokladem.
   *  Bez ní se výstup nemění ani o bajt (aditivní opt-in). */
  provenance?: ProvenanceReceipt;
}) {
  const mode = as ?? citationMode(children);
  const type =
    mode === "label"
      ? "font-mono text-xs uppercase tracking-widest"
      : "font-mono text-xs leading-relaxed";

  // Záměrně <div>, ne <p>: citace se vnořuje do ledasčeho a <p> uvnitř <p>
  // je nevalidní HTML → rozbitá hydratace (incident 2026-07-22).
  return (
    <div className={`${type} ${TONE[tone]} ${className}`}>
      {dot && <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-signal align-middle" aria-hidden />}
      {provenance ? <ProvenanceCapsule receipt={provenance}>{children}</ProvenanceCapsule> : children}
    </div>
  );
}
