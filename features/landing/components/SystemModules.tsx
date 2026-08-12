"use client";

/** Systém 01–05 — pět nástrojů nad jedním grafem, geometrické glyfy.
 *  Řádky nabíhají zleva po scrollu; při `prefers-reduced-motion` se vysází
 *  rovnou na místě (2026-08-12; týž zápis jako RealDisciplineBoard). */

import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { MODULES } from "@/lib/civic/data";

/** Modul → geometrický glyf. Sutnarovské tvary, ne ikony. */
function ModuleGlyph({ index }: { index: number }) {
  const common = { className: "h-12 w-12 shrink-0" };
  switch (index) {
    case 0:
      return (
        <svg viewBox="0 0 48 48" {...common} aria-hidden>
          <circle cx="24" cy="24" r="20" className="fill-signal" />
          <circle cx="24" cy="24" r="8" className="fill-paper" />
        </svg>
      );
    case 1:
      return (
        <svg viewBox="0 0 48 48" {...common} aria-hidden>
          <path d="M4 24a20 20 0 0 1 40 0Z" className="fill-cobalt" />
          <path d="M4 24a20 20 0 0 0 40 0Z" className="fill-ink" opacity="0.15" />
        </svg>
      );
    case 2:
      return (
        <svg viewBox="0 0 48 48" {...common} aria-hidden>
          <line x1="10" y1="38" x2="38" y2="10" className="stroke-ink" strokeWidth="3" />
          <circle cx="10" cy="38" r="7" className="fill-signal" />
          <circle cx="38" cy="10" r="7" className="fill-cobalt" />
        </svg>
      );
    case 3:
      return (
        <svg viewBox="0 0 48 48" {...common} aria-hidden>
          <rect x="6" y="26" width="9" height="18" className="fill-cobalt" />
          <rect x="19" y="14" width="9" height="30" className="fill-signal" />
          <rect x="32" y="20" width="9" height="24" className="fill-ink" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 48 48" {...common} aria-hidden>
          <path d="M24 6 44 42 4 42Z" className="fill-signal" />
          <path d="M24 20 34 38 14 38Z" className="fill-paper" />
        </svg>
      );
  }
}

export default function SystemModules() {
  const t = useTranslations("landing");
  const tc = useTranslations("content");
  const reduceMotion = useReducedMotion();
  return (
    <section id="k-system" className="border-t-4 border-ink">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-4xl font-black uppercase tracking-tight sm:text-5xl">
          {t("systemTitlePart1")}<span className="text-signal">.</span> {t("systemTitlePart2")}<span className="text-signal">.</span>
        </h2>
        <p className="mt-3 max-w-2xl text-steel-aa">
          {t("systemIntro")}
        </p>
        <div className="mt-10 border-t border-ink">
          {MODULES.map((m, i) => (
            <motion.a
              key={m.key}
              href={m.href ?? "#"}
              initial={reduceMotion ? false : { opacity: 0, x: -16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ delay: reduceMotion ? 0 : i * 0.05 }}
              className="group grid grid-cols-[3rem_3.5rem_1fr_auto] items-center gap-5 border-b border-hairline py-6 transition-colors hover:bg-paper-strong sm:grid-cols-[3.5rem_4rem_1fr_auto]"
            >
              <span className={`font-mono text-2xl font-bold ${i === 0 ? "text-signal" : "text-steel-aa"}`}>
                0{i + 1}
              </span>
              <ModuleGlyph index={i} />
              <span>
                <span className="block text-2xl font-black uppercase tracking-tight">{m.name}</span>
                <span className="mt-1 block text-sm text-steel-aa">{tc(`modules.${m.key}.description`)}</span>
              </span>
              {/* Metriky modulů (počty hlasování, mld Kč…) byly ilustrativní
                  mock — smyšlená čísla titulní strana nevykresluje. Reálné
                  metriky nese každý modul na své vlastní ploše. */}
              <ArrowRight className="h-6 w-6 text-signal transition-transform group-hover:translate-x-1" />
            </motion.a>
          ))}
        </div>
      </div>
    </section>
  );
}
