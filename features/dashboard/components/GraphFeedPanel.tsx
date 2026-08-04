"use client";

/*
 * Pás provozu grafu — telemetrie vedle přístroje. Kniha REÁLNÝCH datovaných
 * faktů o entitách výřezu. Vzorkový provoz je vlastní modul (./MockGraphFeedPanel),
 * který se načte, až když graf není k dispozici — dřív se jeho renderer i
 * výpočty vozily i na šťastné cestě.
 *
 * VYBRANÝ uzel v grafu panel profiltruje: nesouvisející řádky ztmavnou, ale
 * NEZMIZÍ. Zmizení by z filtru udělalo tvrzení („nic jiného se nestalo"),
 * ztmavnutí je jen zaostření.
 *
 * Panel čte VÝBĚR, ne náhled — hover nad uzlem seznamem nehýbe (viz
 * ../useGraphSelection.ts). Ztmavení je vizuální signál, takže ho ztmavený
 * řádek doprovodí i neviditelnou větou pro odečítačku, a banner filtru je
 * živá oblast: změna výběru se ohlásí, ne jen překreslí.
 */

import { useTranslations } from "next-intl";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useFormat } from "@/lib/i18n/useFormat";
import SourceNote from "@/features/shared/components/SourceNote";
import FactRow from "./FactRow";
import FeedPanelShell from "./FeedPanelShell";
import type { DatedFactLedger } from "../datedFacts";

export default function GraphFeedPanel({
  ledger,
  selected,
  selectedLabel,
  onPick,
  onClear,
}: {
  /** Kniha REÁLNÝCH datovaných faktů. */
  ledger: DatedFactLedger;
  /** Vybraný uzel — týž stav, jaký drží plátno a URL. */
  selected: string | null;
  selectedLabel: string | null;
  onPick: (nodeId: string) => void;
  onClear: () => void;
}) {
  const tf = useTranslations("dashboard.feed");
  const f = useFormat();

  const facts = ledger.facts;
  const matchCount = selected ? facts.filter((x) => x.refs.includes(selected)).length : facts.length;
  const filterLabel = selected ? (selectedLabel ?? selected) : null;

  return (
    <FeedPanelShell
      matchCount={matchCount}
      total={facts.length}
      selected={selected}
      filterLabel={filterLabel}
      onClear={onClear}
      headerLink={
        // Panel je OKNO — 12 faktů o entitách jednoho výřezu. Celý datovaný
        // proud republiky vede deník; bez tohohle odkazu se z okna stal slepý
        // konec. Vzorkový provoz odkaz nedostane: vedl by z vymyšlených
        // událostí na reálnou stránku.
        <Link
          href="/denik"
          className="inline-flex shrink-0 items-center gap-1 font-mono text-[11px] font-bold uppercase tracking-widest text-cobalt transition-colors hover:text-signal"
        >
          {tf("denikAll")} <ArrowUpRight className="h-3 w-3" aria-hidden />
        </Link>
      }
      footer={
        <>
          <SourceNote>{tf("realSource", { rows: f.int(ledger.considered) })}</SourceNote>
          <SourceNote className="mt-1">{tf("denikNote")}</SourceNote>
          {/* Nemožné datum se nikdy neopravuje ani mlčky nezahazuje — kniha
              přizná, kolik faktů kvůli němu vypadlo (vada ingesce, ne fakt). */}
          {ledger.droppedImplausible > 0 && (
            <SourceNote tone="signal" className="mt-1">
              {tf("droppedImplausible", { count: f.int(ledger.droppedImplausible) })}
            </SourceNote>
          )}
        </>
      }
    >
      {/* Prázdný stav je legitimní odpověď — v okně prostě není žádný datovaný
          fakt o entitách výřezu. Neplní se vzorkem. */}
      {facts.length === 0 && (
        <p className="px-4 py-8 text-center font-mono text-xs uppercase tracking-widest text-steel">
          {tf("emptyReal")}
        </p>
      )}
      {facts.map((fact) => (
        <FactRow
          key={fact.id}
          fact={fact}
          dim={selected !== null && !fact.refs.includes(selected)}
          filterLabel={filterLabel}
          onPick={onPick}
        />
      ))}
    </FeedPanelShell>
  );
}
