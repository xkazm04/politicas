/*
 * SLOVNÍK PŘÍZNAKŮ VAZBY (`kg_edge.props.flags`) — jedno místo, kde se strojový
 * token mění v českou (a anglickou) větu.
 *
 * Příznaky píšou analytické průchody money-loopu do props hrany `linked_to`:
 * `scripts/case-loops/money/{reconcile-ares-vr,dataor-corroborate,prak-repoint,
 * reverify-open-vs-live-ares-vr}.ts`. Jsou to interní identifikátory
 * (`stale-ongoing-in-graph`, `dataor-checked-not-isvr-registered`), ne text pro
 * čtenáře — a přesto se do 2026-08-04 sázely na VEŘEJNÝ spis poslance
 * (`MpCaseFilePage`) doslova, jak je dokumentováno v
 * `docs/data-analysis/ux-audit-2026-07-27.md` (§ „raw flag tokens").
 *
 * Pravidla tohohle modulu:
 *  1. Copy je odvozená z MÍSTA, kde se příznak zapisuje — ne z názvu tokenu.
 *     Kde skript píše i vysvětlující `dataor_check.note`, copy říká totéž.
 *  2. Neznámý token se NESKRÝVÁ. Vypíše se doslova a označí se jako
 *     nepřeložený strojový příznak — čtenář má vědět, že hrana nese značku,
 *     kterou produkt zatím neumí přeložit, místo aby o ní nevěděl.
 *  3. Strojová kontrola není lidská kontrola. `sonnet-reviewed` / `opus-verified`
 *     jsou průchody jazykovým modelem; copy to říká výslovně, aby se štítek
 *     nečetl jako „ověřeno člověkem" (to smí jen brána v /penize/kontrola).
 *  4. Čistý modul (žádné server importy) — sází ho jak veřejný spis, tak
 *     interní ověřovací konzole. Tón i text jsou pro obě plochy TYTÉŽ; liší se
 *     jen rámec, do kterého je plocha zasadí.
 */

/** `warn` = kaz v datech nebo v tvrzení vazby · `info` = procesní/technická
 *  poznámka · `lead` = samostatná nedoložená stopa · `machine` = značka bez
 *  přeložené copy (a proto vždy `known: false`). */
export type TieFlagTone = "warn" | "info" | "lead" | "machine";

export interface TieFlagInfo {
  /** Doslovný token z grafu — vždy k dispozici, i u přeloženého příznaku. */
  token: string;
  /** false ⇒ slovník token nezná; label/note říkají právě tohle, nic si nedomýšlí. */
  known: boolean;
  labelCs: string;
  labelEn: string;
  noteCs: string;
  noteEn: string;
  tone: TieFlagTone;
}

interface FlagCopy {
  labelCs: string;
  labelEn: string;
  noteCs: string;
  noteEn: string;
  tone: Exclude<TieFlagTone, "machine">;
}

/** Příznak, který znamená „období „trvá“ v grafu je proti rejstříku zastaralé".
 *  Zapisuje ho `reconcile-ares-vr.ts` PRÁVĚ TEHDY, když graf nechal období
 *  otevřené a ARES VR má konec role. Na živém grafu ho nese 42 z 211 vazeb. */
export const STALE_ONGOING_FLAG = "stale-ongoing-in-graph";

