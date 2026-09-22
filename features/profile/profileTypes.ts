// Shared shapes for the MP case file (/poslanec/<pspId>). Plain module (no
// server imports) so both the server loader (getProfileData.ts) and any client
// surface can import these. `import type` only — every module referenced here is
// itself pure (checked 2026-09-01: absenceRecord, profileMoney, careerSpine,
// score-legibility, provenance, leaderboardTypes).

import type { LeaderboardData, ProfileEntry } from "@/features/civicscore/leaderboardTypes";
import type { ContributionProvenance } from "@/features/civicscore/provenance";
import type { ScoreLegibility } from "@/lib/analysis/score-legibility";
import type { ProfileAbsenceRecord } from "./absenceRecord";
import type { ProfileMoney } from "./profileMoney";
import type { CareerSpine } from "./careerSpine";

export interface CoVoter {
  pspId: number;
  name: string;
  clubAbbrev: string;
  clubColor: string;
  agreement: number; // 0–1
  shared: number; // ballots compared
}

/**
 * Agregát odchylek od klubu — SNÍMEK, který napsal dávkový průchod
 * (`lib/analysis/kg.ts::rebellion`, hrana `rebels_against`).
 *
 * Není to součet toho, co pod ním na spisu stojí. Jmenovité rebelie
 * (`RebellionInstances`) jsou ŽIVÁ derivace deníku hlasování, takže se ta dvě
 * čísla liší strukturálně, ne omylem: jiný ročník (nové hlasování zvětší výpis
 * a agregátu se nedotkne až do dalšího průchodu), jiný práh (agregát vzniká až
 * od `MIN_ELIGIBLE_VOTES`, kronika žádný práh nemá), jiný jmenovatel (agregát
 * zahodí hlas, u kterého mandát nedá zároveň osobu i klub) a jiné klíčování
 * (agregát klíčuje podle OSOBY, takže poslanci, který přestoupil, splyne celý
 * záznam do jednoho řádku pod prvním klubem; kronika nese klub každého hlasu).
 * Stránka to říká vlastní větou — dvě poctivá měření vedle sebe, ne jedno.
 */
export interface Rebellion {
  club: string; // club rebelled against
  /**
   * `rate` / `rebelVotes` / `eligibleVotes`: `null` znamená, že hrana tu
   * vlastnost NENESE. `num()` by z chybějící hodnoty udělal tvrdou nulu, tedy
   * výrok o člověku vyrobený z mezery v datech — táž disciplína jako
   * `speechTurnsTotal` a spol. o pár desítek řádků níž. Dnes `kg-compute`
   * zapisuje všechny tři vždy, takže je to LATENTNÍ, ne živá vada.
   */
  rate: number | null; // 0–1
  rebelVotes: number | null;
  eligibleVotes: number | null;
  /** Průchod, který ten snímek napsal (`provenance` hrany). Jediná citace toho
   *  oddílu byla „graf rebels-against · odchylky od klubu" — bez průchodu, data
   *  i datové sady — vedle živé derivace, která plnou datovanou citaci nese. */
  pass: number | null;
  ref: string | null;
  computedAt: string | null;
}

export interface CommitteeSeat {
  abbrev: string;
  organType: string | null;
  role: string; // "member" | "předseda" | …
  weight: number; // role rank
  // batch-006 (Case ② effort loop): current/past window, so a seat vacated on taking a
  // ministerial post doesn't render as an active committee membership. This profile section
  // had the same defect as the effort army's extract-dossiers.ts, since it also read
  // influential_in edges — which are built only over organs that are DIRECT CHILDREN of the
  // chamber AND typed /v[ýy]bor|komis/i (so "Delegace" seats vanish), and which carry no
  // fromAt/toAt at all.
  current: boolean;
  fromAt: string | null;
  toAt: string | null;
  /** `toAt` is present but not a parseable date. Such a seat used to fall into
   * `Date.parse(...) > now === false` and render as an ENDED seat — an unreadable
   * end date silently presented as a fact about the MP. It is now rendered as a
   * seat whose end date could not be read, which is what the data actually says. */
  toAtUnreadable: boolean;
}

/** A bill this MP sponsors, resolved to its psp.cz historie.sqw link.
 * IMPORTANT: the URL is built from `cislo` (the public print number), NEVER
 * from the internal `tiskId` — the two are unrelated ids and historie.sqw
 * only resolves the former (batch-005 handoff §"known gotcha", independently
 * rediscovered by multiple effort-loop army groups). `cislo === null` (rare,
 * ingest gap) renders the title with no link rather than a broken one. */
export interface SponsoredBill {
  cislo: number | null;
  title: string;
  url: string | null;
  /** Internal dossier route (/zakony/<cislo>) — the app's own bill detail. */
  appUrl: string | null;
  /** Signature role from predkladatel.poradi (pass 34): rank 1 = předložil,
   * else spolupodepsal; null when the edge predates the roles backfill. */
  role: "predkladatel" | "spolupodepsal" | null;
  joinedLater: boolean;
  /** Current procedural state (Czech typ_stavu name) + Sbírka publication when
   * the print became law — both from psp.cz tisky/hist (pass 34), never derived. */
  stav: string | null;
  fateSb: string | null;
}

