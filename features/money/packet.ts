// Důkazní paket (batch-4 4E) — ČISTÁ derivace spisu poslance do citovatelného
// paketu. Plain module (žádné server-importy): server-loader
// (getEvidencePacket.ts) i "use client" plocha (EvidencePacketPage.tsx) čtou
// tytéž tvary, stejně jako moneyTypes.ts.
//
// CITAČNÍ BRÁNA JE ABSOLUTNÍ: do paketu vstupuje VÝHRADNĚ lidsky ověřený
// materiál — vazba s `reviewState === "verified"`, tedy hrana, na kterou
// lidská kontrola (/penize/kontrola) zapsala schválení. Paritní pravidlo
// moneyLoaderu platí i tady: chybějící/neznámý review_state = pending, nikdy
// verified — mapLinkedToTie ho normalizuje před námi a tahle derivace navíc
// pouští dál jen striktní rovnost "verified". Všechno ostatní se NEZAHRNE
// a vyloučení se PŘIZNÁ (`exclusions` + `exclusionNotesCs`), nikdy nezamlčí.
//
// KANDIDÁTI STŘETŮ (features/money/collisions, 4C) do paketu NIKDY nevstupují:
// jsou to výpočetní kandidáti bez lidského ověření — z definice neověřený
// materiál. Tento modul proto z collisions/ nic neimportuje a jediným vstupem
// je MoneyMpDetail (linked_to vazby); invariant hlídá kolokovaný test.
//
// Otisk obsahu následuje precedens Exponátu (features/dashboard/exhibit.ts):
// FNV-1a/32 nad kanonickým JSON. Otisk pokrývá OBSAH paketu (vazby, časovou
// osu, přiznaná vyloučení) — ne datum sestavení, takže kopie kolující v
// redakci se dá ověřit proti živé verzi bez ohledu na den stažení.

import { czechDate, czechInt } from "@/lib/format";
import { canonicalJson, contentHash, HASH_ALGORITHM } from "@/features/dashboard/exhibit";
import { buildRegistryLinks, type RegistryLinks } from "./reviewTypes";
import { compactCzk, displaySignedOn, tieClassInfo, type MoneyMpDetail, type MoneyTieDetail } from "./moneyTypes";
import type { TieClass, TieClassOrigin } from "./reviewTypes";
import type { ContractLine } from "./moneyTypes";

export const PACKET_HASH_ALGORITHM = HASH_ALGORITHM; // "fnv-1a/32"

/** Kolik čeho brána vyloučila — přiznává se na paketu, nikdy nezamlčuje. */
export interface PacketExclusions {
  /** Vazby ve stavu pending_review (včetně těch bez zapsaného stavu — parita). */
  pending: number;
  /** Vazby lidskou kontrolou zamítnuté (terminální stav, D7). */
  rejected: number;
}

/** Jedna ověřená vazba v paketu — projekce MoneyTieDetail + rejstříkové
 *  odkazy + hotový citační blok. Explicitní tvar (žádný spread celého
 *  MoneyTieDetail), aby otisk obsahu nezměnilo pole, které paket nesází. */
export interface PacketTie {
  companyId: string;
  ico: string;
  company: string;
  role: string;
  tieClass: TieClass;
  tieClassOrigin: TieClassOrigin;
  corroboration: string | null;
  roleValidFrom: string | null;
  roleValidTo: string | null;
  temporalStatus: string | null;
  contractCount: number;
  contractCzk: number;
  subsidiesCount: number;
  subsidiesCzk: number;
  donatedToPartyCzk: number | null;
  donationRecipientParty: string | null;
  /** Provenance lidské kontroly — u ověřené vazby vždy citované doslova. */
  reviewNote: string | null;
  lastDecision: string | null;
  lastReviewer: string | null;
  lastReviewedAt: string | null;
  source: string;
  links: RegistryLinks;
  contracts: ContractLine[];
  contractsMoreCount: number;
  /** Stabilní kotva na paketu: #p-<ico>. */
  anchor: string;
  /** Hotový citační blok (česky — cituje české rejstříky). */
  citeCs: string;
}

