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
 *
 * COPY JE V KATALOGU (2026-08-04): modul vrací KLÍČE do `overeni.*`
 * v messages/*.json a plocha je sází přes next-intl — zůstává tedy čistý,
 * testovatelný a dvojjazyčný zároveň.
 */

import { claimDataAttributes } from "@/lib/claims/claim";
import { ISSUED_FIGURES, type IssuedFigure } from "@/lib/claims/registry";
import { edgeClaimRef, claimRefPath } from "@/features/shared/provenance/claimRef";
import { encodeGraphRef } from "@/features/graph/permalink";
import { encodeExhibitId } from "@/features/dashboard/exhibit";

// ── Kroky návodu ────────────────────────────────────────────────────────────

export interface GuideStep {
  no: number;
  titleKey: string;
  bodyKey: string;
}

export const GUIDE_STEPS: readonly GuideStep[] = [1, 2, 3, 4].map((no) => ({
  no,
  titleKey: `guide.step${no}Title`,
  bodyKey: `guide.step${no}Body`,
}));

// ── Živé příklady ───────────────────────────────────────────────────────────

export interface GuideExample {
  family: "figura" | "zdroj" | "graf" | "exponat";
  /** Klíč titulku příkladu (`overeni.*`). Slouží i jako React key. */
  labelKey: string;
  input: string;
  /** Klíč poznámky pod příkladem. */
  noteKey: string;
  /** ICU parametry poznámky (živý příklad pojmenuje svou hranu). */
  noteValues?: Record<string, string>;
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
      labelKey: "guide.exFiguraPayloadLabel",
      input: figurePayloadExample(first),
      noteKey: "guide.exFiguraPayloadNote",
      live: true,
    });
    examples.push({
      family: "figura",
      labelKey: "guide.exFiguraRefLabel",
      input: first.claim.ref,
      noteKey: "guide.exFiguraRefNote",
      live: true,
    });
  }
  examples.push(
    live
      ? {
          family: "zdroj",
          labelKey: "guide.exZdrojLabel",
          input: claimRefPath(live.ref),
          noteKey: "guide.exZdrojNote",
          noteValues: { src: live.src, rel: live.rel, dst: live.dst },
          live: true,
        }
      : {
          family: "zdroj",
          labelKey: "guide.exZdrojIllustrativeLabel",
          input: claimRefPath(edgeClaimRef("osoba-priklad", "linked_to", "firma-priklad")),
          noteKey: "guide.exZdrojIllustrativeNote",
          live: false,
        },
  );
  examples.push({
    family: "graf",
    labelKey: "guide.exGrafIllustrativeLabel",
    input: `/graf/p/${encodeGraphRef({ kind: "trasa", variant: "mapa", trail: "penize-poslancu" }, "00000000")}`,
    noteKey: "guide.exGrafIllustrativeNote",
    live: false,
  });
  examples.push({
    family: "exponat",
    labelKey: "guide.exExponatIllustrativeLabel",
    input: `/dashboard/exponat/${encodeExhibitId({ kind: "rez", hash: "00000000" })}`,
    noteKey: "guide.exExponatIllustrativeNote",
    live: false,
  });
  return examples;
}

/** Ilustrační sada — fallback plochy, když se živá hrana nenačte. */
export const GUIDE_EXAMPLES: readonly GuideExample[] = buildExamples(null);

/** Všechny klíče, které návod umí vrátit — pro test úplnosti katalogu. */
export const GUIDE_COPY_KEYS: readonly string[] = [
  ...GUIDE_STEPS.flatMap((s) => [s.titleKey, s.bodyKey]),
  ...[
    ...buildExamples(null),
    ...buildExamples({ ref: "h.a.b.c", src: "a", rel: "linked_to", dst: "b" }),
  ].flatMap((e) => [e.labelKey, e.noteKey]),
];
