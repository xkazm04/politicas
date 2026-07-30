// Velín smyček (loop mission control, batch-6 item 6E) — ČISTÁ derivace
// strojově čitelného stavu analytických smyček. Zdrojový návrh:
// data-ingestion.md § Admin Console M2. Konvence lib/analysis/tripwires.ts:
// žádné DB ani server importy, vstupy jsou typované řádky, loader
// (getLoopState.ts) je tenká IO slupka a všechno tady je unit-testované
// (loopState.test.ts).
//
// CO STAV SMYČEK VE SKUTEČNOSTI JE (poctivost před ambicí): case-smyčky
// (money/effort/law) po sobě nechávají ručně psané žurnály (ledger.json,
// graph-log.md pass hlavičky) — nesou POŘADÍ A DATUM passů, ale žádná trvání
// ani příčiny selhání; to se tu přiznává („nehodnoceno“), nefabrikuje.
// Ingest běhy (tabulka ingest_run) naopak nesou start/konec/stav/poznámku,
// takže trvání, příčiny selhání i série selhání jsou skutečně odvoditelné.
//
// SLOVNÍK KADENCE je sdílený s Atlasem kvality (batch-6 §6D, lib/analysis/
// atlas.ts — koherence přes ZNĚNÍ, ne importy; různé plochy): „kadence“ =
// deklarovaný očekávaný interval obnovy; stáří ≤ kadence → „čerstvé“;
// ≤ 2× kadence → „stárnoucí“; > 2× kadence → „zastaralé“. Práh kadence × 2
// je zároveň hranice výstrahy „stalled“. Bez podkladu → „nehodnoceno“,
// nikdy 0 a nikdy vymyšlený stav.

import { canonicalJson, contentHash } from "@/features/dashboard/exhibit";

export const LOOPS_SCHEMA = "politicas.loops/1";

/** Hranice „zastaralé“/„stalled“: stáří > kadence × 2 (týž násobek jako 6D). */
export const STALLED_CADENCE_MULTIPLIER = 2;

/** Výstraha série selhání: ≥ 2 po sobě jdoucí neúspěšné dokončené běhy. */
export const FAILURE_STREAK_THRESHOLD = 2;

/** Slovní pásmo stáří vůči kadenci — sdílený slovník s /atlas (6D). */
export type LoopStaleness = "čerstvé" | "stárnoucí" | "zastaralé";

/**
 * Deklarovaná kadence obnovy per ingest zdroj, ve dnech — OČEKÁVÁNÍ politicas,
 * ne SLA vydavatele. Hodnoty drží slovo s 6D (lib/analysis/atlas.ts
 * SOURCE_CADENCE_DAYS — záměrně bez importu, jiná plocha). Zdroj bez
 * deklarované kadence má čerstvost „nehodnoceno“ a nikdy nehlásí „stalled“.
 */
export const LOOP_CADENCE_DAYS: Readonly<Record<string, number>> = {
  "psp-poslanci": 7,
  "psp-hlasovani": 7,
  "pumper-psp-opendata": 1,
};

/* ── vstupní tvary (plní je loader, čistě z existujících čtecích cest) ────── */

/** Jedna pass hlavička z docs/data-analysis/graph-log.md. */
export interface CasePassIn {
  pass: number;
  track: string;
  title: string;
  date: string; // YYYY-MM-DD
}

/** Postup jedné case-smyčky (projekce LoopCaseProgress z getAdminData). */
export interface CaseLoopIn {
  id: string; // "money" | "effort" | "law"
  labelCs: string;
  batchesCompleted: number | null;
  unitsProcessed: number | null;
  unitsTotal: number | null;
  openFrontier: number | null;
}

/** Jeden ingest běh (řádek ingest_run přes store.listIngestRuns). */
export interface IngestRunIn {
  source: string;
  startedAt: string; // ISO
  finishedAt: string | null;
  status: "running" | "ok" | "failed";
  rowsWritten: number;
  note: string | null;
}

export interface LoopStateInputs {
  /** Okamžik hodnocení (ISO) — vstup, ne Date.now(); drží determinismus. */
  now: string;
  /** Case-smyčky jsou v manifestační fázi pozastavené (getAdminData konstanta). */
  loopsPaused: boolean;
  caseLoops: ReadonlyArray<CaseLoopIn>;
  casePasses: ReadonlyArray<CasePassIn>;
  ingestRuns: ReadonlyArray<IngestRunIn>;
  cadenceDays?: Readonly<Record<string, number>>;
}

