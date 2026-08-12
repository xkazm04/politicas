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
 * VÝJIMKA: když filtru nevyhovuje ANI JEDEN řádek, ztmavne jich dvanáct a
 * plocha neřekne nic — vizuální stav bez věty. Tehdy se místo nich vysází JEDNA
 * poctivá věta, která pojmenuje vybranou entitu a přizná mez okna (kniha nese
 * jen nejnovější fakta o entitách výřezu), plus odkaz do deníku té entity, kde
 * je celý proud. Odkaz se nabídne jen tehdy, když entita veřejný klíč MÁ —
 * strana a zákon ho nemají a `sliceNodeEntityKey` u nich vrací null, takže se
 * neslíbí doručení, které nikdo neumí splnit.
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
import type { ContractLayerRead, DatedFactLedger } from "../datedFacts";
import { denikEntityHref, sliceNodeEntityKey } from "../entityLinks";

export default function GraphFeedPanel({
  ledger,
  contracts,
  selected,
  selectedLabel,
  onPick,
  onClear,
}: {
  /** Kniha REÁLNÝCH datovaných faktů. */
  ledger: DatedFactLedger;
  /**
   * Jak dopadlo ČTENÍ smluvní vrstvy téhle knihy. Kniha se složí i bez smluv
   * (z rejstříkových rolí a kroků tisků) a nedá se na ní poznat, že jedna
   * vrstva chybí — proto se stav čtení přináší zvlášť a přiznává se u paty,
   * vedle věty o vyhozených nemožných datech. `null` = volající stav nehlásí.
   */
  contracts?: ContractLayerRead | null;
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
  // Veřejný klíč entity — jen pro uzly, které ho mají (pravidlo ../entityLinks.ts).
  const denikKey = selected ? sliceNodeEntityKey(selected) : null;

  return (
    <FeedPanelShell
      matchCount={matchCount}
      total={facts.length}
      selected={selected}
      filterLabel={filterLabel}
      onClear={onClear}
      emptySelection={
        // Prázdná KNIHA má vlastní větu (`emptyReal` níž) a ta je pravdivější:
        // tady nejde o vybranou entitu, ale o to, že výřez nemá fakt žádný.
        facts.length === 0 ? undefined : (
          <div className="px-4 py-8 text-center">
            <p className="text-[15px] leading-relaxed text-steel">
              {tf("emptySelection", { label: filterLabel ?? "", rows: f.int(facts.length) })}
            </p>
            {denikKey && (
              <Link
                href={denikEntityHref(denikKey)}
                className="mt-3 inline-flex items-center gap-1 font-mono text-[11px] font-bold uppercase tracking-widest text-cobalt transition-colors hover:text-signal"
              >
                {tf("emptySelectionDenik")} <ArrowUpRight className="h-3 w-3" aria-hidden />
              </Link>
            )}
          </div>
        )
      }
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
          {/* Které uzly řádek rozsvítí, je PRAVIDLO (../stateSlice.ts) — a filtr,
              jehož pravidlo se nevypisuje, je neprůhledný filtr. */}
          <SourceNote className="mt-1">{tf("filterRule")}</SourceNote>
          <SourceNote className="mt-1">{tf("denikNote")}</SourceNote>
          {/* Nemožné datum se nikdy neopravuje ani mlčky nezahazuje — kniha
              přizná, kolik faktů kvůli němu vypadlo (vada ingesce, ne fakt). */}
          {ledger.droppedImplausible > 0 && (
            <SourceNote tone="signal" className="mt-1">
              {tf("droppedImplausible", { count: f.int(ledger.droppedImplausible) })}
            </SourceNote>
          )}
          {/* Výpadek smluvní vrstvy: kniha níž stojí jen na rolích a tiscích a
              sama o sobě vypadá zdravě. Kolik smluv chybí, se nedopočítává. */}
          {contracts?.state === "failed" && (
            <SourceNote tone="signal" className="mt-1">
              {tf("contractsFailed")}
            </SourceNote>
          )}
          {/* Useknutí na stropu hran bylo do teď jen v logu operátora. Co zmizí,
              nezmizí náhodně — jsou to nejlevnější smlouvy nejzaměstnanějších
              firem, takže mlčení by z knihy dělalo tvrzení, že neexistují. */}
          {contracts?.state === "truncated" && (
            <SourceNote tone="signal" className="mt-1">
              {tf("contractsTruncated", {
                truncated: f.int(contracts.truncatedCompanies),
                companies: f.int(contracts.companies),
                cap: f.int(contracts.edgeCap),
              })}
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
