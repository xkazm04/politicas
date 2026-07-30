// Akční žurnál velína smyček (6E) — ČISTÉ jádro append-only žurnálu řídicích
// zásahů operátora (znovuzařazení kroku, přeuspořádání fronty, potvrzení
// výstrahy, vyřízení položky). IO slupka je driveLog.ts; tady jen typy,
// hashování, ověření řetězu a derivace stavu — vše unit-testované
// (driveState.test.ts).
//
// BRZDY ŘÍDICÍCH AKCÍ (batch-6 bod 25, doslova): každá akce vyžaduje explicitní
// potvrzení v UI, každá se zapisuje do append-only žurnálu a ŽÁDNÁ nemaže data
// — „vyřízení“ položky i „potvrzení“ výstrahy jsou nové řádky žurnálu, nikdy
// odstranění starých.
//
// ŘETĚZ: každý záznam nese sha-256 kanonického JSON svých polí + hash
// předchůdce, takže dodatečná úprava nebo vypuštění řádku řetěz viditelně
// zlomí. PŘIZNÁNÍ (bod 25): tento řetěz je VLASTNÍ řetěz žurnálu — akce
// netečou přes review repozitáře, Merkle pečeť revizního ledgeru
// (LedgerRepository) se na ně NEVZTAHUJE. UI i loops.json to přiznávají.
//
// Node-only modul (node:crypto) — klientské komponenty ho nikdy neimportují;
// na klienta jde jen serializovaný stav v props.

import { createHash } from "node:crypto";
import { canonicalJson } from "@/features/dashboard/exhibit";

export const DRIVE_LOG_VERSION = 1;
export const DRIVE_GENESIS = "genesis";

/** Řídicí akce. Žádná není destruktivní — vše jsou přidané řádky žurnálu. */
export type DriveActionKind = "requeue" | "reorder" | "ack" | "resolve";

export interface DriveEntry {
  v: typeof DRIVE_LOG_VERSION;
  /** Pořadové číslo záznamu, od 1, bez děr. */
  seq: number;
  at: string; // ISO
  actor: string;
  action: DriveActionKind;
  /**
   * Cíl akce: requeue → id smyčky ("case:money" / "ingest:psp-hlasovani");
   * reorder → JSON pole seq čísel čekajících položek v novém pořadí;
   * ack → id výstrahy (otisk stavu z loopState); resolve → seq položky fronty.
   */
  target: string;
  note: string | null;
  /** Hash předchozího záznamu, u prvního DRIVE_GENESIS. */
  prev: string;
  /** sha-256 (hex) kanonického JSON polí {v,seq,at,actor,action,target,note,prev}. */
  hash: string;
}

export type DriveEntryFields = Omit<DriveEntry, "hash">;

export function entryHash(fields: DriveEntryFields): string {
  const { v, seq, at, actor, action, target, note, prev } = fields;
  return createHash("sha256")
    .update(canonicalJson({ v, seq, at, actor, action, target, note, prev }))
    .digest("hex");
}

/** Nový záznam navázaný na dosavadní konec řetězu (null = prázdný žurnál). */
export function makeEntry(
  last: DriveEntry | null,
  fields: { at: string; actor: string; action: DriveActionKind; target: string; note: string | null },
): DriveEntry {
  const base: DriveEntryFields = {
    v: DRIVE_LOG_VERSION,
    seq: (last?.seq ?? 0) + 1,
    at: fields.at,
    actor: fields.actor,
    action: fields.action,
    target: fields.target,
    note: fields.note,
    prev: last?.hash ?? DRIVE_GENESIS,
  };
  return { ...base, hash: entryHash(base) };
}

export interface ChainVerdict {
  ok: boolean;
  /** seq prvního záznamu, kde řetěz nesedí; null když ok. */
  brokenAtSeq: number | null;
}