/* ── výstup ────────────────────────────────────────────────────────────────── */

export type LoopKind = "case" | "ingest";

export type LoopRunStatus =
  | "pozastaveno" // case-smyčka v manifestační fázi
  | "v pořádku" // poslední dokončený běh uspěl / smyčka má záznam
  | "běží" // ingest běh startedAt bez finishedAt
  | "selhává" // poslední dokončený běh selhal
  | "neznámo"; // žádný záznam

export interface LoopStatus {
  id: string; // "case:money" | "ingest:psp-hlasovani"
  kind: LoopKind;
  labelCs: string;
  status: LoopRunStatus;
  /** Poslední zaznamenaná aktivita (ISO datum passu / dokončení běhu). */
  lastActivityAt: string | null;
  /** Lidský popisek poslední aktivity (pass #N — titul / poznámka běhu). */
  lastActivityLabel: string | null;
  /** Trvání posledního dokončeného běhu v ms; case-žurnály trvání nenesou → null. */
  lastDurationMs: number | null;
  /** Proč je trvání null (poctivé nehodnoceno), jinak null. */
  durationNote: string | null;
  /** Poznámka posledního neúspěšného běhu; case-žurnály selhání nenesou → null. */
  lastFailureCause: string | null;
  /** Po sobě jdoucí neúspěšné dokončené běhy, od nejnovějšího. */
  failureStreak: number;
  cadenceDays: number | null;
  /** Dokončení posledního ÚSPĚŠNÉHO běhu (ISO); case-smyčky nemají běhy → null. */
  lastOkFinishedAt: string | null;
  /** Stáří poslední úspěšné obnovy ve dnech (1 des. místo), ≥ 0. */
  ageDays: number | null;
  /** null = „nehodnoceno“ — důvod v stalenessReason. */
  staleness: LoopStaleness | null;
  stalenessReason: string | null;
  /** Očekávaná další obnova = poslední úspěch + kadence (ISO); bez kadence null. */
  nextExpectedAt: string | null;
  /** Postup case-smyčky (jen kind=case, jinak null). */
  progress: {
    batchesCompleted: number | null;
    unitsProcessed: number | null;
    unitsTotal: number | null;
    openFrontier: number | null;
  } | null;
}

export type LoopAlertKind = "stalled" | "failure-streak";

export interface LoopAlert {
  /** Stabilní otisk stavu (fnv-1a nad kanonickým JSON) — potvrzení (ack) se
   *  váže na tento otisk; změní-li se stav, výstraha se vrací jako nová. */
  id: string;
  loopId: string;
  kind: LoopAlertKind;
  messageCs: string;
  /** Od kdy stav trvá (ISO poslední úspěšné obnovy / prvního selhání série). */
  since: string | null;
}

export interface LoopsDerived {
  loops: LoopStatus[];
  alerts: LoopAlert[];
}

/* ── pomocné derivace ──────────────────────────────────────────────────────── */

const MS_PER_DAY = 86_400_000;

/** Stáří ve dnech mezi dvěma ISO okamžiky, ohraničené zdola nulou (posun hodin
 *  se čte jako čerstvý, ne záporný) — týž tvar jako 6D. */
export function ageDaysBetween(nowIso: string, thenIso: string): number | null {
  const now = Date.parse(nowIso);
  const then = Date.parse(thenIso);
  if (Number.isNaN(now) || Number.isNaN(then)) return null;
  return Math.max(0, (now - then) / MS_PER_DAY);
}

/** Slovní pásmo stáří vůči kadenci — doslova stejná pásma jako 6D. */
export function stalenessOf(ageDays: number, cadenceDays: number): LoopStaleness {
  if (ageDays <= cadenceDays) return "čerstvé";
  if (ageDays <= cadenceDays * STALLED_CADENCE_MULTIPLIER) return "stárnoucí";
  return "zastaralé";
}

/**
 * Pass hlavičky z graph-log.md — týž regex, jakým getAdminData čte VaultHeads
 * (formát `## Pass N (track: t) — titul (YYYY-MM-DD)`), tady exportovaný jako
 * čistá funkce, aby derivace i loader četly jedním parserem.
 */
