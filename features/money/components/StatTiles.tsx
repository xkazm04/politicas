"use client";

/**
 * Agregátní pás /penize — jedna sázka dlaždic pro reálná i vzorová čísla. Vzniklo
 * rozdělením, ne přepisem: mock a reálná větev sázely tentýž grid a rozdíl byl jen v
 * datech, takže se markup nesměl duplikovat, když se mock stěhoval do vlastního chunku.
 *
 * Každá dlaždice nese vlastní `SourceNote` — pole `source` není volitelné.
 */

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import SourceNote from "@/features/shared/components/SourceNote";

export interface StatTileItem {
  label: string;
  value: string;
  sub: string;
  /** citace čísla — povinná, ne dekorace */
  source: string;
  /** druhá, kvalifikující věta (dnes jen vysvětlení dolní meze) */
  note?: string | null;
  /**
   * VÝHRADY k číslu — každá jiný druh nejistoty, proto seznam, ne jedna věta
   * (money batch 015; batch 014 tu měl jediné pole `excluded` a při třetí
   * výhradě by se buď slily, nebo by jedna z nich tiše zmizela).
   *
   * Dnes tři, každá jiným směrem: co je MIMO součet (smlouvy připsané jinému),
   * co je UVNITŘ a nadhodnocené (víc příjemců, nezveřejněné podíly), a o co se
   * číslo NEOPÍRÁ (rejstřík neuvádí vlastníka). Pořadí je pořadí vykreslení.
   */
  caveats?: readonly string[];
}

export default function StatTiles({ items }: { items: readonly StatTileItem[] }) {
  const tcom = useTranslations("common");
  return (
    <div className="grid gap-px border border-ink bg-ink sm:grid-cols-2 lg:grid-cols-4">
      {items.map((s, i) => (
        <motion.div
          key={s.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.06 }}
          className="bg-paper p-6"
        >
          <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-steel">{s.label}</p>
          <p className="mt-3 text-4xl font-black tabular-nums tracking-tight">{s.value}</p>
          <p className="mt-2 text-sm text-steel">{s.sub}</p>
          {s.note ? <p className="mt-2 border-l-2 border-ochre pl-2 text-sm text-steel">{s.note}</p> : null}
          {s.caveats?.length ? (
            <ul className="mt-2 space-y-1 border-l-2 border-steel pl-2">
              {s.caveats.map((c) => (
                <li key={c} className="text-sm text-steel">
                  {c}
                </li>
              ))}
            </ul>
          ) : null}
          <SourceNote className="mt-3 !text-[10px]">
            {tcom("sourcePrefix")} {s.source}
          </SourceNote>
        </motion.div>
      ))}
    </div>
  );
}
