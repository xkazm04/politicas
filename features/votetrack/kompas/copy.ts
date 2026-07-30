// Czech UI copy for the Volební kompas naruby. Colocated plain module — the
// record/copy.ts precedent (messages/*.json is shared surface, out of bounds).
// The two disclosed rules (selection, scoring) render VERBATIM from here.

export const KOMPAS_COPY = {
  heroNote:
    "reálná data · psp.cz — jmenovitá hlasování PSP10 · otázky vybírá zveřejněné pravidlo, shodu počítají skutečné hlasy",
  title: "Volební kompas naruby",
  lead:
    "Běžné volební kalkulačky měří sliby. Tenhle kompas měří činy: zaujmete postoj ke skutečným hlasováním sněmovny — a z uložených hlasů se deterministicky spočítá, kteří poslanci a kluby hlasovali jako vy. Každé číslo odkazuje na záznam hlasování.",
  howTo:
    "PRO znamená hlasovat pro návrh přesně tak, jak byl v sále předložen (název je doslovný titul hlasování z psp.cz); PROTI proti němu. Otázku bez názoru přeskočte — do výpočtu nevstupuje.",

  /* ── otázky ── */
  questionsTitle: "Otázky",
  questionsNote: (n: number) => `${n} skutečných hlasování vybraných zveřejněným pravidlem — žádná redakce`,
  progress: (answered: number, total: number) => `zodpovězeno ${answered} z ${total}`,
  progressAria: (answered: number, total: number) =>
    `Postup kompasu: zodpovězeno ${answered} z ${total} otázek`,
  answerPro: "pro",
  answerProti: "proti",
  answerSkip: "přeskočit",
  answeredPro: "váš hlas: pro",
  answeredProti: "váš hlas: proti",
  cardAria: (title: string) => `Otázka kompasu: ${title}`,
  chamberResult: "výsledek sálu",
  recordLink: "záznam hlasování",
  pspLink: "psp.cz",
  outcomeAccepted: "přijato",
  outcomeRejected: "zamítnuto",
  tallyLegend: "pro · zdržel se/nehlasoval · nepřihlášen · proti",

  /* ── výsledek ── */
  resultsTitle: "Váš kompas",
  resultsNote: "váš výsledek — kobalt značí vaše čísla, ne zveřejněná · odkaz jej nese s sebou",
  needMore: (min: number, answered: number) =>
    `Odpovězte alespoň na ${min} otázky — zatím ${answered}. Výsledek se objeví tady.`,
  yourResultBadge: (answered: number) => `váš výsledek · počítáno z ${answered} zodpovězených otázek`,
  clubsBoard: "shoda s linií klubů",
  clubsBoardNote: "linie klubu = přísná většina jeho pozičních hlasů v daném hlasování; remíza linii neurčuje",
  mpsBoard: "shoda s poslanci",
  mpsBoardNote: "řazeno podle shody; pořadí uvnitř stejné shody nese jen počet srovnatelných hlasů a česká abeceda",
  alignmentOf: (matches: number, comparable: number) => `${matches} z ${comparable} srovnatelných`,
  kShort: "zdržel se/nehlasoval",
  awayShort: "nepřihlášen",
  noComparable: "žádné srovnatelné hlasování",
  notRankable: "málo srovnatelných hlasů — mimo pořadí",
  unrankedTail: (n: number) =>
    `${n} poslanců má poziční hlas na méně než polovině vašich otázek — zobrazují se pod čarou, bez pořadí`,
  showAll: (n: number) => `zobrazit všech ${n} poslanců`,
  showLess: "zobrazit méně",
  receiptsToggle: "účtenka po hlasováních",
  receiptsAria: (name: string) => `Účtenka shody po jednotlivých hlasováních: ${name}`,
  receiptYou: "vy",
  receiptMp: "poslanec",
  receiptMatch: "shoda",
  receiptDiffer: "rozdíl",
  receiptK: "bez pozice",
  receiptAway: "nepřítomen",
  unaffiliated: "nezařazení",
  shareCta: "Sdílet můj kompas",
  shareOk: "Odkaz zkopírován",
  shareFail: "Zkopírujte adresu ručně",
  resetCta: "Smazat odpovědi",

  /* ── zveřejněná pravidla ── */
  rulesTitle: "zveřejněná pravidla",
  selectionRule: (cap: number, perTheme: number, minPositional: number) =>
    `Pravidlo výběru otázek: kandidáty jsou platná (nezmatečná) hlasování PSP10 s tématem ze silver vrstvy vote_tag, mimo témata Procedura a Jiné, s alespoň ${minPositional} pozičními hlasy (pro + proti). V každém tématu se kandidáti řadí podle těsnosti |pro−proti|/(pro+proti) vzestupně (nejrozdělenější první; remíza: více pozičních hlasů, novější datum, vyšší id). Témata se řadí podle počtu kandidátů a sada se losuje kolečkem — první výběr každého tématu, pak druhý — nejvýše ${perTheme} na téma a ${cap} celkem. Stejný záznam dá vždy stejné otázky.`,
  scoringRule:
    "Pravidlo shody: srovnatelné je hlasování, kde poslanec hlasoval pro/proti; shoda = jeho pozice rovná se vaší. Shoda poslance = shody ÷ srovnatelná hlasování. Slot „zdržel se / nehlasoval“ sněmovna od novely 90/1995 Sb. nerozlišuje — nepočítá se jako souhlas ani nesouhlas a do jmenovatele nevstupuje; nepřítomnost také ne (obojí se zvlášť zobrazuje). Do pořadí vstupují jen poslanci s pozičním hlasem na alespoň polovině vámi zodpovězených otázek. Kluby se měří stejně proti své linii (přísná většina pozičních hlasů klubu).",
  rulesSource: (valid: number, tagged: number, candidates: number, from: string, to: string) =>
    `psp.cz — jmenovitá hlasování PSP10 · ${valid} platných hlasování, z toho ${tagged} s tématem a ${candidates} kandidátů výběru · ${from} – ${to} · témata: sem_classify (haiku), silver vrstva`,

  /* ── fallback ── */
  unavailableWhat: "volební kompas",
  backToVotes: "zpět na přehled hlasování",

  /* ── vstupní bod na /hlasovani ── */
  entryTitle: "Volební kompas naruby",
  entryBody: "zaujměte postoj ke skutečným hlasováním a spočítejte si shodu s poslanci a kluby",
} as const;
