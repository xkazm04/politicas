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
import { detectRef, type DetectedRef } from "./refDetect";
import {
  exponatVerdict,
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
    case "figura":
      // Rejstřík je čistý modul — figura se ověřuje i bez běžícího store.
      return { status: "ok", detected, verdict: figuraVerdict(detected, resolveClaimRef(detected.ref)) };

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
              title: result.kind === "rez" ? "výřez velína (stav republiky)" : "datovaný fakt z knihy velína",
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