export type PacketEventKind = "role-start" | "contract" | "review" | "role-end";

/** Jedna datovaná událost časové osy — strukturovaná data, kopii sází UI. */
export interface PacketEvent {
  date: string; // YYYY-MM-DD
  kind: PacketEventKind;
  companyId: string;
  company: string;
  ico: string;
  /** contract: label smlouvy; review: rozhodnutí + kontrolor; role: role text. */
  detail: string;
  amountCzk: number | null;
}

export interface EvidencePacket {
  pspId: number;
  name: string;
  club: string | null;
  /** ISO datum sestavení — datovaný otisk; ZÁMĚRNĚ mimo hash. */
  compiledAt: string;
  /** Ověřené vazby, pořadí batch-005 (reviewRank vzestupně, pak companyId). */
  ties: PacketTie[];
  /** Datované události ověřených vazeb, vzestupně. */
  timeline: PacketEvent[];
  exclusions: PacketExclusions;
  /** Smlouvy nad top-N řez spisu — v paketu nejsou a paket to říká. */
  contractsOmitted: number;
  /** Zobrazené smlouvy, které DATUM PODPISU NENESOU — v časové ose chybět MUSÍ
   *  přiznaně. Nezahrnuje ty, u kterých datum bylo, ale nemohlo se stát; to je
   *  jiné tvrzení a má vlastní číslo. */
  undatedContracts: number;
  /**
   * Zobrazené smlouvy, u kterých graf datum podpisu NESL a hranice možného data
   * ho odmítla (`lib/analysis/plausible-date.ts`; korpus drží podpisy v letech
   * 0002, 1970, 2027, 3062). V časové ose nejsou — a paket to musí říct nahlas:
   * svazek orazítkovaný otiskem, který pole tiše upustí, je horší než ten, který
   * vytiskne vadné datum, protože příjemce nemá jak poznat, že něco chybí.
   * Datum se nikdy neopravuje; smlouva ani její částka se nezahazují.
   */
  withheldDateContracts: number;
  hash: string;
  hashAlgorithm: string;
  source: string;
  pass: number;
}

/* ── česká množná čísla pro přiznání vyloučení ───────────────────────────── */

/** „5 nálezů čeká na ověření — nezahrnuto" (1 nález / 2–4 nálezy / 5+ nálezů). */
export function pendingExclusionNoteCs(n: number): string {
  if (n === 1) return "1 nález čeká na ověření — nezahrnut";
  if (n >= 2 && n <= 4) return `${czechInt(n)} nálezy čekají na ověření — nezahrnuty`;
  return `${czechInt(n)} nálezů čeká na ověření — nezahrnuto`;
}

export function rejectedExclusionNoteCs(n: number): string {
  if (n === 1) return "1 nález byl při kontrole zamítnut — nezahrnut";
  if (n >= 2 && n <= 4) return `${czechInt(n)} nálezy byly při kontrole zamítnuty — nezahrnuty`;
  return `${czechInt(n)} nálezů bylo při kontrole zamítnuto — nezahrnuto`;
}

/** Všechna přiznání vyloučení, v pořadí, v jakém se sázejí. Prázdné pole =
 *  brána nic nevyloučila (a i to plocha řekne). */
export function exclusionNotesCs(x: PacketExclusions): string[] {
  const notes: string[] = [];
  if (x.pending > 0) notes.push(pendingExclusionNoteCs(x.pending));
  if (x.rejected > 0) notes.push(rejectedExclusionNoteCs(x.rejected));
  return notes;
}

/* ── citační blok ────────────────────────────────────────────────────────── */

/** Období role pro citaci — tvrdí jen to, co rejstřík eviduje. „od X" se smí
 *  říct jen u rejstříkem potvrzené trvající role (pravidlo temporalBadge). */
function citePeriod(t: PacketTie): string {
  if (!t.roleValidFrom) return "";
  if (t.roleValidTo) return `, role ${czechDate(t.roleValidFrom)}–${czechDate(t.roleValidTo)}`;
  if (t.corroboration === "registry-confirmed" && t.temporalStatus === "current") {
    return `, role od ${czechDate(t.roleValidFrom)} (dle ARES VR trvá)`;
  }
  return `, role od ${czechDate(t.roleValidFrom)} (konec rejstřík neeviduje)`;
}

