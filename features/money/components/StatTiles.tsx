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
          <SourceNote className="mt-3 !text-[10px]">
            {tcom("sourcePrefix")} {s.source}
          </SourceNote>
        </motion.div>
      ))}
    </div>
  );
}
