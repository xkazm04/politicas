// Czech UI copy for the REAL vote-record surfaces (Seismograf). Colocated as a
// plain module — the themeLabels.ts precedent — rather than messages/*.json,
// because the message catalogs are a shared file outside this feature's surface
// and the app is Czech-first (CLAUDE.md). If the catalogs later grow a
// `votetrack.record` namespace, these strings move there verbatim.

export const COPY = {
  heroNote:
    "reálná data · psp.cz — jmenovitá hlasování PSP10 · linie, disciplína i rebelie počítány deterministicky z uložených hlasů",
  lead:
    "Skutečný záznam sněmovny: seismograf soudržnosti nad všemi platnými hlasováními, deník s pohledem do sálu, linie klubů a kronika rebelií — každé číslo odkazuje na psp.cz.",

  /* ── seismograf ── */
  seismoTitle: "Seismograf",
  seismoNote: "soudržnost sněmovny v čase · výkyv dolů = štěpení · červená = rebelie",
  seismoExplainer:
    "Každý sloupec je jeden hlasovací den. Výchylka pod osou ukazuje, jak se kluby ten den štěpily (100 % = všechny kluby jednotné); červené hroty nad osou počítají hlasy proti linii vlastního klubu. Vyberte den pro detail.",
  seismoAria: "Seismograf soudržnosti sněmovny po hlasovacích dnech",
  seismoDayAria: (date: string, votes: number, cohesion: string, rebels: number) =>
    `${date}: ${votes} hlasování, soudržnost ${cohesion}, rebelií ${rebels}`,
  seismoVotes: "hlasování",
  seismoCohesion: "soudržnost",
  seismoRebels: "rebelií",
  seismoWorst: "nejtěsnější den — nejnižší soudržnost měl bod",
  seismoJump: "otevřít v deníku",
  seismoPspLink: "záznam na psp.cz",
  seismoNoCohesion: "bez měřitelné soudržnosti",

  /* ── deník + sál ── */
  ledgerTitle: "Deník a sál",
  ledgerNote: "pruh = sál: kobaltová pro · okrová zdržel se/nehlasoval · šedá nepřihlášen · červená proti",
  ledgerFootnote: (window: number, valid: number) =>
    `deník zobrazuje ${window} nejnovějších z ${valid} platných hlasování — seismograf výše pokrývá všechna · trvalý odkaz: vyberte zápis a sdílejte adresu s #h-…`,
  permalinkTitle: "výběrem vznikne trvalý odkaz (#h-…)",
  rebelsCount: (n: number) => `${n}× proti linii`,
  hemicycleAria: (title: string) => `Hemicykl hlasování: ${title}`,
  legendYes: "pro",
  legendNo: "proti",
  legendK: "zdržel se / nehlasoval",
  legendAway: "nepřihlášen / omluven",
  splitNote: "rozpad po klubech — šipka = linie (přísná většina pozičních hlasů) · číslo = disciplína",
  unaffiliated: "Nezařazení",
  chamberCohesionLabel: "soudržnost sněmovny",
  voteRebelsNote: "proti linii svého klubu hlasovali",
  noRebelsInVote: "Nikdo nehlasoval proti linii svého klubu.",
  sessionVote: (session: number | null, vote: number | null) =>
    `${session !== null ? `${session}. schůze` : ""}${session !== null && vote !== null ? " · " : ""}${vote !== null ? `hlasování č. ${vote}` : ""}`,
  outcomeAccepted: "přijato",
  outcomeRejected: "zamítnuto",
  pspSource: "psp.cz — jmenovité hlasování",

  /* ── linie klubů ── */
  disciplineTitle: "Linie klubů",
  disciplineNote: (valid: number) => `disciplína a soudržnost klubů přes všech ${valid} platných hlasování`,
  disciplineColumn: "disciplína",
  cohesionColumn: "soudržnost (Rice)",
  lineVotesColumn: (n: number) => `${n} hlasování s linií`,
  matrixNote: "matice linií — posledních 12 hlasování deníku",
  matrixFootnote:
    "Obrys místo plné barvy znamená, že se klub štěpil (disciplína pod 90 %) — přesně tam začíná pilíř Nezávislost. Pomlčka: klub neměl linii (remíza pozičních hlasů, nebo nikdo nehlasoval pro/proti).",
  partyHeader: "klub",

  /* ── rebelie ── */
  rebelsTitle: "Rebelie",
  chronicleNote: (cap: number) => `kronika rebelií — ${cap} nejnovějších hlasů proti linii vlastního klubu`,
  votedVerb: "hlasoval(a)",
  againstLine: "proti linii klubu —",
  noRebellions: "V záznamu zatím žádná rebelie.",
  topRebelsNote: (minEligible: number) =>
    `míra rebelie — podíl hlasů proti linii z pozičních hlasování s linií klubu · jen poslanci s ≥ ${minEligible} takovými hlasováními`,
  topRebelsEmpty: "Žádný poslanec zatím nepřekročil práh měřitelnosti.",
  eligibleShort: (rebel: string, eligible: string) => `${rebel} z ${eligible}`,

  /* ── methodology (the disclosed rule, stateSlice pattern) ── */
  methodTitle: "zveřejněné pravidlo výpočtu",
  methodBody:
    "Linie klubu = přísná většina pozičních hlasů (pro/proti) klubu v daném hlasování; remíza linii neurčuje. Disciplína = podíl pozičních hlasů klubu na linii. Soudržnost = Riceův index |pro−proti|/(pro+proti), za sněmovnu vážený počtem pozičních hlasů klubů s ≥ 5 pozičními hlasy. Slot „zdržel se / nehlasoval“ sněmovna od novely 90/1995 Sb. nerozlišuje a jako pozice se nepočítá; zmatečná hlasování jsou vyřazena; nezařazení poslanci se zobrazují, ale neskórují. Řazení klubů v hemicyklu zleva doprava je redakční konstanta.",
  methodSource: (valid: number, voided: number, ballots: string, from: string, to: string) =>
    `psp.cz — jmenovitá hlasování PSP10 · ${valid} platných hlasování (${voided} zmatečných vyřazeno) · ${ballots} hlasů · ${from} – ${to}`,

  /* ── mock fallback ── */
  fallbackTitle: "reálný záznam hlasování je dočasně nedostupný",
  fallbackBody:
    "Databáze grafu je jednopřipojeníová a právě ji drží jiný proces, nebo záznam ještě není naingestován. Níže je ilustrativní ukázka na smyšlených hlasováních — ne reálná data. Zkuste to znovu za chvíli.",
  fallbackSource: "fallback: lib/civic — smyšlený vzorek 5 hlasování",

  /* ── témata ── */
  themesTitle: "Témata hlasování",
  themesNote: "klasifikace názvů — sem_classify (haiku) · silver vrstva",
} as const;
