"use client";

// Popisky uzlů a hran přehledového grafu. `lib/civic/stateGraph.ts` drží jen
// topologii a souřadnice — text sem dotahujeme z i18n podle klíče entity, aby
// graf zůstal přeložitelný a nedržel duplikát už přeložených řetězců.
//
// Obě varianty (Konzole, Kartotéka) mluví TÍMTO slovníkem — jeden uzel se na
// obou plochách jmenuje stejně, jinak by to nebyl jeden graf.

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { LAW_CHANGES, MONEY_TIES, MPS, PARTIES } from "@/lib/civic/data";
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
  law: "fill-ochre",
};

export function useGraphText() {
  const tc = useTranslations("content");
  const tg = useTranslations("dashboard.graph");

  return useMemo(() => {
    const node = (n: StateNode): NodeText => {
      switch (n.kind) {
        case "person": {
          const mp = MPS.find((m) => m.id === n.mpId);
          return { label: mp?.name ?? n.mpId, sub: mp?.party ?? "", kind: tg("kinds.person") };
        }
        case "company":
          return {
            label: tc(`moneyTies.${n.tie}.company`),
            sub: `IČO ${MONEY_TIES[n.tie].ico}`,
            kind: tg("kinds.company"),
          };
        case "money":
          return {
            label: tc(`moneyTies.${n.tie}.amount`),
            sub: MONEY_TIES[n.tie].year,
            kind: tg("kinds.money"),
          };
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
    const edge = (e: StateEdge) => (e.tie !== undefined ? tc(`moneyTies.${e.tie}.kind`) : tg(`rel.${e.rel}`));

    return { node, edge };
  }, [tc, tg]);
}

/** Barva strany je datový údaj — malý čip u uzlu osoby, nikdy plocha. */
export const partyChip = (mpId: string) => MPS.find((m) => m.id === mpId)?.partyColor;
