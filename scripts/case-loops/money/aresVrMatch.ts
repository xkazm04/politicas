/* ONE ARES-VR matcher (scan-sweep 2026-09-07). reconcile-ares-vr.ts (batch 002, the main
 * writer of corroboration / role dates / tie_class) and reverify-open-vs-live-ares-vr.ts
 * (batch 008) each carried the VR record shape, `findMatches` and the merge of a person's
 * entries, held together by the comment "same match discipline as reconcile-ares-vr.ts".
 * Two copies of an identity rule are two rules the day one of them is fixed.
 *
 * The rule: a VR entry belongs to the MP when its person's birth date EXACTLY equals the
 * roster birth date (`lib/analysis/money-feed.ts`'s bridgePerson discipline - never a
 * name-only guess), over statutární orgány, ostatní orgány (dozorčí rada, kontrolní komise -
 * most `steward` seats live there) and společníci. */

/* ── ARES VR raw shape (only the fields we read) ─────────────────────────────── */
export interface VrFunkce {
  vznikFunkce?: string;
  zanikFunkce?: string;
  nazev?: string;
}
export interface VrFyzickaOsoba {
  datumNarozeni?: string;
  jmeno?: string;
  prijmeni?: string;
}
export interface VrClenOrganu {
  datumZapisu?: string;
  datumVymazu?: string;
  clenstvi?: { funkce?: VrFunkce };
  fyzickaOsoba?: VrFyzickaOsoba;
}
export interface VrStatutarniOrgan {
  clenoveOrganu?: VrClenOrganu[];
}
export interface VrPodil {
  datumZapisu?: string;
  datumVymazu?: string;
  velikostPodilu?: { typObnos?: string; hodnota?: string };
}
export interface VrSpolecnikOsoba {
  datumZapisu?: string;
  datumVymazu?: string;
  podil?: VrPodil[];
  osoba?: { fyzickaOsoba?: VrFyzickaOsoba };
}
export interface VrSpolecnici {
  spolecnik?: VrSpolecnikOsoba[];
}
export interface VrZaznam {
  primarniZaznam?: boolean;
  stavSubjektu?: string;
  statutarniOrgany?: VrStatutarniOrgan[];
  /** Supervisory/other bodies (dozorčí rada, kontrolní komise, …) — SAME shape as
   *  statutarniOrgany. Most `steward` ties are exactly these supervisory-board seats,
   *  so omitting this section would systematically under-confirm the steward class. */
  ostatniOrgany?: VrStatutarniOrgan[];
  spolecnici?: VrSpolecnici[];
}
export interface VrResponse {
  kod?: string; // "NENALEZENO" on a miss
  zaznamy?: VrZaznam[];
}

export interface MatchedEntry {
  kind: "officer" | "shareholder";
  functionName: string | null;
  validFrom: string | null;
  validTo: string | null; // null = ongoing
  stakePct: number | null;
}

/** Find every VR entry whose person birth date exactly matches `birthDate`. */
export function findMatches(rec: VrZaznam, birthDate: string): MatchedEntry[] {
  const out: MatchedEntry[] = [];
  for (const org of [...(rec.statutarniOrgany ?? []), ...(rec.ostatniOrgany ?? [])]) {
    for (const m of org.clenoveOrganu ?? []) {
      if (m.fyzickaOsoba?.datumNarozeni === birthDate) {
        out.push({
          kind: "officer",
          functionName: m.clenstvi?.funkce?.nazev ?? null,
          validFrom: m.clenstvi?.funkce?.vznikFunkce ?? m.datumZapisu ?? null,
          validTo: m.clenstvi?.funkce?.zanikFunkce ?? m.datumVymazu ?? null,
          stakePct: null,
        });
      }
    }
  }
  for (const grp of rec.spolecnici ?? []) {
    for (const s of grp.spolecnik ?? []) {
      if (s.osoba?.fyzickaOsoba?.datumNarozeni === birthDate) {
        const activePodil = (s.podil ?? []).find((p) => !p.datumVymazu) ?? s.podil?.[s.podil.length - 1];
        const pct =
          activePodil?.velikostPodilu?.typObnos === "PROCENTA" && activePodil.velikostPodilu.hodnota
            ? Number(activePodil.velikostPodilu.hodnota.replace(",", "."))
            : null;
        out.push({
          kind: "shareholder",
          functionName: "společník",
          validFrom: s.datumZapisu ?? null,
          validTo: s.datumVymazu ?? null,
          stakePct: Number.isFinite(pct) ? pct : null,
        });
      }
    }
  }
  return out;
}

/** The person's entries folded into one span: earliest start, an ongoing entry keeps the span
 *  open (else the latest end), distinct role names, the first stake found. Several entries for
 *  the SAME person (a role change, a re-election) are the normal case; true ambiguity - two
 *  different people sharing an exact birth date - is a documented batch-002 limitation VR does
 *  not expose cheaply. */
export function mergeMatches(matches: MatchedEntry[]): {
  validFrom: string | null;
  validTo: string | null;
  stakePct: number | null;
  roles: string[];
} {
  const roles = [...new Set(matches.map((m) => m.functionName).filter((x): x is string => !!x))];
  const froms = matches.map((m) => m.validFrom).filter((x): x is string => !!x).sort();
  const anyOngoing = matches.some((m) => !m.validTo);
  const tos = matches.map((m) => m.validTo).filter((x): x is string => !!x).sort();
  const stake = matches.find((m) => m.stakePct != null)?.stakePct ?? null;
  return {
    validFrom: froms[0] ?? null,
    validTo: anyOngoing ? null : (tos[tos.length - 1] ?? null),
    stakePct: stake,
    roles,
  };
}
