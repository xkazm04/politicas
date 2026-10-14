/**
 * Narrative notes written onto `linked_to` edges by the registry-corroboration loops.
 *
 * LICENCE AND PRIVACY BY CONSTRUCTION. The dataor / ARES VR adapters extract an officer's birth
 * date ONLY as an identity-matching key (see the header of lib/ingest/sources/dataor.ts: "never
 * surfaces it directly"). These builders are the place where that rule becomes structure: none of
 * them takes a birth date as a parameter, so a stored `reviewer_note` / `dataor_check.note` (which
 * `features/money/components/AnalystNote.tsx` renders to the analyst) cannot carry one. The first
 * batch wrote `datum narození poslance (YYYY-MM-DD)` into the note itself, contradicting the
 * adapter's own header; the signature below is what stops that recurring.
 */

export interface RoleSpan {
  roleLabel: string;
  from: string | null;
  to: string | null;
}

const span = (s: RoleSpan) => `${s.roleLabel} ${s.from ?? "?"}→${s.to ?? "trvá"}`;

/** Reviewer note for a tie the dataor export confirmed by an exact birth-date match. */
export function dataorMatchNote(a: { datasetId: string; span: RoleSpan; spisovaZnacka: string | null; termsNote: string }): string {
  return (
    `dataor.justice.cz (bulk ISVR export, ${a.datasetId}): ${span(a.span)} — shoda data narození poslance ` +
    `s roster psp.cz potvrzena proti záznamu úředníka v ${a.spisovaZnacka ?? "OR"}.${a.termsNote} ` +
    `(Pozn.: příčina, proč tuto shodu nezachytila dřívější ARES-VR rekonciliace, nebyla v této dávce zjištěna — ` +
    `ARES VR live endpoint tuto shodu při zpětné kontrole obsahuje.)`
  );
}

/** `dataor_check.note` for a tie with no matching officer entry. */
export function dataorNoMatchNote(a: { datasetId: string; rosterBirthKnown: boolean; officersWithoutBirthdate: number }): string {
  if (!a.rosterBirthKnown) return "Datum narození poslance v roster psp.cz chybí — dataor záznam nelze porovnat vůbec.";
  return (
    `Žádný záznam v dataor (${a.datasetId}) nemá datum narození shodné s roster psp.cz — vazba tvrzená grafem NENÍ potvrzena ani po kontrole úplné historie funkcí z bulk ISVR exportu.` +
    (a.officersWithoutBirthdate > 0
      ? ` Pozn.: ${a.officersWithoutBirthdate} záznam(ů) v tomto souboru nemá datum narození vyplněné (typicky pre-2000 zápisy) — u těch nelze shodu ani vyloučit.`
      : "")
  );
}

/** Confidence note for the PRaK re-point (identity confirmed by birth date, or not). */
export function prakConfidenceNote(a: { identityConfirmed: boolean; entries: number; role: string | null; from: string | null; to: string | null }): string {
  return a.identityConfirmed
    ? `shoda data narození s roster psp.cz potvrzena proti dataor.justice.cz záznamu (entrie: ${a.role}, ${a.from}→${a.to ?? "trvá"})`
    : `IDENTITA NENÍ potvrzena datem narození u žádné z ${a.entries} nalezených položek (pre-2000 zápisy bez narozDatum, P36) — shoda pouze podle jména, firmy a období (střední jistota)`;
}
