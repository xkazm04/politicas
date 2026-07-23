"use client";

/** Levá polovina hero — hlavní zpráva („Změřená republika") + hemicykl. */

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import SourceNote from "@/features/shared/components/SourceNote";
import Hemicycle from "./Hemicycle";

export default function HeroStory() {
  return (
    <div className="border-b border-hairline py-14 lg:border-b-0 lg:border-r lg:pr-12">
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="font-mono text-xs uppercase tracking-[0.3em] text-signal"
      >
        obr. 1 — hlavní zpráva · 9. volební období
      </motion.p>
      <motion.h1
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.06 }}
        className="mt-6 text-6xl font-black uppercase leading-[0.95] tracking-tight sm:text-7xl"
      >
        Změřená
        <br />
        <span className="text-signal">republika</span>
      </motion.h1>
      <motion.p
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.16 }}
        className="mt-6 max-w-md text-base leading-relaxed text-steel"
      >
        Každý odevzdaný hlas, každá koruna veřejných peněz, každý změněný paragraf
        zákona — spojené do jednoho skóre pro každého politika. Ne názor: index se
        zveřejněnými váhami, kde každé číslo cituje veřejný dataset, ze kterého vzniklo.
      </motion.p>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.26 }}
        className="mt-8 flex flex-wrap gap-3"
      >
        <a
          href="#k-zebricek"
          className="inline-flex items-center gap-2 bg-ink px-6 py-3.5 text-sm font-black uppercase tracking-wider text-paper transition-transform hover:-translate-y-0.5"
        >
          Žebříček <ArrowRight className="h-4 w-4" />
        </a>
        <a
          href="#k-metoda"
          className="inline-flex items-center gap-2 border-2 border-cobalt px-6 py-3.5 text-sm font-black uppercase tracking-wider text-cobalt transition-colors hover:bg-cobalt hover:text-paper"
        >
          Metodika
        </a>
      </motion.div>

      {/* hemicykl — hlavní zpráva přeložená do bodů */}
      <div className="mt-14">
        <Hemicycle />
        <div className="mt-2 flex items-center justify-between gap-4">
          <SourceNote>obr. 2 — 200 křesel sněmovny podle pásma skóre</SourceNote>
          <SourceNote tone="signal" className="hidden shrink-0 sm:block">
            ● psp.cz · hlídač státu
          </SourceNote>
        </div>
      </div>
    </div>
  );
}
