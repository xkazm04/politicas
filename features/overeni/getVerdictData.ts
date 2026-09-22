// Server-only: znovuodvození pro Civic Claim Gate (/overeni).
//
// Brána sama NIC neodvozuje — každou rodinu adres posílá do jejího
// vlastnického loaderu (getReceiptData, getPermalinkData, getExhibitData,
// lib/claims/registry) a jeho odpověď překládá čistým verdict.ts do jednoho
// slovníku. Žádný zápis, žádný nový dotaz navíc proti tomu, co by stálo
// otevření plné plochy rodiny.
//
// Degradace drží konvenci loaderů: nedostupný store → "unavailable"
// (DataUnavailable, nikdy „neznámý odkaz" — to by byla nepravda).

import "server-only";
import { LIVE_AS_OF, parseAsOfDay, type ReceiptAsOf } from "@/features/shared/provenance/asOfLens";
import { getReceiptData } from "@/features/shared/provenance/getReceiptData";
import { getPermalinkData } from "@/features/graph/getPermalinkData";
import { getExhibitData } from "@/features/dashboard/getExhibitData";
import { resolveClaimRef } from "@/lib/claims/registry";
import { resolveLiveFigure } from "./liveFigures";
import { detectRef, type DetectedRef } from "./refDetect";
import {
  exponatVerdict,
  figuraGoneVerdict,
  figuraVerdict,
  grafVerdict,
  neznamyVerdict,
  zdrojVerdict,
  type GateVerdict,
} from "./verdict";

export type GateData =
  | { status: "empty" }
  | { status: "unavailable" }
  | {
      status: "ok";
      detected: DetectedRef;
      verdict: GateVerdict;
      /** Co brána udělala s `&k=` — banner nad verdiktem (asOfLens.ts). */
      asOf: ReceiptAsOf;
    };

export async function getVerdictData(
  rawInput: string | null,
  /** `&k=YYYY-MM-DD`: „a co jste tvrdili TOHO DNE?". Neplatný den je ODMÍTNUT. */
  asOfParam?: string | null,
): Promise<GateData> {
  if (rawInput === null || rawInput.trim() === "") return { status: "empty" };
  const detected = detectRef(rawInput);

  const asked = typeof asOfParam === "string" && asOfParam.trim() !== "" ? asOfParam.trim() : null;
  const day = parseAsOfDay(asked);
  // Odmítnutí platí pro VŠECHNY rodiny stejně: adresu ani datum neopravujeme.
  const refused: ReceiptAsOf | null = asked !== null && day === null ? { state: "refused", raw: asked } : null;
  /* Rodina, která se k dni přehrát neumí, to musí ŘÍCT. Odvozené figury
   * (/penize, /zebricek, /zakony) se počítají skrz vlastnické loadery nad
   * dnešním store, ne přímo z historie grafu, takže „co jsme toho dne
   * zveřejnili" pro ně zatím neumíme spočítat — a mlčení by se četlo jako
   * „nic tam nebylo". */
  const notReplayable: ReceiptAsOf = day !== null ? { state: "notReplayable", day } : LIVE_AS_OF;
  const lensForFamiliesWithoutReplay = refused ?? notReplayable;

  switch (detected.family) {
    case "figura": {
      // Dvě rodiny figur, jeden verdikt. Rejstřík (lib/claims/registry) je čistý
      // modul nad vzorkovou vrstvou a ověřuje se i bez běžícího store; ŽIVÁ
      // figura (peněžní číslo /penize) se znovu odvozuje vlastnickým loaderem —
      // ./liveFigures.ts. Pořadí je dané: rejstřík je konečný výčet tří figur,
      // takže se ptáme napřed jeho a store obtěžujeme jen tehdy, když ref nezná.
      const issued = resolveClaimRef(detected.ref);
      if (issued) {
        return { status: "ok", detected, verdict: figuraVerdict(detected, issued), asOf: lensForFamiliesWithoutReplay };
      }

      const live = await resolveLiveFigure(detected.parts);
      // Nedostupný store NENÍ verdikt o odkazu — figura by jinak dostala
      // „rejstřík ji nezná", což je o živém čísle nepravda.
      if (live.status === "unavailable") return { status: "unavailable" };
      // Živá adresa, kterou dnešní odvození nenese, není „figuru neznáme":
      // vydali jsme ji, jen za ní dnes žádný záznam nestojí.
      if (live.status === "gone") {
        return {
          status: "ok",
          detected,
          verdict: figuraGoneVerdict(detected.ref),
          asOf: lensForFamiliesWithoutReplay,
        };
      }
      const figure = live.status === "ok" ? live.figure : null;
      return {
        status: "ok",
        detected,
        verdict: figuraVerdict(detected, figure),
        asOf: lensForFamiliesWithoutReplay,
      };
    }

    case "zdroj": {
      // Dvě čtení místo jednoho JEN když se čtenář na den ptal: dnešní záznam
      // (druhý sloupec) a záznam k tomu dni (prostřední). Obě jdou přes
      // getReceiptData — brána si žádné vlastní čtení grafu nepíše.
      const [result, thenResult] = await Promise.all([
        getReceiptData(detected.encoded),
        day === null ? null : getReceiptData(detected.encoded, day),
      ]);
      if (result.status === "unavailable") return { status: "unavailable" };
      const then =
        thenResult === null || thenResult.status === "unavailable" || thenResult.status === "invalid"
          ? null
          : {
              asOf: thenResult.asOf,
              // `at` je jediný stav, ve kterém je co ukázat; u ostatních nese
              // ThenSide jen důvod, proč sloupec zůstal prázdný.
              receipt:
                thenResult.status === "ok" && thenResult.asOf.state === "at" ? thenResult.receipt : null,
            };
      return {
        status: "ok",
        detected,
        verdict: zdrojVerdict(detected.encoded, result, then),
        asOf: refused ?? then?.asOf ?? LIVE_AS_OF,
      };
    }

    case "graf": {
      const result = await getPermalinkData(detected.encoded);
      if (result.status === "unavailable") return { status: "unavailable" };
      const lookup =
        result.status === "ok"
          ? {
              status: "ok" as const,
              view: result.view,
              title: result.view.title,
              currentDate: result.view.retrievedOn,
            }
          : { status: result.status };
      return {
        status: "ok",
        detected,
        verdict: grafVerdict(detected.encoded, lookup),
        asOf: lensForFamiliesWithoutReplay,
      };
    }

    case "exponat": {
      const result = await getExhibitData(detected.encoded);
      if (result.status === "unavailable") return { status: "unavailable" };
      const lookup =
        result.status === "ok"
          ? {
              status: "ok" as const,
              view: result,
              // Titulek exponátu skládá BRÁNA, ne rodina — jde tedy klíčem do
              // katalogu (messages `overeni.*`), ne českou literálou.
              title: null,
              titleKey: result.kind === "rez" ? "row.exhibitRez" : "row.exhibitFakt",
              currentDate: result.builtOn,
            }
          : result.status === "gone"
            ? { status: "gone" as const }
            : { status: "invalid" as const };
      return {
        status: "ok",
        detected,
        verdict: exponatVerdict(detected.encoded, lookup),
        asOf: lensForFamiliesWithoutReplay,
      };
    }

    case "neznamy":
      // Neznámý odkaz nedostane věty o čase záznamu: není o čem.
      return { status: "ok", detected, verdict: neznamyVerdict(detected.reason), asOf: LIVE_AS_OF };
  }
}
