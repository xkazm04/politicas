"use client";

/*
 * /zdroj/[ref] — trvalá účtenka jednoho tvrzení, celá stránka je doklad.
 *
 * Galerijní sazba vzoru Exponátu: hlavička s drobečkem, plakátový titul,
 * SectionRule, tělo účtenky (týž ReceiptBody jako v kapsli) v orámované kartě
 * a citační patička s trvalou adresou + kopírováním. Strojově čitelný tvar
 * (schema.org/ClaimReview) sází server vedle této komponenty — viz page.tsx.
 *
 * Copy je záměrně česky přímo v komponentě (vzor ExhibitPage.tsx):
 * messages/*.json je sdílený soubor napříč paralelně stavěnými plochami.
 */

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check, Link2, Stamp } from "lucide-react";
import SectionRule from "@/features/shared/components/SectionRule";
import SourceNote from "@/features/shared/components/SourceNote";
import { claimRefPath } from "./claimRef";
import type { ProvenanceReceipt } from "./receipt";
import ReceiptBody from "./ReceiptBody";

/** Kopírování trvalé adresy s potvrzením — adresa se skládá až při kliknutí
 *  z window.location.origin, takže SSR nikdy nesází neznámý origin. */
function CopyReceiptLink({ path }: { path: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const reduceMotion = useReducedMotion();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const copy = async () => {
    const url = new URL(path, window.location.origin).toString();
    try {
      await navigator.clipboard.writeText(url);
      setState("copied");
    } catch (err) {
      // Clipboard API může být zakázané (permissions, http) — adresa je
      // vypsaná hned vedle, takže selhání jen pojmenujeme a necháme ruční cestu.
      console.error("účtenka: kopírování odkazu selhalo", err);
      setState("failed");
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 2600);
  };

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <button
        type="button"
        onClick={copy}
        className="inline-flex items-center gap-1.5 border border-ink px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-wider text-ink transition-colors hover:bg-paper-strong hover:text-signal focus-visible:outline focus-visible:outline-2 focus-visible:outline-cobalt"
      >
        <Link2 className="h-3.5 w-3.5" aria-hidden /> kopírovat odkaz
      </button>
      <span role="status" aria-live="polite" className="min-h-[1rem]">
        {state === "copied" && (
          <motion.span
            initial={reduceMotion ? false : { opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-1 font-mono text-xs font-bold uppercase tracking-wider text-cobalt"
          >
            <Check className="h-3.5 w-3.5" aria-hidden /> odkaz zkopírován
          </motion.span>
        )}
        {state === "failed" && (
          <span className="font-mono text-xs uppercase tracking-wider text-signal-deep">
            kopírování se nezdařilo — vyberte adresu níže ručně
          </span>
        )}
      </span>
    </div>
  );
}

function PageFrame({ children }: { children: React.ReactNode }) {
  const reduceMotion = useReducedMotion();
  return (
    <main className="min-h-screen bg-paper font-sans text-ink">
      <header className="border-b-4 border-ink">
        <div className="flex items-center justify-between gap-4 px-6 py-3.5">
          <span className="font-mono text-xs uppercase tracking-widest text-steel-aa">
            politicas / zdroj
          </span>
          <SourceNote className="hidden sm:block">
            znovuodvozeno ze znalostního grafu při každém zobrazení
          </SourceNote>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-6 pb-16">
        <div className="py-10">
          <p className="flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.25em] text-signal">
            <Stamp className="h-3.5 w-3.5" aria-hidden /> účtenka původu
          </p>
          <motion.h1
            initial={reduceMotion ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-2 text-4xl font-black uppercase leading-[0.95] tracking-tight sm:text-5xl"
          >
            Doklad k tvrzení<span className="text-signal">.</span>
          </motion.h1>
          <div className="mt-3 max-w-md">
            <SectionRule />
          </div>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-steel-aa">
            Každé číslo na politicas je dveře, ne tvrzení: tahle adresa nese celý identifikátor
            záznamu ve znalostním grafu a server z něj účtenku při každém zobrazení
            deterministicky odvodí znovu — záznam, jeho původ, stav lidské kontroly a registry,
            kde si ho ověříte sami.
          </p>
        </div>
        {children}
      </div>
    </main>
  );
}

export function ReceiptGonePage({ encodedRef }: { encodedRef: string }) {
  return (
    <PageFrame>
      <div className="border-2 border-ink bg-paper px-5 py-10 sm:px-8 sm:py-12">
        <p className="max-w-2xl text-2xl font-black leading-snug tracking-tight sm:text-3xl">
          Dnešní graf tohle tvrzení nenese<span className="text-signal">.</span>
        </p>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-steel-aa">
          Adresa je rozluštitelná, ale záznam v dnešním sestavení znalostního grafu není —
          mohl být přepočítán, zamítnut při kontrole, nebo se podkladová data změnila.
          Nic podobného se nedosazuje: účtenka buď doloží přesně citovaný záznam, nebo to řekne.
        </p>
        <SourceNote className="mt-6">adresa tvrzení: {encodedRef}</SourceNote>
      </div>
    </PageFrame>
  );
}

export default function ReceiptPage({ receipt }: { receipt: ProvenanceReceipt }) {
  const path = claimRefPath(receipt.ref);
  return (
    <PageFrame>
      <div className="border-2 border-ink bg-paper px-5 py-8 sm:px-8 sm:py-10">
        <ReceiptBody receipt={receipt} />
      </div>

      <footer className="mt-10 border-t-4 border-ink pt-6">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.25em] text-signal">
          citace
        </p>
        <div className="mt-4">
          <CopyReceiptLink path={path} />
          <p className="mt-2 break-all font-mono text-xs text-steel-aa">{path}</p>
        </div>
        <SourceNote className="mt-4">
          znalostní graf politicas — psp.cz · ares · registr smluv; stav lidské brány podle
          auditované kontroly (review_audit)
        </SourceNote>
      </footer>
    </PageFrame>
  );
}
