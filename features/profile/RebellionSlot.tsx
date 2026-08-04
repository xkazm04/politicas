import "server-only";

/*
 * Streamovaný slot pro jmenovité rebelie.
 *
 * Instance stojí na čtení celého hlasovacího záznamu (406 000 ballotů, měřeno
 * 15,8–16,0 s), takže se index drží v mezizádostní paměti (getRebellionRecord).
 * První požadavek po vypršení té paměti ale ten čas zaplatí — a čekat s CELÝM
 * spisem na jednu sekci by znamenalo, že skóre, peníze i výbory se objeví o
 * 16 s později kvůli rebeliím.
 *
 * Proto je tenhle server-komponent uvnitř `<Suspense>`: stránka se vykreslí a
 * odešle hned, sekce dopluje. Fallback ŘÍKÁ, co se děje — prázdné místo by se
 * nedalo odlišit od poslance bez jediné rebelie.
 */

import { getRebellionRecord } from "./getRebellionRecord";
import RebellionInstances from "./components/RebellionInstances";

export default async function RebellionSlot({ pspId }: { pspId: number }) {
  const record = await getRebellionRecord(pspId);
  return <RebellionInstances record={record} />;
}
