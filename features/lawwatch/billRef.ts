// Adresa sněmovního tisku — kodek id uzlu tisku (sourozenec statuteRef.ts).
//
// Uzel tisku má v grafu id `bill:tisk:<tiskId>`, kde `tiskId` je VNITŘNÍ číslo
// tisku z psp.cz (`bill:tisk:43111`), ne veřejné číslo tisku (`cislo: 4`, ze
// kterého se skládá adresa /zakony/<cislo>). Ta dvě čísla se pletou snadno,
// protože obě vypadají jako „číslo tisku" — a proto tenhle kodek existuje:
// předmět claimu je id UZLU, adresa dosjeru je veřejné číslo, a ani jedno se
// nesmí skládat řetězcovou šablonou na místě volání.
//
// Přísnost je táž jako u statuteRef.ts: parsuje se JEN kanonický tvar a nikdy
// se nehádá. `tiskId 0` je navíc VÝSLOVNĚ odmítnuto — je to fallback hodnota
// `getLawData` (`Number(...) || 0`) pro uzel, jehož id se přečíst nepodařilo,
// takže „bill:tisk:0" by byla adresa vyrobená ze selhání čtení.
//
// Čistý modul bez server importů: sdílí ho derivace, claimy, brána i testy.

/** `43111` → „bill:tisk:43111"; null pro cokoli, co není kladné celé číslo
 *  (0 je fallback neúspěšného čtení id — viz hlavička). */
export function billNodeId(tiskId: number): string | null {
  if (!Number.isSafeInteger(tiskId) || tiskId <= 0) return null;
  return `bill:tisk:${tiskId}`;
}

/** Inverze `billNodeId`: „bill:tisk:43111" → 43111. Null pro cokoli jiného —
 *  včetně vodicích nul a nekladných čísel za prefixem (raději žádná adresa než
 *  domněnka; `bill:tisk:043111` je jiný řetězec než id, které graf nese). */
export function tiskIdFromBillNodeId(id: string): number | null {
  const m = /^bill:tisk:([1-9]\d*)$/.exec(id);
  if (m === null) return null;
  const n = Number(m[1]);
  return Number.isSafeInteger(n) ? n : null;
}