/** A bill this MP is zpravodaj (rapporteur) for — the assigned analytical role,
 * a stronger work signal than co-signature (psp.cz hist/hist_vybory/tisky_za). */
export interface RapporteurBill {
  cislo: number | null;
  title: string;
  appUrl: string | null;
  url: string | null;
  scopes: string[];
}

// The Peníze section's payload lives in ./profileMoney.ts — a PURE projection of
// `MoneyMpDetail`, the object /penize/[pspId]'s own loader returns. It is re-exported
// here because the page and its components import the profile's shapes from one module.
export type { ProfileContractLine, ProfileMoney, ProfileMoneyTie } from "./profileMoney";

/**
 * One bill this MP engaged with beyond signing it — a floor debate or a written
 * amendment. Both come from the pass-35 engagement layer over psp.cz's own
 * records (`spoke_on` from steno/rec, `proposes_amendment` from sd_dokument
 * typ 13) and both are per-BILL, so the profile can print what the work was
 * about instead of a bare total.
 */
export interface BillEngagement {
  cislo: number | null;
  title: string;
  appUrl: string | null;
  url: string | null;
  /** speaking turns on this bill, or written amendments filed to it. */
  count: number;
  /**
   * Sněmovní-dokument numbers of the written amendments on this bill
   * (`proposes_amendment.props.sd_cislos`, sd.zip / sd_dokument typ 13) —
   * ascending. Each one is a psp.cz page carrying the TEXT of that amendment
   * (`lib/kg/sourceLinks.ts` `snemovniDokumentLink`), so the row can offer the
   * document instead of only counting it.
   *
   * ALWAYS EMPTY for `spoke_on`: a floor turn has no such document, and inventing
   * one would be the guessed URL rule 1 of sourceLinks.ts forbids. Empty is also
   * the honest answer for an amendment edge the ingest recorded without numbers —
   * the count still renders, the links do not.
   *
   * `count` (the edge weight) stays AUTHORITATIVE. Where the two disagree the page
   * says so rather than presenting the list as the total; nothing is repaired here.
   */
  sdCislos: number[];
}