const FLAGS: Record<string, FlagCopy> = {
  [STALE_ONGOING_FLAG]: {
    labelCs: "období „trvá“ je zastaralé",
    labelEn: "the “ongoing” period is stale",
    noteCs:
      "Zdroj vazby (Hlídač) nechal období otevřené, ale v ARES VR má role zapsaný konec. Datum konce na kartě pochází z rejstříku; „trvá“ ze zdroje je nepřesné.",
    noteEn:
      "The tie's source (Hlídač) left the period open-ended, but ARES VR records an end date for the role. The end date on this card comes from the registry; the source's “ongoing” is inaccurate.",
    tone: "warn",
  },
  "no-birthdate-match-in-vr": {
    labelCs: "ve VR nesedí datum narození",
    labelEn: "no birth-date match in the registry",
    noteCs:
      "Firma v ARES VR existuje, ale žádný statutár ani společník se shodným datem narození poslance tam nalezen nebyl — vazbu tvrdí jen zdroj grafu, rejstřík ji nepotvrzuje.",
    noteEn:
      "The company exists in ARES VR, but no officer or shareholder there matches the MP's birth date — the tie is asserted by the graph's source only, not confirmed by the registry.",
    tone: "warn",
  },
  "vr-missing-dob-on-old-record": {
    labelCs: "starý zápis bez data narození",
    labelEn: "old registry entry carries no birth date",
    noteCs:
      "Zápis ve veřejném rejstříku je starý a datum narození neuvádí, takže automatické párování osoby selhalo. Shodu uzavřel až analytický průchod podle jména — je to slabší důkaz než shoda data narození.",
    noteEn:
      "The registry entry is old and carries no birth date, so the automatic person match failed. An analysis pass closed the match on the name alone — weaker evidence than a birth-date match.",
    tone: "warn",
  },
  "approximate-dates-no-day-precision": {
    labelCs: "data jen přibližná, ne na den",
    labelEn: "approximate dates, no day precision",
    noteCs:
      "Rejstřík u tohoto zápisu neuvádí přesné datum — potvrzený je jen rok. Denní data v období proto neberte jako doložená.",
    noteEn:
      "The registry gives no exact date for this entry — only the year is confirmed. Do not read the day-level dates in the period as evidenced.",
    tone: "warn",
  },
  "clean-handoff-not-revolving-door": {
    labelCs: "čistý předěl, ne otáčivé dveře",
    labelEn: "clean handoff, not a revolving door",
    noteCs:
      "Strojová kontrola dohledala, že role skončila a podíl přešel na osoby bez zjištěné vazby na poslance. Peníze zaplacené po konci role se proto poslanci nepřičítají. Není to lidské schválení vazby.",
    noteEn:
      "A machine review traced the role's end and the stake passing to people with no established link to the MP. Money paid after the role ended is therefore not attributed to the MP. This is not a human confirmation of the tie.",
    tone: "info",
  },
  "undisclosed-asset-declaration-lead": {
    labelCs: "stopa: chybí v majetkovém přiznání",
    labelEn: "lead: missing from the asset declaration",
    noteCs:
      "Při kontrole vazby se našla SAMOSTATNÁ, dosud neověřená stopa k oznamovací povinnosti poslance. Netýká se platnosti téhle vazby a sama o sobě není zjištěním — patří do vlastního prověření.",
    noteEn:
      "Reviewing this tie surfaced a SEPARATE, not-yet-verified lead about the MP's disclosure duty. It does not bear on whether this tie is real and is not a finding on its own — it needs its own inquiry.",
    tone: "lead",
  },
  "sonnet-reviewed": {
    labelCs: "kontrola jazykovým modelem (Sonnet)",
    labelEn: "reviewed by a language model (Sonnet)",
    noteCs:
      "Vazbu prošel analytický průchod s jazykovým modelem, ne člověk. Jeho zjištění je vodítko pro recenzenta — lidskou bránu nenahrazuje a stav kontroly nemění.",
    noteEn:
      "An analysis pass with a language model went over this tie — not a person. Its findings are a lead for the reviewer; they do not stand in for the human gate and change no review state.",
    tone: "info",
  },
  "opus-verified": {
    labelCs: "kontrola jazykovým modelem (Opus)",
    labelEn: "reviewed by a language model (Opus)",
    noteCs:
      "Zjištění průchodu ověřoval druhý, silnější jazykový model. Pořád je to strojová kontrola, ne lidská brána.",
    noteEn:
      "A second, stronger language model checked the pass's findings. It is still a machine review, not the human gate.",
    tone: "info",
  },
  "dataor-closed": {
    labelCs: "potvrzeno z hromadného exportu OR",
    labelEn: "confirmed from the bulk registry export",
    noteCs:
      "Vazbu uzavřel záznam z hromadného exportu dataor.justice.cz (týž rejstřík jako ARES VR) se shodou data narození poslance. Zdroj je uvedený u vazby.",
    noteEn:
      "The tie was closed against a record from the dataor.justice.cz bulk export (the same registry ARES VR serves), matching the MP's birth date. The source is cited on the tie.",
    tone: "info",
  },
  "dataor-checked-not-isvr-registered": {
    labelCs: "subjekt není v ISVR — nelze potvrdit ani vyvrátit",
    labelEn: "subject is not ISVR-registered — neither confirmable nor refutable",
    noteCs:
      "Subjekt nemá v ARES záznam z veřejného rejstříku (typicky instituce zřízená zvláštním zákonem), takže v ISVR není. ARES VR ani hromadný export dataor tuhle vazbu potvrdit ani vyvrátit nemohou — je to strukturální mez zdroje, ne chybějící data.",
    noteEn:
      "The subject has no public-register record in ARES (typically a body established by a special act), so it is absent from ISVR. Neither ARES VR nor the dataor bulk export can confirm or refute this tie — a structural limit of the source, not missing data.",
    tone: "info",
  },
  "dataor-checked-name-only-match": {
    labelCs: "shoda jen podle jména",
    labelEn: "name-only match",
    noteCs:
      "V záznamu se shoduje jméno, ale ne datum narození — totožnost osoby tím není uzavřená. Slabší důkaz, patří k lidskému posouzení.",
    noteEn:
      "The record matches on name but not on birth date, so the person's identity is not settled. Weaker evidence; it belongs to human judgement.",
    tone: "warn",
  },
  "dataor-no-match": {
    labelCs: "v exportu OR shoda nenalezena",
    labelEn: "no match in the registry export",
    noteCs:
      "V hromadném exportu obchodního rejstříku se u tohoto IČO nenašel žádný statutár ani společník se shodným datem narození poslance.",
    noteEn:
      "The commercial-register bulk export holds no officer or shareholder for this IČO matching the MP's birth date.",
    tone: "warn",
  },
  "dataor-no-match-some-officers-birthdate-null": {
    labelCs: "shoda nenalezena, část zápisů bez data narození",
    labelEn: "no match found, some entries carry no birth date",
    noteCs:
      "Shoda podle data narození nenalezena, ale část zápisů v exportu datum narození vůbec nemá — mezi nimi může být i poslanec. Negativní výsledek proto není uzavřený.",
    noteEn:
      "No birth-date match was found, but some entries in the export carry no birth date at all — the MP could be among them. The negative result is therefore not conclusive.",
    tone: "warn",
  },
  "dataor-ico-not-in-dataset": {
    labelCs: "IČO není v použitém datasetu",
    labelEn: "IČO absent from the dataset used",
    noteCs:
      "IČO se v letošním úplném exportu příslušného soudu a právní formy nevyskytuje — subjekt mohl zaniknout dřív, nebo je odhad soudu/formy chybný. Kontrola tím není hotová.",
    noteEn:
      "The IČO does not appear in this year's full export for the resolved court and legal form — the entity may have dissolved earlier, or the court/form guess is wrong. The check is not complete.",
    tone: "info",
  },
  "dataor-dataset-not-found": {
    labelCs: "dataset OR nenalezen",
    labelEn: "registry dataset not found",
    noteCs:
      "Pro odhadnutou kombinaci soudu a právní formy žádný dataset neexistuje — odhad je nejspíš chybný a kontrolu je třeba zopakovat.",
    noteEn:
      "No dataset exists for the resolved court and legal form — the guess is probably wrong and the check has to be repeated.",
    tone: "info",
  },
  "dataor-court-form-unresolved": {
    labelCs: "soud/právní forma nerozhodnuty",
    labelEn: "court and legal form unresolved",
    noteCs:
      "Z údajů ARES se nepodařilo určit rejstříkový soud a právní formu, takže se ani nedalo sáhnout do správného exportu. Kontrola neproběhla.",
    noteEn:
      "The registering court and legal form could not be determined from ARES data, so the right export could not be queried. The check did not run.",
    tone: "info",
  },
  "dataor-fetch-incomplete": {
    labelCs: "stahování exportu nedokončeno",
    labelEn: "export download did not finish",
    noteCs:
      "Stažení exportu se nevešlo do síťového rozpočtu dávky (soubory mají desítky až stovky MB). Není to zápor, jen nedokončená kontrola — patří ji zopakovat.",
    noteEn:
      "Downloading the export exceeded the batch's network budget (the files run to hundreds of megabytes). Not a negative result, just an unfinished check — it should be repeated.",
    tone: "info",
  },
  "prak-repoint-batch006": {
    labelCs: "vazba přepojena na jiné IČO",
    labelEn: "tie re-pointed to a different IČO",
    noteCs:
      "Vazba původně mířila na IČO, které je s tvrzenou rolí strukturálně neslučitelné; analytický průchod ji přepojil na subjekt odpovídající rejstříkovému záznamu. Podrobnosti nese poznámka analýzy u vazby.",
    noteEn:
      "The tie originally pointed at an IČO structurally incompatible with the asserted role; an analysis pass re-pointed it to the subject matching the registry record. The details are in the tie's analysis note.",
    tone: "info",
  },
  "q-money-15-live-flip": {
    labelCs: "živý ARES VR výsledek otočil",
    labelEn: "a live ARES VR check flipped the verdict",
    noteCs:
      "Opakovaná kontrola proti živému rozhraní ARES VR našla zápis, který dřívější dávka nenašla, a verdikt se změnil na „potvrzeno rejstříkem“.",
    noteEn:
      "A re-check against the live ARES VR endpoint found an entry an earlier batch missed, and the verdict flipped to “registry-confirmed”.",
    tone: "info",
  },
  "q-money-21-contract-window": {
    labelCs: "samostatný nález k vlastnickému oknu",
    labelEn: "separate finding on the ownership window",
    noteCs:
      "K vazbě je připojený samostatný nález o vlastnickém okně a smlouvách zveřejněných v něm. Nese vlastní citace i vlastní meze (registr smluv nezachycuje dotace přiznané rozhodnutím) a není zjištěním o protiprávnosti.",
    noteEn:
      "A separate finding about the ownership window and the contracts published inside it is attached to this tie. It carries its own citations and its own limits (the contracts register does not capture subsidies awarded by decision) and asserts no illegality.",
    tone: "lead",
  },
  "person-birthdate-unknown": {
    labelCs: "u poslance chybí datum narození",
    labelEn: "the MP's birth date is missing",
    noteCs:
      "Bez data narození poslance nelze osobu v rejstříku spolehlivě spárovat — kontrola vazby proto neproběhla.",
    noteEn:
      "Without the MP's birth date the person cannot be matched in the registry reliably, so the tie's check did not run.",
    tone: "info",
  },
};

