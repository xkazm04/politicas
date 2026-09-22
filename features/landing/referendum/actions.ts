"use server";

// Server action referenda o metodice (moonshot 7B) — druhá zápisová cesta
// platformy po review konzoli, a záměrně ta nejužší možná: jeden INSERT
// anonymního vektoru vah do `lens_submission` přes LensSubmissionRepository
// (jediný writer té tabulky). Žádný token: hlas je veřejná, anonymní,
// bezúčtová akce — ochranou proti zkreslení není brána, ale k-anonymitní
// práh + přiznaný sebevýběr (viz aggregate.ts). Akce nikdy nemaže data.
//
// Validace: decodeWeights uvnitř repozitáře (kodek z features/civicscore/
// lens.ts). Neplatný vektor → "invalid", nikdy tichá oprava.

import { revalidatePath } from "next/cache";
import { decodeWeights } from "@/features/civicscore/lens";
import { getWeightsRepo } from "@/lib/db/pglite/repositories/weights";
import { carriesLens, deriveWeightAggregate, type WeightAggregate } from "./aggregate";

export type SubmitLensResult =
  | { status: "ok"; aggregate: WeightAggregate }
  | { status: "invalid" }
  /** Store neběží (sample-data režim) — poctivě přiznáno, nic se nepředstírá. */
  | { status: "unavailable" };

export async function submitLensVector(raw: string): Promise<SubmitLensResult> {
  // Tvrdá mez délky před jakoukoli prací: kanonický vektor má ≤ 23 znaků.
  if (typeof raw !== "string" || raw.length > 64) return { status: "invalid" };
  // Vektor bez čočky (součet 0) agregát nikdy nezapočítá (aggregate.ts, pravidlo
  // č. 1) — přijmout ho u dveří by čtenáři řeklo „hlas odevzdán" o hlasu, který
  // se nezapočte, a místní zábrana by mu za něj zamkla urnu. Týž predikát, ne opis.
  const decoded = decodeWeights(raw);
  if (decoded === null || !carriesLens(decoded)) return { status: "invalid" };
  try {
    const repo = await getWeightsRepo();
    if (repo === null) return { status: "unavailable" };
    const written = await repo.submitLensVector(raw);
    if (!written.ok) return { status: "invalid" };
    const aggregate = deriveWeightAggregate(await repo.listLensVectors());
    revalidatePath("/referendum");
    return { status: "ok", aggregate };
  } catch (err) {
    // Výjimka úložiště (zámek, plný disk) byla dosud neošetřený pád serverové
    // akce — klient neměl žádnou větu. Stav se pojmenuje a hlas se NEpředstírá.
    console.error("[referendum] zápis hlasu selhal — úložiště nepřijalo INSERT", err);
    return { status: "unavailable" };
  }
}