export function parsePassLog(text: string): CasePassIn[] {
  const re = /^##\s+Pass\s+(\d+)\s*\(track:\s*([a-z]+)\)\s*[—-]\s*(.+?)\s*\((\d{4}-\d{2}-\d{2})\)\s*$/gm;
  const entries: CasePassIn[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    entries.push({ pass: Number(m[1]), track: m[2], title: m[3], date: m[4] });
  }
  entries.sort((a, b) => a.pass - b.pass);
  return entries;
}

const CASE_DURATION_NOTE =
  "žurnál case-smyčky (ledger + pass hlavičky) trvání běhů nezaznamenává — nehodnoceno, nefabrikuje se";
const CASE_TRACK_LABELS: Readonly<Record<string, string>> = {
  sources: "Zdrojová smyčka (track: sources)",
};

function caseLoopStatus(
  input: CaseLoopIn,
  passes: CasePassIn[],
  loopsPaused: boolean,
): LoopStatus {
  const last = passes.length ? passes[passes.length - 1] : null;
  const stalenessReason = loopsPaused
    ? "smyčka pozastavena (manifestační fáze) — kadence se neměří, „stalled“ se nehlásí"
    : "kadence case-smyčky není deklarována — stáří bez měřítka není stav";
  return {
    id: `case:${input.id}`,
    kind: "case",
    labelCs: input.labelCs,
    status: loopsPaused ? "pozastaveno" : last ? "v pořádku" : "neznámo",
    lastActivityAt: last ? last.date : null,
    lastActivityLabel: last ? `pass #${last.pass} — ${last.title}` : null,
    lastDurationMs: null,
    durationNote: CASE_DURATION_NOTE,
    lastFailureCause: null,
    failureStreak: 0,
    cadenceDays: null,
    lastOkFinishedAt: null,
    ageDays: null,
    staleness: null,
    stalenessReason,
    nextExpectedAt: null,
    progress: {
      batchesCompleted: input.batchesCompleted,
      unitsProcessed: input.unitsProcessed,
      unitsTotal: input.unitsTotal,
      openFrontier: input.openFrontier,
    },
  };
}

function ingestLoopStatus(
  source: string,
  runs: IngestRunIn[], // newest first
  nowIso: string,
  cadence: Readonly<Record<string, number>>,
): LoopStatus {
  const last = runs[0] ?? null;
  const lastFinished = runs.find((r) => r.finishedAt != null && r.status !== "running") ?? null;
  const lastOk = runs.find((r) => r.status === "ok" && r.finishedAt != null) ?? null;
  const lastFailed = runs.find((r) => r.status === "failed") ?? null;

  let failureStreak = 0;
  for (const r of runs) {
    if (r.status === "running") continue; // rozběhnutý běh sérii nepřerušuje ani neprodlužuje
    if (r.status === "failed") failureStreak++;
    else break;
  }

  let lastDurationMs: number | null = null;
  if (lastFinished?.finishedAt) {
    const a = Date.parse(lastFinished.startedAt);
    const b = Date.parse(lastFinished.finishedAt);
    if (!Number.isNaN(a) && !Number.isNaN(b) && b >= a) lastDurationMs = b - a;
  }

  const cadenceDays = cadence[source] ?? null;
  let ageDays: number | null = null;
  let staleness: LoopStaleness | null = null;
  let stalenessReason: string | null = null;
  let nextExpectedAt: string | null = null;

  if (!lastOk?.finishedAt) {
    stalenessReason = "žádný dokončený úspěšný běh zdroje — čerstvost nehodnocena";
  } else {
    const age = ageDaysBetween(nowIso, lastOk.finishedAt);
    if (age == null) {
      stalenessReason = "okamžik posledního úspěšného běhu nelze přečíst";
    } else {
      ageDays = Math.round(age * 10) / 10;
      if (cadenceDays == null) {
        stalenessReason = "kadence zdroje není deklarována — stáří bez měřítka není stav";
      } else {
        staleness = stalenessOf(age, cadenceDays);
        nextExpectedAt = new Date(Date.parse(lastOk.finishedAt) + cadenceDays * MS_PER_DAY).toISOString();
      }
    }
  }

  const status: LoopRunStatus =
    last == null
      ? "neznámo"
      : last.status === "running"
        ? "běží"
        : last.status === "failed"
          ? "selhává"
          : "v pořádku";

  return {
    id: `ingest:${source}`,
    kind: "ingest",
    labelCs: `Ingest „${source}“`,
    status,
    lastActivityAt: last ? (last.finishedAt ?? last.startedAt) : null,
    lastActivityLabel: last
      ? `běh ${last.status === "ok" ? "uspěl" : last.status === "failed" ? "selhal" : "běží"}${last.note ? ` — ${last.note}` : ""}`
      : null,
    lastDurationMs,
    durationNote: lastDurationMs == null ? "žádný dokončený běh s čitelným startem i koncem" : null,
    lastFailureCause: lastFailed ? (lastFailed.note ?? "běh selhal bez poznámky") : null,
    failureStreak,
    cadenceDays,
    lastOkFinishedAt: lastOk?.finishedAt ?? null,
    ageDays,
    staleness,
    stalenessReason,
    nextExpectedAt,
    progress: null,
  };
}