/** Kolik tokenů slovník zná — cituje se v testu i v dokumentaci. */
export const KNOWN_TIE_FLAGS: readonly string[] = Object.keys(FLAGS);

/**
 * Token → čitelná podoba. Neznámý (nebo prázdný) token se NIKDY neskrývá:
 * vrací se `known: false` a copy, která doslovný token uvádí a přiznává, že
 * pro něj produkt zatím větu nemá.
 */
export function tieFlagInfo(token: string): TieFlagInfo {
  const key = token.trim();
  const copy = FLAGS[key];
  if (!copy) {
    return {
      token: key,
      known: false,
      labelCs: key || "(prázdný příznak)",
      labelEn: key || "(empty flag)",
      noteCs:
        "Strojový příznak z analytického průchodu, pro který produkt zatím nemá českou větu. Uvádíme ho doslova, abyste věděli, že hrana v grafu takovou značku nese.",
      noteEn:
        "A machine flag written by an analysis pass for which the product has no human wording yet. It is shown verbatim so you know the edge carries it.",
      tone: "machine",
    };
  }
  return { token: key, known: true, ...copy };
}

/** Pole tokenů → čitelné příznaky, bez duplicit, v pořadí, v jakém je hrana nese. */
export function tieFlagInfos(tokens: readonly string[] | null | undefined): TieFlagInfo[] {
  if (!tokens?.length) return [];
  const seen = new Set<string>();
  const out: TieFlagInfo[] = [];
  for (const t of tokens) {
    if (typeof t !== "string") continue;
    const key = t.trim();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tieFlagInfo(key));
  }
  return out;
}

/** Nese vazba příznak zastaralého „trvá"? Jediné místo, kde se ta podmínka píše. */
export function hasStaleOngoingFlag(tokens: readonly string[] | null | undefined): boolean {
  return Array.isArray(tokens) && tokens.some((t) => typeof t === "string" && t.trim() === STALE_ONGOING_FLAG);
}
