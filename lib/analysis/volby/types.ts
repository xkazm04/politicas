// Volby: zrcadlo — the wire-level contract of the election-replay surface (/volby).
// Copied verbatim from docs/spark/ideas/election-replay.md §"Wire-level contract";
// every work package (domain rules, loaders, UI) builds against THESE types. This file
// holds types only — the two runtime constants the brief declares alongside them live
// in ./terms.ts (`TERM_WINDOWS`) and ./kraje.ts (`KRAJ_CROSSWALK`).

export type Arena = "komunalni" | "krajske" | "statni" | "nejasne"; // = company.electoral_arena
export type Ballot = "komunalni" | "krajske" | "snemovni";
export type FindingKind =
  | "tender_konvejer"
  | "tender_dvorni_dodavatel"
  | "tender_rotace"
  | "tender_kratke_lhuty" // N1–N4
  | "tender_cisty_radar" // P1 positive
  | "law_posudek"
  | "law_sponsor_conflict"
  | "law_became_law_clean" // MP→list
  | "effort_workhorse"
  | "effort_rapporteur" // P2/P3 positive
  | "money_ties_unrated" // count only
  | "law_final_vote"; // RECORD row: the chamber's dated outcome on a sponsored bill
export type Valence = "negative" | "positive" | "unrated";
export type Severity = "low" | "medium" | "high";
export interface Finding {
  id: string; // `${kind}:${subjectId}[:${objectId}]` — stable; React key + anchor
  kind: FindingKind;
  valence: Valence;
  severity: Severity;
  subjectId: string; // "company:ico:<8>" | "list:<partyListPspId>" | "person:<pspId>"
  objectId: string | null; // e.g. "bill:<tisk>" | winner "company:ico:<8>"
  decidedOn: string | null; // ISO date of the choice (wins.decided_on / bill sponsorship / vote)
  laterOn: string | null; // ISO date of the later dated fact (fate_published_on, forensic_provenance date, flags_provenance date)
  laterKind: "fate_sb" | "forensic_verdict" | "collision_detected" | "flags_computed" | "final_vote" | null;
  reviewState: "verified" | "pending_review" | "deterministic"; // deterministic = rule over register facts
  figures: Record<string, number>; // rule inputs, e.g. { share: 0.33, baseline: 0.037, multiple: 8.9 }
  ruleRef: string; // "volby:N1" … "volby:P3" — /metodika anchor
  evidence: { label: string; ref: string }[]; // ref = h.<edge> | u.<node> | claim:… (features/shared/provenance/claimRef)
}
export interface SeverityLedger {
  counts: Record<Valence, Record<Severity, number>>;
  total: number;
  baseline: { label: string; share: number; source: string } | null; // arena baseline (live census) or chamber median
}
export interface TermWindow {
  ballot: Ballot;
  from: string;
  to: string | null;
  label: string;
  source: string;
}
export interface KrajRow {
  slug: string;
  pspLabel: string;
  nuts: string;
  volkraj: number;
  krajIco: string;
  name: string;
}
export interface SubjectCard {
  subjectId: string;
  ballot: Ballot;
  label: string;
  href: string;
  ledger: SeverityLedger;
  findings: Finding[];
  timeline: Finding[] /* laterOn != null, sorted desc */;
}
export interface ListSummary {
  slug: string;
  label: string;
  seats: number;
  ledger: SeverityLedger;
  clubsToday: Record<string, number>;
}
export interface Provenance {
  pass: number | null;
  computedAt: string;
  sources: string[];
  counts: Record<string, number>;
}
export interface ObecData {
  obec: { ico: string; name: string; county: string; krajSlug: string; population: number };
  komunalni: SubjectCard | null;
  unlinked: { nejasneNational: number; note: "nepropojeno" };
  krajCard: SubjectCard | null;
  lists: ListSummary[];
  provenance: Provenance;
}
export interface KrajData {
  kraj: KrajRow;
  krajske: SubjectCard | null;
  lists: ListSummary[];
  mps: { pspId: number; name: string; listSlug: string; club: string | null }[];
  provenance: Provenance;
}
export interface RecordRow {
  votePspId: number;
  title: string;
  votedOn: string;
  contestedness: number;
  line: "yes" | "no" | "split";
  yes: number;
  no: number;
}
export interface ListData {
  list: ListSummary;
  card: SubjectCard;
  members: { pspId: number; name: string; region: string | null; club: string | null; findings: Finding[] }[];
  contested: RecordRow[];
  pinnedKraj: string | null;
  provenance: Provenance;
}
export interface VolbyHomeData {
  census: { arena: Arena; authorities: number; lots: number; flaggedShare: number; czkFloor: number }[];
  latest: Finding[] /* 20 */;
  lists: ListSummary[];
  provenance: Provenance;
}