export interface ProfileData {
  // `ProfileEntry` = the ranked chamber entry PLUS the two fields only this page
  // reads (`trend`, `effortPublicRole`) — the chamber pass no longer computes those
  // 207 times per request; `toProfileEntry()` attaches them for this one MP from the
  // person props that pass already read. See ProfileOnlyFields.
  person: ProfileEntry; // includes rank
  total: number; // 207
  prevPspId: number;
  nextPspId: number;
  components: LeaderboardData["components"];
  /**
   * Per-component legibility: this MP's value in the component's OWN unit, the
   * scorer's cap, the chamber median, and the rank the real ranked chamber would
   * put them at with that component saturated. All DERIVED (labelled as such
   * on-page) and computed from the chamber pass the loader has already done —
   * no second read. See lib/analysis/score-legibility.ts.
   */
  legibility: ScoreLegibility;
  coVoters: CoVoter[];
  /** Allies the co-voting graph holds for this MP, BEFORE `PROFILE_ALLY_ROWS`.
   *  The page prints the remainder rather than swallowing it (the
   *  `moneyMoreContracts` / `rebelInstancesMore` rule). */
  coVotersTotal: number;
  rebellions: Rebellion[];
  committees: CommitteeSeat[];
  /**
   * The date the committee seats' current/past split was evaluated against.
   * The page states it, because `/poslanec/<id>` is statically generated: without
   * it the reader has no way to know how old "současné" is. Paired with the
   * route's `revalidate`, which bounds how stale it can get.
   */
  seatsAsOf: string; // ISO yyyy-mm-dd
  /**
   * The number of the term this loader actually reads (`PSP10` → 10), derived by
   * `termNumberOf` and never written as a digit in copy. The header's period note
   * used to hard-code „10. volební období" in both catalogs while the term code
   * lived here — the same drift /zebricek and /penize each had to fix once.
   * `null` if the code is not of the `PSP<n>` shape; the page then omits the claim.
   */
  termNumber: number | null;
  /** Contribution-index pass that authored this MP's score — cited on-page. Null when
   *  the chamber does NOT agree on one pass (a partial recompute); see `provenance`. */
  provenancePass: number | null;
  /** Chamber-wide provenance aggregate + formula-ref comparison — the spis says on its
   *  own face when the score it prints was authored by an older version of the formula. */
  provenance: ContributionProvenance;
  // Tenure annotation (batch 003, Q-effort-5) — deterministic, from
  // membership.fromAt/toAt on organ 174. May be absent for the ~0/207 MPs
  // missing a chamber membership row (see tenure.ts's `missing` list).
  effortTenureDays: number | null;
  effortTenureClass: string | null;
  effortTenureStart: string | null;
  effortTenureEnd: string | null;
  // Dossier layer (batch 001+, effort-loop enrichment) — free-text/array props
  // written by a deterministic-gated Sonnet/Opus pipeline from psp.cz + public
  // registries (lib/analysis/*, scripts/case-loops/effort/*), never ad hoc.
  // 165/207 MPs carry at least one of these as of batch 005; graceful null for
  // the rest — see ProfilePage's DossierSection for the render-or-omit rule.
  effortWorkThemes: string[] | null;
  effortBillFocus: string | null;
  effortNotes: string | null;
  effortDataFlag: string | null;
  /**
   * `effort_psp9_trend_note` — the analyst's reading of the SAME PSP9→PSP10
   * comparison `person.trend` computes. 13/207 nodes carry it; 6 of those pass
   * the public-copy guard (the other 7 quote raw prop identifiers and are
   * withheld whole, like every other effort_* prose field here).
   *
   * It is the only cross-term prose the graph holds, and it renders BESIDE the
   * trend — both where the panel shows and where TenureTrendGate suppresses it,
   * so a reader never loses the comparison entirely just because the rates are
   * unsafe to print. `CROSS_TERM_PROSE_FIELDS` (lib/analysis/committee-claims.ts)
   * already exempts it from the committee-count cross-check for that reason: its
   * two committee numbers describe two different terms.
   */
  effortPsp9TrendNote: string | null;
  /**
   * WHICH RUNG each person-level verdict stands on (G2, deck #12, 2026-09-04),
   * keyed by the prop it is about. Derived by `readVerdictRung`
   * (lib/analysis/verdict-provenance.ts) off `effort_provenance.verdicts`.
   *
   * A field ABSENT from this map was never stamped by the loop: the badge then
   * prints no rung rather than defaulting to `machine`, because assuming a
   * provenance is the same act as inventing one. `rejected` means the badge
   * WITHHOLDS the claim and shows the refusal instead — a vanished badge would
   * be a second claim, made silently, that nobody decided.
   */
  effortVerdictRungs: Record<
    string,
    { rung: "machine" | "pending" | "verified" | "rejected"; decidedBy: string | null; decidedAt: string | null }
  >;
  sponsoredBills: SponsoredBill[];
  /** Q-effort-2 split of bills_authored (pass 34): first-signatory vs co-signer
   * counts over the same universe — sums to bills_authored, which stays untouched. */
  billsFirstSigned: number | null;
  billsCoSigned: number | null;
  rapporteurBills: RapporteurBill[];
  /** Written amendments authored on the graph's law bills (pass 35, sd_dokument typ 13). */
  amendmentsAuthored: number | null;
  /** Floor debates, per bill (`spoke_on`). Covers ONLY bills the graph carries —
   *  `person.speechTurns` is the MP's whole floor record, of which this is the part
   *  that can be tied to a print. The section says so. */
  floorSpeeches: BillEngagement[];
  /** Σ `floorSpeeches[].count` — turns attributable to a bill in the graph. */
  floorSpeechTurns: number;
  /** Written amendments, per bill (`proposes_amendment`). */
  amendmentBills: BillEngagement[];
  /** Σ `amendmentBills[].count` — compared against `amendmentsAuthored` on-page, so
   *  a breakdown that does not account for the whole total admits the gap. */
  amendmentBillCount: number;
  /**
   * Three counters the index consumed but the profile never showed. Read straight
   * off the person node (not off `LeaderboardEntry`, whose `num()` turns an ABSENT
   * prop into 0) so a node without the prop can say "údaj v grafu chybí" instead of
   * asserting that the MP never spoke, never interpellated, and was never absent.
   */
  speechTurnsTotal: number | null;
  interpellations: number | null;
  absenceRate: number | null;
  /**
   * Ta míra po dnech. `absence_rate` je jedno číslo, jehož čitatel — dny
   * s podanou omluvou — dosud nikde nestál, přestože evidence je datovaná
   * a časovaná (`absence`, 6 425 řádků za PSP10). Tady jsou její řádky.
   *
   * `null` NENÍ prázdný záznam: znamená, že se evidence nepodařilo přečíst
   * (nebo že poslanec v období nemá mandátní řádek, kterým by se dala klíčovat),
   * a oddíl pro to má vlastní větu. Prázdný záznam = poslanec nemá ani jednu
   * omluvu, což je odpověď, ne výpadek.
   */
  absence: ProfileAbsenceRecord | null;
  /** `linked_to` money ties (all `pending_review` at pass 41) + the contracts the
   *  attribution rule permits attaching to them. See `ProfileMoney`. */
  money: ProfileMoney;
  /**
   * Kariérní spis — the MP's service record across parliamentary terms
   * (mandate rows are ingested for ALL terms PSP1–PSP10; activity data only
   * for PSP10 + a partial PSP9 — the spine discloses coverage per term).
   * See features/profile/careerSpine.ts for the derivation contract.
   */
  career: CareerSpine;
}
