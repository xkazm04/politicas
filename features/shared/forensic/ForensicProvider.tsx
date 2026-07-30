"use client";

/*
 * FORENZNÍ REŽIM — poskytovatel (batch 7D).
 *
 * NÁVOD K ADOPCI pro další moduly (tři kroky, žádná výjimka):
 *
 *   1. Klientský kořen stránky obal do <ForensicProvider> — poskytovatel
 *      přečte `?rezim=forenzni` z adresy a po dobu platnosti drží na <html>
 *      atribut `data-rezim="forenzni"`. Na ten atribut je PODMÍNĚNÁ celá
 *      forenzní vrstva tokenů v app/globals.css (vzor usePosterMode):
 *      stránky bez poskytovatele se nijak nemění.
 *
 *   2. Do hlavičky stránky přidej <ForensicToggle /> — přepínač jen mění
 *      adresu (URL nese režim, žádný localStorage), takže forenzní pohled
 *      je sdílitelný odkaz.
 *
 *   3. Kde má režim MĚNIT CHOVÁNÍ (ne jen barvy — polovičatý přepínač je
 *      zamítnutý vzor, viz BATCH-7 dodatek 28), konzumuj useForensicMode()
 *      a přepni datový pohled: výchozí filtr jen na ověřené záznamy,
 *      provenience přímo na ploše, stavy kontroly bez klikání. Referenční
 *      integrace: features/graph/VariantMapa.tsx (+ forensicView.ts —
 *      odvození pohledu je čistá testovaná funkce).
 *
 * Plátna kreslená do <canvas> si barvy nemohou vzít z CSS tříd — tokeny
 * forenzní vrstvy se čtou sondou (features/graph/stagePalette.ts), aby
 * existovala JEDNA definice barev v globals.css a žádná vidlice komponent.
 *
 * useSearchParams smí být během statického renderu čtený jen pod Suspense —
 * proto ho čte vnitřní můstek pod vlastní hranicí a poskytovatel drží stav;
 * server i první klientský render jedou s režimem vypnutým a atribut se
 * doplní efektem (týž kompromis jako data-poster-mode: kořenový atribut
 * bez zásahu do app/layout.tsx nelze vykreslit ze serveru).
 */

import { createContext, Suspense, useContext, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FORENSIC_ATTR, FORENSIC_VALUE, isForensic } from "./forensicMode";

const ForensicContext = createContext(false);

/** Je forenzní režim zapnutý? Mimo <ForensicProvider> vždy false. */
export function useForensicMode(): boolean {
  return useContext(ForensicContext);
}

/** Můstek: jediné místo, které čte useSearchParams (pod Suspense). */
function ParamBridge({ onChange }: { onChange: (on: boolean) => void }) {
  const params = useSearchParams();
  const on = isForensic(params);
  useEffect(() => {
    onChange(on);
  }, [on, onChange]);
  return null;
}

export default function ForensicProvider({ children }: { children: React.ReactNode }) {
  const [on, setOn] = useState(false);

  useEffect(() => {
    if (!on) return;
    document.documentElement.setAttribute(FORENSIC_ATTR, FORENSIC_VALUE);
    return () => document.documentElement.removeAttribute(FORENSIC_ATTR);
  }, [on]);

  return (
    <ForensicContext.Provider value={on}>
      <Suspense fallback={null}>
        <ParamBridge onChange={setOn} />
      </Suspense>
      {children}
    </ForensicContext.Provider>
  );
}
