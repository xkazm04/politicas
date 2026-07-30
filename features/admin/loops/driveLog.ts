// IO slupka akčního žurnálu velína (6E) — čtení a APPEND-ONLY zápis JSONL
// souboru. Veškerá logika (hash řetěz, derivace stavu) žije v driveState.ts;
// tady jen souborový okraj v konvenci getAdminData („degrade to partial,
// never crash" při čtení — zápis naopak selhává NAHLAS, ztracený řídicí zásah
// nesmí předstírat úspěch).
//
// Umístění: .data/loop-drive.jsonl (vedle .data/psp — runtime data, ne kód),
// přepsatelné env LOOP_DRIVE_PATH (testy). Jediný lokální operátor (AdminGate)
// ⇒ sekvenční zápis bez zámku je přiměřený; souběh dvou zápisů by řetěz
// viditelně zlomil, nikoli tiše poškodil stav (verifyChain to přizná).

import "server-only";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { reportLoaderFailure } from "@/lib/db/loaderGuard";
import {
  deriveDriveState,
  makeEntry,
  parseDriveLog,
  serializeEntry,
  verifyChain,
  type ChainVerdict,
  type DriveActionKind,
  type DriveDerivedState,
  type DriveEntry,
} from "./driveState";

/** Runtime datový soubor (žádný build asset), cesta dynamická kvůli env
 *  override pro testy. Turbopack NFT trace na dynamické fs cestě hlásí jedno
 *  build varování (trace celého projektu) — přijato a přiznáno: jde o lokálně
 *  provozovanou aplikaci, žurnál je runtime data, ne build asset. */
export function driveLogPath(): string {
  return process.env.LOOP_DRIVE_PATH || "./.data/loop-drive.jsonl";
}

/** Cesta pro přiznání v UI/JSON — bez úvodního "./", s "/" i na Windows. */
export function driveLogDisplayPath(): string {
  return driveLogPath().replaceAll("\\", "/").replace(/^\.\//, "");
}

export interface DriveLogRead {
  entries: DriveEntry[];
  skipped: number;
  chain: ChainVerdict;
  state: DriveDerivedState;
}

const EMPTY_READ: DriveLogRead = {
  entries: [],
  skipped: 0,
  chain: { ok: true, brokenAtSeq: null },
  state: { pending: [], acks: {}, resolvedCount: 0, entryCount: 0 },
};

export function readDriveLog(): DriveLogRead {
  try {
    const path = driveLogPath();
    if (!existsSync(path)) return EMPTY_READ;
    const { entries, skipped } = parseDriveLog(readFileSync(path, "utf8"));
    return { entries, skipped, chain: verifyChain(entries), state: deriveDriveState(entries) };
  } catch (err) {
    reportLoaderFailure("driveLog.readDriveLog", err);
    return EMPTY_READ;
  }
}

/**
 * Připojí jeden záznam na konec žurnálu. Nic nemaže a nic nepřepisuje —
 * jediná operace je appendFileSync jednoho řádku.
 */
export function appendDriveEntry(fields: {
  actor: string;
  action: DriveActionKind;
  target: string;
  note: string | null;
}): { ok: true; entry: DriveEntry } | { ok: false; error: string } {
  try {
    const path = driveLogPath();
    mkdirSync(dirname(path), { recursive: true });
    const { entries } = existsSync(path) ? parseDriveLog(readFileSync(path, "utf8")) : { entries: [] };
    const last = entries.length ? entries[entries.length - 1] : null;
    const entry = makeEntry(last, { at: new Date().toISOString(), ...fields });
    appendFileSync(path, `${serializeEntry(entry)}\n`, "utf8");
    return { ok: true, entry };
  } catch (err) {
    console.warn("[driveLog] zápis do žurnálu selhal", err);
    return { ok: false, error: "Zápis do akčního žurnálu selhal — akce NEBYLA zaznamenána." };
  }
}
