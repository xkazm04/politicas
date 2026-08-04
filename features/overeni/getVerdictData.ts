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
  | { status: "ok"; detected: DetectedRef; verdict: GateVerdict };

export async function getVerdictData(rawInput: string | null): Promise<GateData> {
  if (rawInput === null || rawInput.trim() === "") return { status: "empty" };
  const detected = detectRef(rawInput);

  switch (detected.family) {
    case "figura": {
      // Dvě rodiny figur, jeden verdikt. Rejstřík (lib/claims/registry) je čistý
      // modul nad vzorkovou vrstvou a ověřuje se i bez běžícího store; ŽIVÁ
      // figura (peněžní číslo /penize) se znovu odvozuje vlastnickým loaderem —
      // ./liveFigures.ts. Pořadí je dané: rejstřík je konečný výčet tří figur,
      // takže se ptáme napřed jeho a store obtěžujeme jen tehdy, když ref nezná.
      const issued = resolveClaimRef(detected.ref);
      if (issued) return { status: "ok", detected, verdict: figuraVerdict(detected, issued) };

      const live = await resolveLiveFigure(detected.parts);
      // Nedostupný store NENÍ verdikt o odkazu — figura by jinak dostala
      // „rejstřík ji nezná", což je o živém čísle nepravda.
      if (live.status === "unavailable") return { status: "unavailable" };
      // Živá adresa, kterou dnešní odvození nenese, není „figuru neznáme":
      // vydali jsme ji, jen za ní dnes žádný záznam nestojí.
      if (live.status === "gone") {
        return { status: "ok", detected, verdict: figuraGoneVerdict(detected.ref) };
      }
      const figure = live.status === "ok" ? live.figure : null;
      return { status: "ok", detected, verdict: figuraVerdict(detected, figure) };
    }

    case "zdroj": {
      const result = await getReceiptData(detected.encoded);
      if (result.status === "unavailable") return { status: "unavailable" };
      return { status: "ok", detected, verdict: zdrojVerdict(detected.encoded, result) };
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
      return { status: "ok", detected, verdict: grafVerdict(detected.encoded, lookup) };
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
      return { status: "ok", detected, verdict: exponatVerdict(detected.encoded, lookup) };
    }

    case "neznamy":
      return { status: "ok", detected, verdict: neznamyVerdict(detected.reason) };
  }
}