/* ── hlavní derivace ───────────────────────────────────────────────────────── */

const alertId = (payload: unknown): string => contentHash(canonicalJson(payload));

export function deriveLoopState(inputs: LoopStateInputs): LoopsDerived {
  const cadence = inputs.cadenceDays ?? LOOP_CADENCE_DAYS;

  // case-smyčky: deklarované ledgery + vedlejší tracky, které pass log zná
  // (např. track "sources"), poctivě bez postupu.
  const passByTrack = new Map<string, CasePassIn[]>();
  for (const p of inputs.casePasses) {
    const list = passByTrack.get(p.track) ?? [];
    list.push(p);
    passByTrack.set(p.track, list);
  }
  const knownCases = new Set(inputs.caseLoops.map((c) => c.id));
  const caseStatuses: LoopStatus[] = inputs.caseLoops.map((c) =>
    caseLoopStatus(c, passByTrack.get(c.id) ?? [], inputs.loopsPaused),
  );
  const extraTracks = [...passByTrack.keys()].filter((t) => !knownCases.has(t)).sort();
  for (const track of extraTracks) {
    caseStatuses.push(
      caseLoopStatus(
        {
          id: track,
          labelCs: CASE_TRACK_LABELS[track] ?? `Vedlejší track „${track}“`,
          batchesCompleted: null,
          unitsProcessed: null,
          unitsTotal: null,
          openFrontier: null,
        },
        passByTrack.get(track) ?? [],
        inputs.loopsPaused,
      ),
    );
  }

  // ingest smyčky: seskupit běhy podle zdroje, nejnovější start první.
  const runsBySource = new Map<string, IngestRunIn[]>();
  for (const r of inputs.ingestRuns) {
    const list = runsBySource.get(r.source) ?? [];
    list.push(r);
    runsBySource.set(r.source, list);
  }
  const ingestStatuses: LoopStatus[] = [...runsBySource.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([source, runs]) => {
      const sorted = [...runs].sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
      return ingestLoopStatus(source, sorted, inputs.now, cadence);
    });

  const loops = [...caseStatuses, ...ingestStatuses];

  // výstrahy — jen z odvozeného stavu, nikdy z domněnky. Pozastavené
  // case-smyčky „stalled“ nehlásí (přiznáno v stalenessReason); série selhání
  // se u case-smyček odvodit nedá (žurnály selhání nenesou).
  const alerts: LoopAlert[] = [];
  for (const loop of loops) {
    if (loop.staleness === "zastaralé" && loop.cadenceDays != null) {
      alerts.push({
        id: alertId({ kind: "stalled", loopId: loop.id, ageDays: loop.ageDays, cadenceDays: loop.cadenceDays }),
        loopId: loop.id,
        kind: "stalled",
        messageCs:
          `${loop.labelCs}: zastaralé — stáří ${String(loop.ageDays).replace(".", ",")} dne/dní ` +
          `překročilo kadence × ${STALLED_CADENCE_MULTIPLIER} (kadence ${loop.cadenceDays} dne/dní).`,
        since: loop.lastOkFinishedAt,
      });
    }
    if (loop.failureStreak >= FAILURE_STREAK_THRESHOLD) {
      alerts.push({
        id: alertId({ kind: "failure-streak", loopId: loop.id, streak: loop.failureStreak }),
        loopId: loop.id,
        kind: "failure-streak",
        messageCs:
          `${loop.labelCs}: ${loop.failureStreak} po sobě jdoucí neúspěšné běhy` +
          `${loop.lastFailureCause ? ` — poslední příčina: ${loop.lastFailureCause}` : ""}.`,
        since: loop.lastActivityAt,
      });
    }
  }
  alerts.sort((a, b) => (a.loopId === b.loopId ? a.kind.localeCompare(b.kind) : a.loopId.localeCompare(b.loopId)));

  return { loops, alerts };
}
