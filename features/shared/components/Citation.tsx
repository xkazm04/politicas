/**
 * @catalog Citace zdroje, která se sází podle DÉLKY — štítek verzálkami, věta větně.
 *
 * Proč vedle `SourceNote`: audit /impeccable (docs/design/impeccable-pass-01.md)
 * našel, že primitiv nesoucí značkové pravidlo „každé číslo cituje svůj zdroj"
 * je vysázený tak, že se nedá přečíst — 4,11:1 kontrast, místy 10 px pod vlastním
 * prahem, a verzálky s `tracking-widest` na řetězcích až 115 znaků.
 *
 * Jádro problému: docs/DESIGN.md §2 povoluje „uppercase tracked labels only for
 * meta" a citace META JE — pravidlo třídí podle ROLE, nikdy podle DÉLKY, takže
 * stodvacetiznaková věta v kabátě štítku jím projde. Tenhle komponent to pravidlo
 * uzavírá v kódu: krátký řetězec je štítek, dlouhý je věta, a rozhoduje o tom
 * měřený počet znaků, ne úsudek volajícího.
 *
 * Barvy jsou AA: `steel-aa` (4,90:1) a `signal-text` (5,31:1) místo `steel`
 * (4,11:1) a `signal` (4,10:1) — viz app/globals.css. Velikost je `text-xs`
 * (12 px) v obou režimech: nad prahem 11 px z §5 a bez arbitrární hodnoty
 * `text-[…]`, které je v repu 195 kusů.
 */

/** Nad tímhle počtem znaků přestává být citace štítkem a stává se větou.
 *  48 drží „obr. 4 — ověřené veřejné zdroje" (31) štítkem a pouští
 *  „ilustrativní schéma — ilustrativní ukázka — nejde o reálná data" (63)
 *  do větné sazby. */
export const LABEL_MAX_CHARS = 48;

const TONE = {
  steel: "text-steel-aa",
  signal: "text-signal-text",
  paper: "text-paper/90",
} as const;

/** Spočítá délku textu v libovolném stromu potomků — citace se běžně skládá
 *  z řetězců i vnořených prvků a rozhodnutí musí padnout na celku. */
function textLength(node: React.ReactNode): number {
  if (node === null || node === undefined || typeof node === "boolean") return 0;
  if (typeof node === "string") return node.length;
  if (typeof node === "number") return String(node).length;
  if (Array.isArray(node)) return node.reduce<number>((n, child) => n + textLength(child), 0);
  if (typeof node === "object" && "props" in node) {
    const props = (node as { props?: { children?: React.ReactNode } }).props;
    return textLength(props?.children);
  }
  return 0;
}

export default function Citation({
  children,
  tone = "steel",
  dot = false,
  as,
  className = "",
}: {
  children: React.ReactNode;
  /** Barevný tón; `paper` pro tmavé/barevné plochy. */
  tone?: keyof typeof TONE;
  /** Předsadit signální tečku — pro zdrojové stopy u obrázků. */
  dot?: boolean;
  /** Vynutit režim, když měření lže (např. citace složená až za běhu). */
  as?: "label" | "sentence";
  className?: string;
}) {
  const mode = as ?? (textLength(children) > LABEL_MAX_CHARS ? "sentence" : "label");
  const type =
    mode === "label"
      ? "font-mono text-xs uppercase tracking-widest"
      : "font-mono text-xs leading-relaxed";

  // Záměrně <div>, ne <p>: citace se vnořuje do ledasčeho a <p> uvnitř <p> je
  // nevalidní HTML → rozbitá hydratace (incident 2026-07-22, viz SourceNote).
  return (
    <div className={`${type} ${TONE[tone]} ${className}`}>
      {dot && (
        <span
          className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-signal align-middle"
          aria-hidden
        />
      )}
      {children}
    </div>
  );
}
