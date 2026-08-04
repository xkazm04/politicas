/*
 * JAK CITOVAT, ABY TO BYLO OVĚŘITELNÉ — obsah novinářského návodu /overeni.
 *
 * Čistý modul: kroky návodu a živé příklady adres. Příklady se NESKLÁDAJÍ
 * ručně — staví je tytéž kodeky, které adresy vydávají (lib/claims,
 * provenance/claimRef, graph/permalink, dashboard/exhibit), takže návod
 * nemůže zastarat, aniž by spadl test: každý příklad musí detekce rozpoznat
 * jako svou rodinu a figury musí projít bránou jako „ověřeno".
 *
 * ŽIVÝ vs ILUSTRAČNÍ (2026-08-04): příklad /zdroj/… se staví z hrany, kterou
 * plocha PRÁVĚ přečetla ze store (getGuideExample.ts) — dřív stál na
 * vymyšlených id, takže zkopírovaný z návodu vracel „Neznámý odkaz.".
 * Příklad, který brána dnes ověří, nese `live: true` a dostane na ploše
 * tlačítko kopírovat + odkaz ověřit; ilustrační TVAR adresy (otisk 00000000)
 * ho nedostane a poznámka to říká.
 */

import { claimDataAttributes } from "@/lib/claims/claim";
import { ISSUED_FIGURES, type IssuedFigure } from "@/lib/claims/registry";
import { edgeClaimRef, claimRefPath } from "@/features/shared/provenance/claimRef";
import { encodeGraphRef } from "@/features/graph/permalink";
import { encodeExhibitId } from "@/features/dashboard/exhibit";

// ── Kroky návodu ────────────────────────────────────────────────────────────

export interface GuideStep {
  no: number;
  title: string;
  body: string;
}

export const GUIDE_STEPS: readonly GuideStep[] = [
  {
    no: 1,
    title: "Citujte odkazem, ne opsaným číslem",
    body:
      "Každá plocha politicas vydává trvalou adresu: účtenku původu (/zdroj/…), citaci pohledu na graf (/graf/p/…) nebo exponát velína (/dashboard/exponat/…). Vložte do článku adresu — čtenář i tato brána z ní tvrzení kdykoli znovu odvodí.",
  },
  {
    no: 2,
    title: "U čísel kopírujte celý element, ne jen číslici",
    body:
      "Citovatelná čísla se vykreslují jako <data> element s atributy data-claim-*: nesou adresu figury, strojovou hodnotu, dataset i datum. Zkopírujte element ze zdrojového kódu stránky — brána pak porovná citovanou hodnotu s dnešní bajt po bajtu.",
  },
  {
    no: 3,
    title: "Uveďte datum získání a otisk",
    body:
      "Citační řádky ploch obsahují datum znovuodvození a otisk obsahu (fnv-1a/32). Otiskem se pozná, že se obsah od citace pohnul — to není chyba citace, ale vlastnost živého záznamu; brána ukáže obě strany.",
  },
  {
    no: 4,
    title: "Před vydáním projděte bránou",
    body:
      "Vložte odkaz sem na /overeni. Odpověď je vždy jedna ze tří: ověřeno, hodnota se pohnula (s oběma hodnotami a daty), nebo neznámý odkaz. Nic čtvrtého brána neříká.",
  },
];

// ── Živé příklady ───────────────────────────────────────────────────────────

export interface GuideExample {
  family: "figura" | "zdroj" | "graf" | "exponat";
  label: string;
  input: string;
  note: string;
  /**
   * true = tenhle vstup brána DNES opravdu ověří (figura z rejstříku, hrana
   * přečtená právě teď ze store). Jen takový příklad dostane tlačítko
   * „kopírovat" a odkaz „ověřit" — zvát ke zkopírování něčeho, co skončí na
   * „Neznámý odkaz.", je slepý konec v návodu o ověřitelnosti.
   * false = ilustrační TVAR adresy; poznámka to říká.
   */
  live: boolean;
}

const escapeAttr = (v: string): string =>
  v.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/** Zkopírovaný <data> element figury — přesně tvar, který sází CitableNumber. */
export function figurePayloadExample(fig: IssuedFigure): string {
  const attrs = claimDataAttributes(fig.claim, fig.value);
  const attrText = Object.entries(attrs)
    .map(([k, v]) => `${k}="${escapeAttr(v)}"`)
    .join(" ");
  return `<data value="${fig.value}" ${attrText}>…</data>`;
}

/** Živá hrana z dnešního grafu, kterou návod nabídne jako příklad /zdroj/…
 *  (features/overeni/getGuideExample.ts). null = store nedostupný → ilustrace. */
export interface LiveEdgeExample {
  ref: string;
  src: string;
  rel: string;
  dst: string;
}

export function buildExamples(live: LiveEdgeExample | null): GuideExample[] {
  const examples: GuideExample[] = [];
  const first = ISSUED_FIGURES[0];
  if (first) {
    examples.push({
      family: "figura",
      label: "figura — zkopírovaný element s data-claim-*",
      input: figurePayloadExample(first),
      note: "Nese adresu i hodnotu — brána porovná citovanou hodnotu s dnešní.",
      live: true,
    });
    examples.push({
      family: "figura",
      label: "figura — holý claim-ref",
      input: first.claim.ref,
      note: "Jen adresa figury: brána odpoví dnešním zněním tvrzení.",
      live: true,
    });
  }
  examples.push(
    live
      ? {
          family: "zdroj",
          label: "účtenka původu — hrana grafu",
          input: claimRefPath(live.ref),
          note: `Skutečná adresa z dnešního grafu: ${live.src} — ${live.rel} → ${live.dst}. Vybraná neutrálně — první hrana ${live.rel} v pořadí grafu, žádná míra. Vložte ji sem a brána odpoví, co o ní dnes ví, včetně stavu lidské kontroly.`,
          live: true,
        }
      : {
          family: "zdroj",
          label: "účtenka původu — hrana grafu (ilustrace)",
          input: claimRefPath(edgeClaimRef("osoba-priklad", "linked_to", "firma-priklad")),
          note: "Živý příklad se teď nedá načíst, tohle je jen TVAR adresy /zdroj/… — brána na něj odpoví „neznámý odkaz“. Skutečnou adresu vydává odkaz účtenka u každé vazby na /penize.",
          live: false,
        },
  );
  examples.push({
    family: "graf",
    label: "citace pohledu na graf (ilustrace)",
    input: `/graf/p/${encodeGraphRef({ kind: "trasa", variant: "mapa", trail: "penize-poslancu" }, "00000000")}`,
    note: "Ilustrační otisk 00000000 — skutečný vydává akce citovat na /graf.",
    live: false,
  });
  examples.push({
    family: "exponat",
    label: "exponát velína (ilustrace)",
    input: `/dashboard/exponat/${encodeExhibitId({ kind: "rez", hash: "00000000" })}`,
    note: "Ilustrační otisk 00000000 — skutečný vydává akce citovat ve velíně.",
    live: false,
  });
  return examples;
}

/** Ilustrační sada — fallback plochy, když se živá hrana nenačte. */
export const GUIDE_EXAMPLES: readonly GuideExample[] = buildExamples(null);
