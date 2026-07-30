/*
 * JAK CITOVAT, ABY TO BYLO OVĚŘITELNÉ — obsah novinářského návodu /overeni.
 *
 * Čistý modul: kroky návodu a živé příklady adres. Příklady se NESKLÁDAJÍ
 * ručně — staví je tytéž kodeky, které adresy vydávají (lib/claims,
 * provenance/claimRef, graph/permalink, dashboard/exhibit), takže návod
 * nemůže zastarat, aniž by spadl test: každý příklad musí detekce rozpoznat
 * jako svou rodinu a figury musí projít bránou jako „ověřeno".
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

function buildExamples(): GuideExample[] {
  const examples: GuideExample[] = [];
  const first = ISSUED_FIGURES[0];
  if (first) {
    examples.push({
      family: "figura",
      label: "figura — zkopírovaný element s data-claim-*",
      input: figurePayloadExample(first),
      note: "Nese adresu i hodnotu — brána porovná citovanou hodnotu s dnešní.",
    });
    examples.push({
      family: "figura",
      label: "figura — holý claim-ref",
      input: first.claim.ref,
      note: "Jen adresa figury: brána odpoví dnešním zněním tvrzení.",
    });
  }
  examples.push({
    family: "zdroj",
    label: "účtenka původu — hrana grafu",
    input: claimRefPath(edgeClaimRef("osoba-priklad", "linked_to", "firma-priklad")),
    note: "Ilustrační tvar adresy /zdroj/… — skutečnou vydává tlačítko účtenky u citace.",
  });
  examples.push({
    family: "graf",
    label: "citace pohledu na graf",
    input: `/graf/p/${encodeGraphRef({ kind: "trasa", variant: "mapa", trail: "penize-poslancu" }, "00000000")}`,
    note: "Ilustrační otisk 00000000 — skutečný vydává akce citovat na /graf.",
  });
  examples.push({
    family: "exponat",
    label: "exponát velína",
    input: `/dashboard/exponat/${encodeExhibitId({ kind: "rez", hash: "00000000" })}`,
    note: "Ilustrační otisk 00000000 — skutečný vydává akce citovat ve velíně.",
  });
  return examples;
}

export const GUIDE_EXAMPLES: readonly GuideExample[] = buildExamples();
