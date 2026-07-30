// Testy jádra akčního žurnálu (6E) — tvar záznamu, sha-256 řetěz, parsování
// JSONL a přehrání žurnálu do stavu fronty/potvrzení.

import { describe, expect, it } from "vitest";
import {
  deriveDriveState,
  entryHash,
  makeEntry,
  parseDriveLog,
  serializeEntry,
  verifyChain,
  DRIVE_GENESIS,
  type DriveEntry,
} from "./driveState";

function chain(
  actions: Array<{ action: DriveEntry["action"]; target: string; note?: string | null }>,
): DriveEntry[] {
  const entries: DriveEntry[] = [];
  for (const [i, a] of actions.entries()) {
    entries.push(
      makeEntry(entries[entries.length - 1] ?? null, {
        at: `2026-07-30T10:0${i}:00.000Z`,
        actor: "operátor (ADMIN_TOKEN)",
        action: a.action,
        target: a.target,
        note: a.note ?? null,
      }),
    );
  }
  return entries;
}

describe("záznam žurnálu + řetěz", () => {
  it("první záznam navazuje na genesis, další na hash předchůdce", () => {
    const entries = chain([
      { action: "requeue", target: "case:money" },
      { action: "ack", target: "abc123" },
    ]);
    expect(entries[0].seq).toBe(1);
    expect(entries[0].prev).toBe(DRIVE_GENESIS);
    expect(entries[1].seq).toBe(2);
    expect(entries[1].prev).toBe(entries[0].hash);
    expect(verifyChain(entries)).toEqual({ ok: true, brokenAtSeq: null });
  });

  it("hash je deterministický nad kanonickým JSON polí", () => {
    const [e] = chain([{ action: "requeue", target: "case:money", note: "pozn" }]);
    const { hash: _hash, ...fields } = e;
    expect(entryHash(fields)).toBe(e.hash);
  });

  it("pozměněný záznam řetěz viditelně zlomí — a přizná KDE", () => {
    const entries = chain([
      { action: "requeue", target: "case:money" },
      { action: "requeue", target: "case:law" },
      { action: "ack", target: "abc" },
    ]);
    const tampered = entries.map((e) => (e.seq === 2 ? { ...e, target: "case:effort" } : e));
    expect(verifyChain(tampered)).toEqual({ ok: false, brokenAtSeq: 2 });
  });

  it("vypuštěný záznam řetěz zlomí (díra v seq / prev nesedí)", () => {
    const entries = chain([
      { action: "requeue", target: "case:money" },
      { action: "requeue", target: "case:law" },
      { action: "ack", target: "abc" },
    ]);
    expect(verifyChain([entries[0], entries[2]]).ok).toBe(false);
    expect(verifyChain(entries.slice(1)).ok).toBe(false);
  });

  it("round-trip: serializace → parse vrátí tytéž záznamy, poškozený řádek se počítá", () => {
    const entries = chain([
      { action: "requeue", target: "case:money", note: "po selhání" },
      { action: "reorder", target: "[1]" },
    ]);
    const text = `${entries.map(serializeEntry).join("\n")}\nTOHLE NENÍ JSON\n{"v":99}\n`;
    const parsed = parseDriveLog(text);
    expect(parsed.entries).toEqual(entries);
    expect(parsed.skipped).toBe(2);
  });
});

describe("deriveDriveState — přehrání žurnálu", () => {
  it("requeue přidává, duplicitní čekající cíl se ignoruje (idempotence)", () => {
    const state = deriveDriveState(
      chain([
        { action: "requeue", target: "case:money", note: "batch 013" },
        { action: "requeue", target: "case:money" },
        { action: "requeue", target: "ingest:psp-hlasovani" },
      ]),
    );
    expect(state.pending.map((p) => p.target)).toEqual(["case:money", "ingest:psp-hlasovani"]);
    expect(state.pending[0].note).toBe("batch 013");
    expect(state.entryCount).toBe(3);
  });

  it("resolve položku skryje z fronty, ale nic nemaže (počítá se)", () => {
    const state = deriveDriveState(
      chain([
        { action: "requeue", target: "case:money" }, // seq 1
        { action: "requeue", target: "case:law" }, // seq 2
        { action: "resolve", target: "1" },
      ]),
    );
    expect(state.pending.map((p) => p.target)).toEqual(["case:law"]);
    expect(state.resolvedCount).toBe(1);
    expect(state.entryCount).toBe(3); // žurnál drží všechno
  });

  it("resolve po requeue dovolí týž cíl zařadit znovu", () => {
    const state = deriveDriveState(
      chain([
        { action: "requeue", target: "case:money" }, // seq 1
        { action: "resolve", target: "1" },
        { action: "requeue", target: "case:money" }, // seq 3
      ]),
    );
    expect(state.pending.map((p) => p.seq)).toEqual([3]);
  });

  it("reorder přeskládá frontu; neuvedené drží pořadí za uvedenými, neznámá seq se ignoruje", () => {
    const state = deriveDriveState(
      chain([
        { action: "requeue", target: "case:money" }, // seq 1
        { action: "requeue", target: "case:law" }, // seq 2
        { action: "requeue", target: "case:effort" }, // seq 3
        { action: "reorder", target: "[3,1,99]" },
      ]),
    );
    expect(state.pending.map((p) => p.seq)).toEqual([3, 1, 2]);
  });

  it("poškozený reorder se přeskočí a fronta drží dosavadní pořadí", () => {
    const state = deriveDriveState(
      chain([
        { action: "requeue", target: "case:money" },
        { action: "requeue", target: "case:law" },
        { action: "reorder", target: "tohle není JSON" },
      ]),
    );
    expect(state.pending.map((p) => p.seq)).toEqual([1, 2]);
  });

  it("ack pamatuje poslední potvrzení výstrahy podle otisku", () => {
    const state = deriveDriveState(
      chain([
        { action: "ack", target: "otisk-a" },
        { action: "ack", target: "otisk-a" }, // pozdější vyhrává
        { action: "ack", target: "otisk-b" },
      ]),
    );
    expect(state.acks["otisk-a"]).toBe("2026-07-30T10:01:00.000Z");
    expect(state.acks["otisk-b"]).toBe("2026-07-30T10:02:00.000Z");
  });
});
