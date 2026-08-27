"use client";

/*
 * „Kde volíte?" — dva comboboxy (obec nad rejstříkem 6 254 obcí, kraj nad
 * 14řádkovým crosswalkem) a odkaz na celou sněmovnu. Jediná klientská
 * komponenta plochy: interakce je výběr, všechno ostatní je RSC.
 *
 * Řazení obcí zůstává v `searchMunicipalities` (features/budget/mirrorData —
 * týž rejstřík jako /rozpocty, žádná druhá kopie); kraje se hledají bez
 * diakritiky přes `foldCzech` z téhož modulu (`asciiFold` v lib/ingest/normalize
 * neexistuje — brief ho předpokládal). Comboboxy jsou katalogový primitiv `Combobox`.
 * Nevykresluje se tu žádné číslo (počet obyvatel schválně ne — řádek by pak
 * potřeboval citaci, kterou nese karta obce).
 */

import { useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowUpRight } from "lucide-react";
import Combobox from "@/features/shared/components/Combobox";
import { foldCzech, searchMunicipalities, type Municipality } from "@/features/budget/mirrorData";
import type { KrajRow } from "@/lib/analysis/volby/types";

const RESULT_LIMIT = 40;

const obecKey = (m: Municipality) => m.ic;
const obecLabel = (m: Municipality) => m.name;
const obecGroup = (m: Municipality) => m.krajName;
const krajKey = (k: KrajRow) => k.slug;
const krajLabel = (k: KrajRow) => k.name;

function searchKraje(query: string, items: readonly KrajRow[], limit: number): KrajRow[] {
  const q = foldCzech(query.trim());
  const hits = q === "" ? items : items.filter((k) => foldCzech(k.name).includes(q));
  return hits.slice(0, limit);
}

export default function VolbyLookup({ registry, kraje }: { registry: readonly Municipality[]; kraje: readonly KrajRow[] }) {
  const t = useTranslations("volby.lookup");
  const router = useRouter();

  const searchObce = useCallback(
    (query: string, items: readonly Municipality[], limit: number) => searchMunicipalities(items, query, limit),
    [],
  );

  return (
    <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr_auto]">
      <div>
        <p className="mb-2 font-mono text-[11px] font-bold uppercase tracking-widest text-steel-aa">{t("obecHint")}</p>
        <Combobox
          label={t("obecLabel")}
          placeholder={t("obecPlaceholder")}
          resultsLabel={t("obecResults")}
          emptyLabel={t("obecEmpty")}
          items={registry}
          getKey={obecKey}
          getLabel={obecLabel}
          getGroup={obecGroup}
          search={searchObce}
          limit={RESULT_LIMIT}
          onSelect={(m) => router.push(`/volby/obec/${m.ic}`)}
          renderItem={(m, active) => (
            <span className="min-w-0">
              <span className="text-sm font-black uppercase tracking-tight">{m.name}</span>
              <span className={`ml-2 font-mono text-[11px] ${active ? "text-paper/70" : "text-steel-aa"}`}>
                {t("districtAbbr", { county: m.county })}
              </span>
            </span>
          )}
        />
      </div>
      <div>
        <p className="mb-2 font-mono text-[11px] font-bold uppercase tracking-widest text-steel-aa">{t("krajHint")}</p>
        <Combobox
          label={t("krajLabel")}
          placeholder={t("krajPlaceholder")}
          resultsLabel={t("krajResults")}
          emptyLabel={t("krajEmpty")}
          items={kraje}
          getKey={krajKey}
          getLabel={krajLabel}
          search={searchKraje}
          limit={kraje.length}
          onSelect={(k) => router.push(`/volby/kraj/${k.slug}`)}
        />
      </div>
      <div className="flex flex-col justify-end">
        <p className="mb-2 font-mono text-[11px] font-bold uppercase tracking-widest text-steel-aa">{t("chamberHint")}</p>
        <Link
          href="/volby/snemovna"
          className="inline-flex items-center justify-center gap-2 border-2 border-ink bg-ink px-5 py-3 text-sm font-black uppercase tracking-tight text-paper transition-colors hover:bg-signal-deep"
        >
          {t("chamber")}
          <ArrowUpRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    </div>
  );
}
