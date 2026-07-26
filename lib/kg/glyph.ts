// Geometrie uzlových značek — čistá, bez barev a bez DOM, aby šla otestovat.
//
// Tvar nese druh entity (kolo = osoba, čtverec = firma, kosočtverec = peníze,
// trojúhelník = hlasování, pětiúhelník = zákon, šestiúhelník = orgán/blok),
// barva ho jen zesiluje — graf tak přežije i tisk v šedé.
//
// KONTRAKT, KTERÝ SE NESMÍ PORUŠIT: `traceGlyph` NIKDY nevolá `beginPath()`.
// Cestu vlastní volající, protože uzly se kreslí dávkově — stovky značek se
// nasypou do JEDNÉ cesty a vykreslí jedním `fill()`. Kdyby si každá značka
// otevřela vlastní cestu, smazala by všechny předchozí a vyplnila by se jen ta
// poslední: plátno pak vypadá prázdné, ale uzly na něm pořád jdou kliknout.
// Přesně tahle chyba tam jednou byla (2026-07-26); hlídá ji glyph.test.ts.
//
// Každý tvar si proto musí SÁM otevřít podcestu — `moveTo()` nebo `rect()`.
// Bez toho canvas spojí značku čárou s předchozí a z grafu je pavučina.

export type GlyphShape = "circle" | "ring" | "square" | "diamond" | "triangle" | "pentagon" | "hexagon";

/** Body pravidelného mnohoúhelníku se středem v [0,0], vrchol nahoru. */
function polygon(sides: number, r: number): Array<[number, number]> {
  return Array.from({ length: sides }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / sides;
    // Dvě desetinná místa: nezaokrouhlené hodnoty z trigonometrie rozcházejí
    // SSR a CSR a rozbíjejí hydrataci (stejná disciplína jako v Hemicycle.tsx).
    return [Math.round(Math.cos(a) * r * 100) / 100, Math.round(Math.sin(a) * r * 100) / 100];
  });
}

/** Tvar jako `d` pro <path> — legendy, inspektor, seznamy. */
export function glyphPath(shape: GlyphShape, r: number): string {
  switch (shape) {
    case "circle":
    case "ring":
      return `M ${-r} 0 a ${r} ${r} 0 1 0 ${r * 2} 0 a ${r} ${r} 0 1 0 ${-r * 2} 0 Z`;
    case "square":
      return `M ${-r} ${-r} h ${r * 2} v ${r * 2} h ${-r * 2} Z`;
    case "diamond": {
      const d = r * 1.25;
      return `M 0 ${-d} L ${d} 0 L 0 ${d} L ${-d} 0 Z`;
    }
    case "triangle":
      return `M 0 ${-r * 1.2} L ${r * 1.1} ${r * 0.8} L ${-r * 1.1} ${r * 0.8} Z`;
    case "pentagon":
    case "hexagon":
      return `${polygon(shape === "pentagon" ? 5 : 6, r)
        .map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x} ${y}`)
        .join(" ")} Z`;
  }
}

/**
 * Přidá tvar se středem v [0,0] do PROBÍHAJÍCÍ cesty volajícího.
 * Volající si posune souřadnice (`translate`) a na konci dávky zavolá
 * `fill()` nebo `stroke()`. Viz kontrakt v hlavičce souboru.
 */
export function traceGlyph(ctx: CanvasRenderingContext2D, shape: GlyphShape, r: number): void {
  switch (shape) {
    case "circle":
    case "ring":
      ctx.moveTo(r, 0);
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      break;
    case "square":
      ctx.rect(-r, -r, r * 2, r * 2);
      break;
    case "diamond":
      ctx.moveTo(0, -r * 1.25);
      ctx.lineTo(r * 1.25, 0);
      ctx.lineTo(0, r * 1.25);
      ctx.lineTo(-r * 1.25, 0);
      ctx.closePath();
      break;
    case "triangle":
      ctx.moveTo(0, -r * 1.2);
      ctx.lineTo(r * 1.1, r * 0.8);
      ctx.lineTo(-r * 1.1, r * 0.8);
      ctx.closePath();
      break;
    case "pentagon":
    case "hexagon": {
      for (const [i, [x, y]] of polygon(shape === "pentagon" ? 5 : 6, r).entries()) {
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      break;
    }
  }
}

export const ALL_GLYPH_SHAPES: readonly GlyphShape[] = [
  "circle",
  "ring",
  "square",
  "diamond",
  "triangle",
  "pentagon",
  "hexagon",
];