function citeMoney(t: PacketTie): string {
  const parts: string[] = [];
  if (t.contractCzk > 0) {
    parts.push(`veřejné zakázky ${compactCzk(t.contractCzk, "cs")} (${czechInt(t.contractCount)} smluv)`);
  }
  if (t.subsidiesCzk > 0) parts.push(`dotace ${compactCzk(t.subsidiesCzk, "cs")}`);
  if ((t.donatedToPartyCzk ?? 0) > 0) {
    parts.push(
      `dary straně ${compactCzk(t.donatedToPartyCzk ?? 0, "cs")}${t.donationRecipientParty ? ` (${t.donationRecipientParty})` : ""}`,
    );
  }
  return parts.length > 0 ? ` Dosažitelné veřejné peníze: ${parts.join(", ")}.` : "";
}

/** Kolik smluv vazby neslo datum podpisu, které se nemohlo stát. Počítá se nad
 *  řádky, které paket OPRAVDU nese (top-N řez spisu) — o zbytku mluví
 *  `contractsMoreCount`. */
function withheldDateCount(t: PacketTie): number {
  return t.contracts.filter((c) => c.dateWithheldOn != null).length;
}

/** Přiznání potlačeného data přímo do CITACE — tedy do věty, kterou si redakce
 *  zkopíruje. Číslo v patičce paketu zůstane na obrazovce; citace cestuje.
 *  Uvádí se i den, proti kterému se hranice kreslila, aby šel test zopakovat. */
function citeWithheldDates(t: PacketTie): string {
  const n = withheldDateCount(t);
  if (n === 0) return "";
  const day = t.contracts.find((c) => c.dateWithheldOn != null)!.dateWithheldOn as string;
  const noun = n === 1 ? "smlouva nese" : n >= 2 && n <= 4 ? "smlouvy nesou" : "smluv nese";
  return (
    ` Pozn.: ${czechInt(n)} ${noun} v grafu datum podpisu, které nemohlo nastat` +
    ` (před 1. 1. 1993 nebo po ${czechDate(day)}); datum je zamlčené, částka i smlouva zůstávají` +
    ` a datum se neopravuje. V časové ose paketu proto tyto smlouvy nejsou.`
  );
}

/** Hotový citační blok pro jednu OVĚŘENOU vazbu. Třídní popisek jde z
 *  tieClassInfo (jediný zdroj kopie, nikdy nepřepisovat); u stewarda citace
 *  nese celé P29 pravidlo — velké číslo instituce se bez něj nesmí citovat.
 *  Odvozená (neuložená) třída se v citaci přizná, stejně jako potlačené datum
 *  podpisu: co paket upustil, musí být vidět v tom, co se z něj cituje. */
export function buildCiteCs(args: {
  pspId: number;
  name: string;
  club: string | null;
  tie: PacketTie;
  compiledAt: string;
}): string {
  const { name, club, tie: t } = args;
  const info = tieClassInfo(t.tieClass);
  const originNote = t.tieClassOrigin === "derived" ? " (třída odvozená heuristicky, bez rejstříkového zápisu)" : "";
  const stewardRule = t.tieClass === "steward" ? ` Pozn.: ${info.descCs}` : "";
  const reviewed = t.lastReviewedAt
    ? ` Lidsky ověřeno ${czechDate(t.lastReviewedAt.slice(0, 10))}${t.lastReviewer ? ` (${t.lastReviewer})` : ""}.`
    : " Lidsky ověřeno (/penize/kontrola).";
  return (
    `${name}${club ? ` (${club})` : ""} — ${t.company}, IČO ${t.ico}: ` +
    `${t.role || "vazba"}${citePeriod(t)}; třída „${info.labelCs}“${originNote}.` +
    `${reviewed}${citeMoney(t)}${stewardRule}${citeWithheldDates(t)}` +
    ` Zdroj: ${t.source || "znalostní graf politicas"} · registr smluv · ARES VR.` +
    ` Stav ke dni ${czechDate(args.compiledAt)}, živá verze: politicas.cz/penize/${String(args.pspId)}/paket#${t.anchor}`
  );
}

