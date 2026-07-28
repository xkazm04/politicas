"use client";

/*
 * Tvarosloví uzlů přehledového grafu — jeden slovník pro obě varianty.
 * Sutnarovská logika: druh entity nese TVAR (kolo = osoba, čtverec = firma,
 * kosočtverec = peníze, trojúhelník = hlasování, pětiúhelník = zákon), barva
 * jen zesiluje. Kdo tvary jednou pochopí, čte pak graf i v tiskové šedi.
 *
 * Body polygonů jsou zapsané jako literály, ne dopočítané z trigonometrie —
 * float drift mezi SSR a CSR rozbíjí hydrataci (viz Hemicycle.tsx).
 */

import type { StateNodeKind } from "@/lib/civic/stateGraph";
import { NODE_FILL } from "../graphText";

/** Pětiúhelník r=10, vrchol nahoru. */
const PENTAGON = "0,-10 9.51,-3.09 5.88,8.09 -5.88,8.09 -9.51,-3.09";
/** Trojúhelník r≈10, vrchol nahoru. */
const TRIANGLE = "0,-10 9,6.5 -9,6.5";

export default function GraphGlyph({
  kind,
  lit,
  selected = false,
  focused = false,
  scale = 1,
}: {
  kind: StateNodeKind;
  /** V rozsvícené stopě — jinak vlasově šedý. */
  lit: boolean;
  /** VYBRANÝ uzel (stav plochy, je v URL) — o kousek větší a se signálním
   *  kroužkem, aby se v rozsvícené stopě našel. */
  selected?: boolean;
  /** Uzel, na kterém právě STOJÍ KLÁVESNICE. Vlastní, kobaltově čárkovaný
   *  kroužek: indikátor fokusu musí ukazovat, kde je kurzor, ne co je vybráno —
   *  do 2026-07-28 se kreslil podle výběru a plátno se z klávesnice ovládat
   *  nedalo, protože nebylo vidět, kde uživatel je. */
  focused?: boolean;
  scale?: number;
}) {
  const fill = lit ? NODE_FILL[kind] : "fill-hairline";
  const s = scale * (selected ? 1.25 : 1);
  const cls = `${fill} transition-[fill] duration-150`;

  const shape = () => {
    switch (kind) {
      case "person":
        return <circle r={9} className={cls} />;
      case "party":
        return <circle r={7} className={cls} />;
      case "company":
        return <rect x={-8} y={-8} width={16} height={16} className={cls} />;
      case "money":
        return <rect x={-7.5} y={-7.5} width={15} height={15} transform="rotate(45)" className={cls} />;
      // Hlasování i sněmovní tisk = trojúhelník: obojí je vstup legislativního
      // pruhu, vzorek kreslí hlasování, reálný výřez tisk. Legenda pojmenuje ten,
      // který je v grafu skutečně vykreslený, takže se tvar nedvojznačí.
      case "vote":
      case "bill":
        return <polygon points={TRIANGLE} className={cls} />;
      case "law":
        return <polygon points={PENTAGON} className={cls} />;
    }
  };

  return (
    <g transform={s === 1 ? undefined : `scale(${s})`}>
      {selected && <circle r={16} className="fill-none stroke-signal" strokeWidth={2} />}
      {focused && (
        <circle r={20} className="fill-none stroke-cobalt" strokeWidth={2.5} strokeDasharray="4 3" />
      )}
      {shape()}
    </g>
  );
}
