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
import { getWeightsRepo } from "@/lib/db/pglite/repositories/weights";
import { deriveWeightAggregate, type WeightAggregate } from "./aggregate";

export type SubmitLensResult =
  | { status: "ok"; aggregate: WeightAggregate }
  | { status: "invalid" }
  /** Store neběží (sample-data režim) — poctivě přiznáno, nic se nepředstírá. */
  | { status: "unavailable" };

export async function submitLensVector(raw: string): Promise<SubmitLensResult> {
  // Tvrdá mez délky před jakoukoli prací: kanonický vektor má ≤ 23 znaků.
  if (typeof raw !== "string" || raw.length > 64) return { status: "invalid" };
  const repo = await getWeightsRepo();
  if (repo === null) return { status: "unavailable" };
  const written = await repo.submitLensVector(raw);
  if (!written.ok) return { status: "invalid" };
  const aggregate = deriveWeightAggregate(await repo.listLensVectors());
  revalidatePath("/referendum");
  return { status: "ok", aggregate };
}
