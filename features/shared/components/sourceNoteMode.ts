/**
 * The ONE rule of the citation primitive, as a pure function (scan-sweep 2026-09-07).
 *
 * `SourceNote` sets a citation as a tracked uppercase LABEL up to `LABEL_MAX_CHARS`
 * characters and as a SENTENCE beyond - measured on the whole children tree, so the
 * decision cannot depend on which fragment comes first. The walker lived unexported inside
 * the component and the brand rule it enforces had no test; both now live here, where a
 * test can hold the header's two calibration strings to their sides of the threshold.
 */

/** Nad tímhle počtem znaků přestává být citace štítkem a stává se větou.
 *  48 drží „obr. 4 — ověřené veřejné zdroje" (31) štítkem a pouští
 *  „ilustrativní schéma — ilustrativní ukázka — nejde o reálná data" (63)
 *  do větné sazby. */
export const LABEL_MAX_CHARS = 48;

export type CitationMode = "label" | "sentence";

/** Spočítá délku textu v libovolném stromu potomků — citace se běžně skládá
 *  z řetězců i vnořených prvků a rozhodnutí musí padnout na celku. */
export function textLength(node: unknown): number {
  if (node === null || node === undefined || typeof node === "boolean") return 0;
  if (typeof node === "string") return node.length;
  if (typeof node === "number") return String(node).length;
  if (Array.isArray(node)) return node.reduce<number>((n, child) => n + textLength(child), 0);
  if (typeof node === "object" && "props" in node) {
    const props = (node as { props?: { children?: unknown } }).props;
    return textLength(props?.children);
  }
  return 0;
}

/** Štítek, nebo věta — podle MĚŘENÉ délky, ne podle úsudku volajícího. */
export function citationMode(children: unknown): CitationMode {
  return textLength(children) > LABEL_MAX_CHARS ? "sentence" : "label";
}