/* ── kompilace ───────────────────────────────────────────────────────────── */

const EVENT_KIND_ORDER: Record<PacketEventKind, number> = {
  "role-start": 0,
  contract: 1,
  review: 2,
  "role-end": 3,
};

function toPacketTie(t: MoneyTieDetail): Omit<PacketTie, "citeCs"> {
  return {
    companyId: t.companyId,
    ico: t.ico,
    company: t.company,
    role: t.role,
    tieClass: t.tieClass,
    tieClassOrigin: t.tieClassOrigin,
    corroboration: t.corroboration ?? null,
    roleValidFrom: t.roleValidFrom ?? null,
    roleValidTo: t.roleValidTo ?? null,
    temporalStatus: t.temporalStatus ?? null,
    contractCount: t.contractCount,
    contractCzk: t.contractCzk,
    subsidiesCount: t.subsidiesCount,
    subsidiesCzk: t.subsidiesCzk,
    donatedToPartyCzk: t.donatedToPartyCzk,
    donationRecipientParty: t.donationRecipientParty,
    reviewNote: t.reviewNote,
    lastDecision: t.lastDecision,
    lastReviewer: t.lastReviewer,
    lastReviewedAt: t.lastReviewedAt,
    source: t.source,
    links: buildRegistryLinks(t.ico, t.source),
    // DATUM, KTERÉ SE NEMOHLO STÁT, DO PAKETU NEVSTUPUJE. Paket je stažitelný
    // svazek orazítkovaný otiskem — hrubou hodnotu, kterou spis poslance nechává
    // projít kvůli vlastnímu přepočtu (viz ContractLine), by tady zapekl do
    // artefaktu, který se po vydání neopravuje. Zůstává důvod (`dateWithheldOn`),
    // takže příjemce pozná potlačené datum od nedatované smlouvy.
    contracts: t.contracts.map((c) => ({ ...c, signedOn: displaySignedOn(c) })),
    contractsMoreCount: t.contractsMoreCount,
    anchor: `p-${t.ico}`,
  };
}

function deriveTimeline(ties: PacketTie[]): {
  events: PacketEvent[];
  undatedContracts: number;
  withheldDateContracts: number;
} {
  const events: PacketEvent[] = [];
  let undated = 0;
  // „Datum nebylo" a „datum bylo nemožné" jsou dvě různá tvrzení a paket je
  // nesmí sloučit do jednoho čísla — dřív spadla obě do `undated`, takže
  // příjemce nepoznal, že se nějaké pole zahodilo.
  let withheld = 0;
  for (const t of ties) {
    const base = { companyId: t.companyId, company: t.company, ico: t.ico };
    if (t.roleValidFrom) {
      events.push({ ...base, date: t.roleValidFrom.slice(0, 10), kind: "role-start", detail: t.role, amountCzk: null });
    }
    if (t.roleValidTo) {
      events.push({ ...base, date: t.roleValidTo.slice(0, 10), kind: "role-end", detail: t.role, amountCzk: null });
    }
    for (const c of t.contracts) {
      const signedOn = displaySignedOn(c);
      if (signedOn) {
        events.push({ ...base, date: signedOn.slice(0, 10), kind: "contract", detail: c.label, amountCzk: c.amountCzk });
      } else if (c.dateWithheldOn != null) {
        withheld++;
      } else {
        undated++;
      }
    }
    if (t.lastReviewedAt) {
      events.push({
        ...base,
        date: t.lastReviewedAt.slice(0, 10),
        kind: "review",
        detail: [t.lastDecision, t.lastReviewer].filter(Boolean).join(" · ") || "lidská kontrola",
        amountCzk: null,
      });
    }
  }
  events.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      EVENT_KIND_ORDER[a.kind] - EVENT_KIND_ORDER[b.kind] ||
      a.companyId.localeCompare(b.companyId) ||
      a.detail.localeCompare(b.detail),
  );
  return { events, undatedContracts: undated, withheldDateContracts: withheld };
}

