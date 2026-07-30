// Strojově čitelný stav smyček (6E) — kodek dokumentu /admin/loops.json.
// ČISTÝ modul (typy + encode/parse, žádné IO, žádné node importy — typy odsud
// smí importovat i klientská komponenta). Round-trip je testovaný
// (loopsJson.test.ts). Vzor: features/dukazy/feedCodecs.ts — kodek je oddělený
// od loaderu, aby se dal ověřit bez serveru.

import type { LoopAlert, LoopStatus } from "./loopState";
import { LOOPS_SCHEMA } from "./loopState";
import type { PendingQueueItem } from "./driveState";

/** Výstraha obohacená o stav potvrzení z akčního žurnálu. */
export interface LoopsDocAlert extends LoopAlert {
  acknowledged: boolean;
  acknowledgedAt: string | null;
}

export interface LoopsDoc {
  schema: typeof LOOPS_SCHEMA;
  generatedAt: string;
  /** Přiznání pozastavení case-smyček (getAdminData konstanta), jinak null. */
  pausedNoteCs: string | null;
  loops: LoopStatus[];
  alerts: LoopsDocAlert[];
  drive: {
    /** Čekající znovuzařazené kroky v operátorem určeném pořadí. */
    pending: PendingQueueItem[];
    log: {
      /** Relativní cesta žurnálu (přiznaná, ať jde ověřit ručně). */
      path: string;
      entries: number;
      /** Poškozené (přeskočené) řádky žurnálu. */
      skipped: number;
      chainOk: boolean;
      /** PŘIZNÁNÍ: vlastní sha-256 řetěz žurnálu, MIMO Merkle ledger revizí. */
      chainNoteCs: string;
    };
  };
}

export const DRIVE_CHAIN_NOTE_CS =
  "Akční žurnál je append-only JSONL s vlastním sha-256 řetězem záznamů. Netece přes review " +
  "repozitáře — Merkle pečeť revizního ledgeru se na něj NEVZTAHUJE (přiznáno dle batch-6 bodu 25).";

export function encodeLoopsDoc(doc: LoopsDoc): string {
  return JSON.stringify(doc, null, 2);
}

/** Přísný parse: špatné schéma nebo tvar → null, nikdy výjimka ven. */
export function parseLoopsDoc(text: string): LoopsDoc | null {
  try {
    const raw = JSON.parse(text) as Partial<LoopsDoc>;
    if (raw.schema !== LOOPS_SCHEMA) return null;
    if (typeof raw.generatedAt !== "string") return null;
    if (!Array.isArray(raw.loops) || !Array.isArray(raw.alerts)) return null;
    if (raw.pausedNoteCs !== null && typeof raw.pausedNoteCs !== "string") return null;
    const drive = raw.drive;
    if (!drive || !Array.isArray(drive.pending) || !drive.log) return null;
    if (typeof drive.log.entries !== "number" || typeof drive.log.chainOk !== "boolean") return null;
    for (const loop of raw.loops) {
      if (typeof loop?.id !== "string" || (loop.kind !== "case" && loop.kind !== "ingest")) return null;
    }
    for (const alert of raw.alerts) {
      if (typeof alert?.id !== "string" || typeof alert.loopId !== "string") return null;
      if (typeof alert.acknowledged !== "boolean") return null;
    }
    return raw as LoopsDoc;
  } catch (err) {
    console.warn("[loopsJson] dokument nelze parsovat", err);
    return null;
  }
}
