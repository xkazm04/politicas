// Titulek vestavného widgetu — JEDNA definice pro dokument, který widget vrací
// (embed.ts → <title>), i pro `title` atribut iframe, který /referendum čtenáři
// nabízí ke zkopírování. Do 2026-09-06 nesl snippet vždy „otevřený index
// přispění", i když vložený widget ukazoval žebříček pod čtenářovou čočkou —
// přístupné jméno rámu tvrdilo zveřejněnou metodiku nad přepočtem.
// Čistý modul bez importů: čte ho klient (ReferendumPage) i route handler.

/** `vector` = kanonický vektor čočky (serializeWeights), `null` = zveřejněná metodika. */
export function embedTitle(vector: string | null): string {
  return vector ? `politicas — žebříček pod vahami ${vector}` : "politicas — otevřený index přispění";
}