/**
 * Jedno kliknutí → paket. Čistá funkce spisu poslance (MoneyMpDetail):
 *
 *  1. BRÁNA: dál projde jen `reviewState === "verified"` (striktní rovnost;
 *     parita moneyLoaderu už předtím normalizovala chybějící stav na pending).
 *  2. POŘADÍ: batch-005 review-order (reviewRank vzestupně, tiebreak companyId)
 *     — stejné pravidlo, kterým řadí spis; časová osa vzestupně podle data.
 *  3. PŘIZNÁNÍ: počty vyloučených (pending/rejected), smlouvy nad top-N řez,
 *     nedatované smlouvy a smlouvy s POTLAČENÝM nemožným datem se vracejí jako
 *     čísla k vysázení, nikdy se nezamlčí. Poslední jmenované se navíc přiznává
 *     v samotné CITACI vazby (`citeWithheldDates`) — číslo v patičce zůstane na
 *     obrazovce, kdežto citace putuje do redakce.
 *  4. OTISK: fnv-1a/32 nad kanonickým JSON obsahu (bez compiledAt).
 *     POZOR — OTISK SE U DOTČENÝCH VAZEB MĚNÍ, a je to čekané: řádky smluv do
 *     otisku vstupují a u smlouvy s nemožným datem se v nich nově mění dvě věci
 *     (datum zmizí, přibude `dateWithheldOn`). Dřív měla dvě různá tvrzení —
 *     „datum nebylo" a „datum bylo nemožné" — jeden a týž otisk, a to druhé
 *     nešlo z paketu vůbec poznat. Řádek BEZ potlačení serializuje beze změny
 *     (`canonicalJson` vynechává `undefined`), takže se otisk hne JEN tam, kde
 *     se změnil obsah. Změřeno na živém korpusu: všech 211 vazeb je
 *     `pending_review`, takže dnes žádný vydaný paket žádnou vazbu nenese a
 *     ANI JEDEN existující otisk se nemění.
 */
export function compileEvidencePacket(
  detail: MoneyMpDetail,
  opts: { compiledAt: string },
): EvidencePacket {
  const verified = detail.ties.filter((t) => t.reviewState === "verified");
  const pending = detail.ties.filter((t) => t.reviewState === "pending_review").length;
  const rejected = detail.ties.filter((t) => t.reviewState === "rejected").length;

  const ordered = [...verified].sort(
    (a, b) => a.reviewRank - b.reviewRank || a.companyId.localeCompare(b.companyId),
  );

  const bare = ordered.map(toPacketTie);
  const ties: PacketTie[] = bare.map((t) => ({
    ...t,
    citeCs: buildCiteCs({
      pspId: detail.pspId,
      name: detail.name,
      club: detail.club,
      tie: { ...t, citeCs: "" },
      compiledAt: opts.compiledAt,
    }),
  }));
  const { events, undatedContracts, withheldDateContracts } = deriveTimeline(ties);
  const contractsOmitted = ordered.reduce((n, t) => n + t.contractsMoreCount, 0);
  const exclusions: PacketExclusions = { pending, rejected };

  // Otisk: obsah bez compiledAt a bez citeCs (citace je derivát téhož obsahu
  // + data sestavení; dvě kopie z různých dnů se stejným obsahem musí sedět).
  const hash = contentHash(
    canonicalJson({
      pspId: detail.pspId,
      name: detail.name,
      club: detail.club,
      ties: bare,
      timeline: events,
      exclusions,
    }),
  );

  return {
    pspId: detail.pspId,
    name: detail.name,
    club: detail.club,
    compiledAt: opts.compiledAt,
    ties,
    timeline: events,
    exclusions,
    contractsOmitted,
    undatedContracts,
    withheldDateContracts,
    hash,
    hashAlgorithm: PACKET_HASH_ALGORITHM,
    source: detail.source,
    pass: detail.pass,
  };
}