export function verifyChain(entries: ReadonlyArray<DriveEntry>): ChainVerdict {
  let prevHash = DRIVE_GENESIS;
  let prevSeq = 0;
  for (const e of entries) {
    if (e.seq !== prevSeq + 1 || e.prev !== prevHash || entryHash(e) !== e.hash) {
      return { ok: false, brokenAtSeq: e.seq };
    }
    prevHash = e.hash;
    prevSeq = e.seq;
  }
  return { ok: true, brokenAtSeq: null };
}

export const serializeEntry = (e: DriveEntry): string => JSON.stringify(e);

/** Parsování JSONL — poškozené řádky se počítají, nikdy nezpůsobí pád. */
export function parseDriveLog(text: string): { entries: DriveEntry[]; skipped: number } {
  const entries: DriveEntry[] = [];
  let skipped = 0;
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const raw = JSON.parse(trimmed) as Partial<DriveEntry>;
      if (
        raw.v === DRIVE_LOG_VERSION &&
        typeof raw.seq === "number" &&
        typeof raw.at === "string" &&
        typeof raw.actor === "string" &&
        (raw.action === "requeue" || raw.action === "reorder" || raw.action === "ack" || raw.action === "resolve") &&
        typeof raw.target === "string" &&
        (raw.note === null || typeof raw.note === "string") &&
        typeof raw.prev === "string" &&
        typeof raw.hash === "string"
      ) {
        entries.push(raw as DriveEntry);
      } else {
        skipped++;
      }
    } catch (err) {
      console.warn("[driveState] neparsovatelný řádek žurnálu přeskočen", err);
      skipped++;
    }
  }
  entries.sort((a, b) => a.seq - b.seq);
  return { entries, skipped };
}

/* ── derivace stavu z žurnálu ─────────────────────────────────────────────── */

export interface PendingQueueItem {
  /** seq requeue záznamu, který položku založil — identita položky. */
  seq: number;
  /** Id smyčky, jejíž krok se má znovu zařadit. */
  target: string;
  note: string | null;
  requestedAt: string;
}

export interface DriveDerivedState {
  /** Čekající znovuzařazené kroky v operátorem určeném pořadí. */
  pending: PendingQueueItem[];
  /** id výstrahy → ISO okamžik posledního potvrzení. */
  acks: Record<string, string>;
  resolvedCount: number;
  entryCount: number;
}

/**
 * Přehrání žurnálu od začátku: requeue přidává (duplicitní čekající cíl se
 * ignoruje — idempotence), resolve položku skryje z fronty (v žurnálu zůstává),
 * reorder přeskládá frontu podle uvedených seq (neuvedené položky drží pořadí
 * za uvedenými; neznámá seq se ignoruje), ack pamatuje poslední potvrzení
 * výstrahy podle jejího otisku.
 */
export function deriveDriveState(entries: ReadonlyArray<DriveEntry>): DriveDerivedState {
  let pending: PendingQueueItem[] = [];
  const acks: Record<string, string> = {};
  let resolvedCount = 0;

  for (const e of entries) {
    if (e.action === "requeue") {
      if (!pending.some((p) => p.target === e.target)) {
        pending.push({ seq: e.seq, target: e.target, note: e.note, requestedAt: e.at });
      }
    } else if (e.action === "resolve") {
      const seq = Number(e.target);
      const before = pending.length;
      pending = pending.filter((p) => p.seq !== seq);
      if (pending.length < before) resolvedCount++;
    } else if (e.action === "reorder") {
      let order: unknown;
      try {
        order = JSON.parse(e.target);
      } catch {
        order = null; // poškozený reorder se přeskočí, fronta drží dosavadní pořadí
      }
      if (Array.isArray(order) && order.every((x) => typeof x === "number")) {
        const bySeq = new Map(pending.map((p) => [p.seq, p]));
        const next: PendingQueueItem[] = [];
        for (const seq of order as number[]) {
          const item = bySeq.get(seq);
          if (item) {
            next.push(item);
            bySeq.delete(seq);
          }
        }
        for (const p of pending) if (bySeq.has(p.seq)) next.push(p);
        pending = next;
      }
    } else if (e.action === "ack") {
      acks[e.target] = e.at;
    }
  }

  return { pending, acks, resolvedCount, entryCount: entries.length };
}
