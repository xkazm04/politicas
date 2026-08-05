"use client";

/*
 * PŘEPÍNAČ VARIANT PLAYGROUNDU — dočasné lešení kola 3 (2026-07-26).
 *
 * Poučení z kol 1–2 (zapsané, aby se neopakovalo):
 *  - zamítnutí PROVEDENÍ není zamítnutí KONCEPTU — Atlas („ukaž mi celek")
 *    se sem vrací jako Mapa, protože smazat ho místo redesignu byla chyba;
 *  - plátno je stránka: žádné okno 60vh v dokumentu, stránka nescrolluje
 *    a graf dostane všechno kromě tenké hlavičky; chrome pluje nad plátnem;
 *  - veškerý text jde přes jednu režii popisků s kolizemi (GraphStage).
 *
 * Kolo 4: Ohnisko zamítnuto; Mapa se fúzuje s Trasami (trasa = čočka nad
 * krajinou celku), Trasy zůstávají beze změny jako srovnávací sazba.
 * Stránka opustila levou lištu aplikace (isBareRoute) — plátno potřebuje
 * celou šířku okna pro vlastní lišty; zpět vede drobeček v hlavičce.
 *
 * Až jeden vyhraje: přepínač i poražené soubory pryč. Texty doku jdou přes
 * katalog (graph.variants.*), i když jde o lešení — plocha je veřejná.
 */

import { useEffect, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import SourceNote from "@/features/shared/components/SourceNote";
import ForensicProvider from "@/features/shared/forensic/ForensicProvider";
import ForensicToggle from "@/features/shared/forensic/ForensicToggle";
import { useFormat } from "@/lib/i18n/useFormat";
import Link from "next/link";
import VariantMapa from "./VariantMapa";
import VariantTrasy from "./VariantTrasy";
import type { GraphSeed } from "./graphTypes";

const VARIANTS = [
  { key: "mapa", labelKey: "variants.mapa.label", hintKey: "variants.mapa.hint", Component: VariantMapa },
  { key: "trasy", labelKey: "variants.trasy.label", hintKey: "variants.trasy.hint", Component: VariantTrasy },
] as const;

type VariantKey = (typeof VARIANTS)[number]["key"];

const STORAGE_KEY = "politicas.graph.variant";
const isVariant = (v: string | null): v is VariantKey => VARIANTS.some((x) => x.key === v);

const listeners = new Set<() => void>();
let cached: VariantKey | null = null;

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

function getSnapshot(): VariantKey {
  if (cached === null) {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    cached = isVariant(saved) ? saved : "mapa";
  }
  return cached;
}

const getServerSnapshot = (): VariantKey => "mapa";

function choose(key: VariantKey) {
  cached = key;
  window.localStorage.setItem(STORAGE_KEY, key);
  for (const l of listeners) l();
}

export default function GraphPage({ seed }: { seed: GraphSeed | null }) {
  const t = useTranslations("graph");
  const f = useFormat();
  const variant = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement;
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return;
      const i = ["4", "5"].indexOf(e.key);
      if (i >= 0) choose(VARIANTS[i].key);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const active = VARIANTS.find((v) => v.key === variant) ?? VARIANTS[0];
  const Active = active.Component;

  return (
    // Stránka NESCROLLUJE — plátno je stránka. Hlavička je jeden tenký řádek.
    // ForensicProvider: /graf je referenční integrace forenzního režimu
    // (?rezim=forenzni) — viz features/shared/forensic/ForensicProvider.tsx.
    <ForensicProvider>
    <main className="flex h-screen min-h-0 flex-col overflow-hidden bg-paper font-sans text-ink">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b-4 border-ink px-4 py-2">
        <div className="flex min-w-0 items-baseline gap-3">
          <span className="shrink-0 font-mono text-[11px] uppercase tracking-widest text-steel">
            <Link href="/dashboard" className="transition-colors hover:text-signal">
              politicas
            </Link>{" "}
            / {t("page.headerTag")}
          </span>
          <h1 className="truncate text-base font-black uppercase tracking-tight">
            {t("page.title")}
            <span className="text-signal">.</span>
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {seed && (
            <SourceNote className="hidden shrink-0 sm:block">
              {t("counts", { nodes: f.int(seed.totalNodes), edges: f.int(seed.totalEdges) })}
            </SourceNote>
          )}
          <ForensicToggle />
        </div>
      </header>

      <div className="relative min-h-0 flex-1">
        {seed === null ? (
          <div className="absolute inset-0 flex items-center justify-center px-6 text-center">
            <p className="max-w-xl text-base leading-relaxed text-steel">{t("page.unavailable")}</p>
          </div>
        ) : (
          <Active seed={seed} />
        )}
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-3 print:hidden">
        <div className="pointer-events-auto flex max-w-full items-stretch gap-px overflow-x-auto border-2 border-ink bg-ink shadow-lg">
          <span className="hidden shrink-0 items-center bg-ink px-3 font-mono text-[11px] uppercase tracking-widest text-paper/50 sm:flex">
            {t("variants.strip")}
          </span>
          {VARIANTS.map((v, i) => {
            const on = v.key === variant;
            return (
              <button
                key={v.key}
                type="button"
                onClick={() => choose(v.key)}
                aria-pressed={on}
                title={`${t(v.hintKey)}  (${t("variants.keyTitle", { key: i + 4 })})`}
                className={`flex shrink-0 flex-col gap-0.5 px-4 py-1.5 text-left transition-colors ${
                  on ? "bg-signal text-paper" : "bg-paper text-ink hover:bg-paper-strong"
                }`}
              >
                <span className="font-mono text-[11px] font-bold uppercase tracking-widest">{t(v.labelKey)}</span>
                <span className={`max-w-56 truncate text-[11px] ${on ? "text-paper/80" : "text-steel"}`}>
                  {t(v.hintKey)}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </main>
    </ForensicProvider>
  );
}
