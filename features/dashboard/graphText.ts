"use client";

// Popisky uzlů a hran přehledového grafu. `lib/civic/stateGraph.ts` drží jen
// topologii a souřadnice — text sem dotahujeme z i18n podle klíče entity, aby
// graf zůstal přeložitelný a nedržel duplikát už přeložených řetězců.
//
// Obě varianty (Konzole, Kartotéka) mluví TÍMTO slovníkem — jeden uzel se na
// obou plochách jmenuje stejně, jinak by to nebyl jeden graf.

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { LAW_CHANGES, MONEY_TIES, MPS, PARTIES } from "@/lib/civic/data";
import { compactCzk } from "@/features/money/moneyTypes";
import { formattersFor } from "@/lib/format";
import { defaultLocale, isLocale } from "@/lib/i18n/config";
import type { StateEdge, StateNode, StateNodeKind } from "@/lib/civic/stateGraph";

export interface NodeText {
  label: string;
  sub: string;
  /** Druh entity („poslanec", „firma", …) — do popisku a legendy. */
  kind: string;
}

/** Zkrátí popisek na šířku, kterou uzel unese, bez rozbití slova na půl znaku. */
export const trunc = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

export const NODE_FILL: Record<StateNodeKind, string> = {
  person: "fill-cobalt",
  company: "fill-ink",
  money: "fill-signal",
  party: "fill-steel",
  vote: "fill-ink",
  bill: "fill-ink",
  law: "fill-ochre",
};

export function useGraphText() {
  const tc = useTranslations("content");
  const tg = useTranslations("dashboard.graph");
  const rawLocale = useLocale();
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;

  return useMemo(() => {
    const f = formattersFor(locale);

    /**
     * Uzel z REÁLNÉHO výřezu si text nese sám (jméno poslance ani název firmy
     * není překlad). Čísla ale ne — ta jdou z loaderu jako čísla a formátují se
     * až tady, podle locale; jinak by server sázel české čárky do anglické
     * verze. Stav „čeká na kontrolu" se lepí na uzel, aby ho čtenář viděl na
     * obrázku, ne až v citaci pod ním.
     */
    const carried = (n: StateNode): NodeText => {
      const money = n.czk !== undefined ? compactCzk(n.czk, locale) : null;
      const parts = [
        n.kind === "money" && n.count !== undefined ? tg("contractCount", { count: f.int(n.count) }) : null,
        n.kind !== "money" ? n.sub : null,
        n.kind === "party" && money ? tg("donatedSub", { czk: money }) : null,
        n.pending ? tg("pendingShort") : null,
      ].filter(Boolean);
      return {
        label: n.kind === "money" && money ? money : (n.label ?? n.id),
        sub: parts.join(" · "),
        kind: tg(`kinds.${n.kind}`),
      };
    };

    const node = (n: StateNode): NodeText => {
      if (n.label !== undefined) return carried(n);
      switch (n.kind) {
        case "person": {
          const mp = MPS.find((m) => m.id === n.mpId);
          return { label: mp?.name ?? n.mpId, sub: mp?.party ?? "", kind: tg("kinds.person") };
        }
        case "company":
          // `tie` je index do vzorku; u reálného uzlu chybí, ale ten sem nedojde
          // (odchytí ho `carried` výš). Guard je tu proto, aby to platilo i
          // kdyby někdo poslal uzel bez popisku i bez indexu — radši id než pád.
          if (n.tie === undefined) return { label: n.id, sub: "", kind: tg("kinds.company") };
          return {
            label: tc(`moneyTies.${n.tie}.company`),
            sub: `IČO ${MONEY_TIES[n.tie].ico}`,
            kind: tg("kinds.company"),
          };
        case "money":
          if (n.tie === undefined) return { label: n.id, sub: "", kind: tg("kinds.money") };
          return {
            label: tc(`moneyTies.${n.tie}.amount`),
            sub: MONEY_TIES[n.tie].year,
            kind: tg("kinds.money"),
          };
        case "bill":
          // Sněmovní tisk existuje jen v reálném výřezu — tam vždy nese `label`.
          return { label: n.id, sub: "", kind: tg("kinds.bill") };
        case "party": {
          const p = PARTIES.find((x) => x.code === n.partyCode);
          return { label: p?.name ?? n.partyCode, sub: tg("kinds.party"), kind: tg("kinds.party") };
        }
        case "vote":
          return {
            label: tc(`rollCalls.${n.rollCallId}.tisk`),
            sub: tc(`rollCalls.${n.rollCallId}.title`),
            kind: tg("kinds.vote"),
          };
        case "law": {
          const lc = LAW_CHANGES.find((x) => x.id === n.lawChangeId);
          return {
            label: tc(`lawChanges.${n.lawChangeId}.lawRef`),
            sub: lc ? tc(`lawChanges.${n.lawChangeId}.paragraph`) : "",
            kind: tg("kinds.law"),
          };
        }
      }
    };

    // Hrana osoba↔firma nese přeložený druh vazby ze samotných dat („statutární
    // orgán (od 03/2019)"), ostatní obecný vztah — konkrétní fakt je silnější.
    // Reálná hrana nese roli z rejstříku doslova („člen správní rady"), vzorková
    // přeložený druh vazby; obojí je konkrétnější než obecný vztah, a ten je
    // poslední záchrana. Dar navíc ukáže částku — číslo formátujeme až tady.
    const edge = (e: StateEdge) => {
      const base = e.label ?? (e.tie !== undefined ? tc(`moneyTies.${e.tie}.kind`) : tg(`rel.${e.rel}`));
      return e.czk !== undefined ? `${base} ${compactCzk(e.czk, locale)}` : base;
    };

    return { node, edge };
  }, [tc, tg, locale]);
}

/** Barva strany je datový údaj — malý čip u uzlu osoby, nikdy plocha. */
export const partyChip = (mpId: string) => MPS.find((m) => m.id === mpId)?.partyColor;
