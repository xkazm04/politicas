// Civic seismograph — invarianty čisté diff vrstvy (moonshot 5C): přesný diff
// snímků, deterministická id (idempotence), epocha jako tichá nultá událost,
// review-only změny se nepočítají dvakrát, kodek round-trip + odmítnutí vad.

import { describe, expect, it } from "vitest";
import {
  canonicalJson,
  contractNewEvent,
  diffSnapshots,
  edgeEntityKeys,
  encodeChangeEvent,
  icoFromNodeId,
  isReviewOnlyChange,
  mandateChangeEvents,
  membershipChangeEvents,
  parseChangeEvent,
  pspIdFromNodeId,
  reviewDecisionEvent,
  tieChangeEvents,
  type ChangeEvent,
  type ClaimVersion,
} from "./changeEvents";

const T0 = "2026-07-01T00:00:00.000Z"; // epocha (bitemporální migrace)
const T1 = "2026-07-10T12:00:00.000Z";
const T2 = "2026-07-20T12:00:00.000Z";

describe("diffSnapshots — přesný diff dvou ingestů téhož zdroje", () => {
  const row = (id: string, v: number) => ({ id, value: v });

  it("rozdělí add/remove/change po přirozených klíčích, deterministicky seřazené", () => {
    const prev = [row("psp:mandate:2", 1), row("psp:mandate:1", 1), row("psp:mandate:3", 1)];
    const next = [row("psp:mandate:4", 1), row("psp:mandate:2", 9), row("psp:mandate:1", 1)];
    const d = diffSnapshots(prev, next);
    expect(d.added.map((r) => r.id)).toEqual(["psp:mandate:4"]);
    expect(d.removed.map((r) => r.id)).toEqual(["psp:mandate:3"]);
    expect(d.changed.map((c) => c.after.id)).toEqual(["psp:mandate:2"]);
    expect(d.changed[0].before.value).toBe(1);
    expect(d.changed[0].after.value).toBe(9);
  });

  it("identické snímky → prázdný diff; pořadí klíčů objektu se nepočítá jako změna", () => {
    const a = [{ id: "x", p: { b: 1, a: 2 } }];
    const b = [{ id: "x", p: { a: 2, b: 1 } }];
    const d = diffSnapshots(a, b);
    expect(d.added).toEqual([]);
    expect(d.removed).toEqual([]);
    expect(d.changed).toEqual([]);
  });

  it("contentOf projekce: re-fetch identických dat s novým fetched_at není změna", () => {
    const a = [{ id: "x", value: 1, fetchedAt: "2026-07-01" }];
    const b = [{ id: "x", value: 1, fetchedAt: "2026-07-20" }];
    const full = diffSnapshots(a, b);
    expect(full.changed).toHaveLength(1); // bez projekce JE to změna
    const projected = diffSnapshots(a, b, ({ id, value }) => ({ id, value }));
    expect(projected.changed).toEqual([]);
  });
});

describe("snapshot diff → typované eventy (mandáty, role)", () => {
  it("mandate diff nese klíč poslance a deterministické id", () => {
    const d = diffSnapshots(
      [{ id: "psp:mandate:10", personPspId: 6790, termCode: "PSP10" }],
      [
        { id: "psp:mandate:10", personPspId: 6790, termCode: "PSP11" },
        { id: "psp:mandate:11", personPspId: 7000, termCode: "PSP10" },
      ],
    );
    const events = mandateChangeEvents(d, T1);
    expect(events.map((e) => e.eventType).sort()).toEqual(["mandate-changed", "mandate-new"]);
    const added = events.find((e) => e.eventType === "mandate-new")!;
    expect(added.id).toBe("chev:mandate-new:psp:mandate:11");
    expect(added.entityKeys).toEqual(["poslanec:7000"]);
    // idempotence: totéž odvození → tatáž id
    expect(mandateChangeEvents(d, T1).map((e) => e.id)).toEqual(events.map((e) => e.id));
  });

  it("membership diff → role-new/role-removed s klíčem poslance", () => {
    const d = diffSnapshots(
      [{ id: "psp:zarazeni:1", personPspId: 6790, functionNameCz: "předseda" }],
      [{ id: "psp:zarazeni:2", personPspId: 6790, functionNameCz: null }],
    );
    const events = membershipChangeEvents(d, T1);
    expect(events.map((e) => e.eventType).sort()).toEqual(["role-new", "role-removed"]);
    for (const e of events) expect(e.entityKeys).toEqual(["poslanec:6790"]);
  });
});

describe("tieChangeEvents — bitemporální stopa vazby", () => {
  const SRC = "psp:person:6790";
  const DST = "kg:company:ico:04544152";
  const v = (recordedAt: string, props: Record<string, unknown>, weight: number | null = null): ClaimVersion => ({
    recordedAt,
    weight,
    props,
  });

  it("verze zaznamenané V epoše jsou tichá nultá událost", () => {
    expect(tieChangeEvents(SRC, DST, [v(T0, { role: "jednatel" })], T0)).toEqual([]);
  });

  it("první verze po epoše → tie-new; další věcná změna → tie-changed", () => {
    const events = tieChangeEvents(
      SRC,
      DST,
      [v(T2, { role: "společník", review_state: "pending_review" }), v(T1, { role: "jednatel" })], // pořadí vstupu je jedno
      T0,
    );
    expect(events.map((e) => e.eventType)).toEqual(["tie-new", "tie-changed"]);
    expect(events[0].id).toBe(`chev:tie-new:${SRC}|${DST}`);
    expect(events[0].recordedAt).toBe(T1);
    expect(events[1].id).toBe(`chev:tie-changed:${SRC}|${DST}|${T2}`);
    expect(events[0].entityKeys).toEqual(["poslanec:6790", "firma:04544152"]);
  });

  it("review-only přepnutí NENÍ tie-changed (event vlastní review_audit)", () => {
    const before = v(T1, { role: "jednatel", review_state: "pending_review" });
    const flipped = v(T2, {
      role: "jednatel",
      review_state: "verified",
      last_decision: "confirm",
      last_reviewer: "tester",
      last_reviewed_at: T2,
    });
    expect(isReviewOnlyChange(before, flipped)).toBe(true);
    const events = tieChangeEvents(SRC, DST, [before, flipped], T0);
    expect(events.map((e) => e.eventType)).toEqual(["tie-new"]);
    // věcná změna (role) při stejném review stavu se počítá
    const substantive = v(T2, { role: "společník", review_state: "pending_review" });
    expect(isReviewOnlyChange(before, substantive)).toBe(false);
  });

  it("vazba zaznamenaná před epochou emituje jen změny po epoše (nikdy tie-new)", () => {
    const events = tieChangeEvents(SRC, DST, [v(T0, { role: "jednatel" }), v(T1, { role: "společník" })], T0);
    expect(events.map((e) => e.eventType)).toEqual(["tie-changed"]);
  });
});

describe("contractNewEvent + reviewDecisionEvent", () => {
  it("smlouva poprvé zaznamenaná po epoše → contract-new s klíčem firmy (IČO na SRC)", () => {
    const e = contractNewEvent("kg:company:ico:04544152", "kg:contract:abc", T1, T0)!;
    expect(e.eventType).toBe("contract-new");
    expect(e.entityKeys).toEqual(["firma:04544152"]);
    expect(e.id).toBe("chev:contract-new:kg:company:ico:04544152|kg:contract:abc");
    // v epoše ticho
    expect(contractNewEvent("kg:company:ico:04544152", "kg:contract:abc", T0, T0)).toBeNull();
  });

  it("řádek review_audit → review-decision, decided_at JE záznamový čas", () => {
    const e = reviewDecisionEvent({
      id: "uuid-1",
      src: "psp:person:6790",
      dst: "kg:company:ico:04544152",
      decision: "confirm",
      decidedAt: T2,
    });
    expect(e.id).toBe("chev:review:uuid-1");
    expect(e.recordedAt).toBe(T2);
    expect(e.payload).toEqual({ decision: "confirm" });
  });
});

describe("kodek eventu — pinned wire shape, validace na cestě zpět", () => {
  const event: ChangeEvent = {
    id: "chev:tie-new:a|b",
    eventType: "tie-new",
    recordedAt: T1,
    entityKeys: ["poslanec:6790"],
    src: "psp:person:6790",
    dst: "kg:company:ico:111111",
    evidence: { rel: "linked_to" },
    source: "kg_edge_history — bitemporální graf",
    payload: { review_state: "pending_review" },
  };

  it("encode → parse je identita a serializace je kanonická (klíče seřazené)", () => {
    const wire = encodeChangeEvent(event);
    expect(parseChangeEvent(wire)).toEqual(event);
    expect(wire).toBe(encodeChangeEvent(parseChangeEvent(wire)!));
    expect(canonicalJson({ b: 1, a: 2 })).toBe(canonicalJson({ a: 2, b: 1 }));
  });

  it("vadný payload → null, nikdy oprava odhadem", () => {
    expect(parseChangeEvent(null)).toBeNull();
    expect(parseChangeEvent("{ne json")).toBeNull();
    expect(parseChangeEvent({ ...event, eventType: "smazano-vsechno" })).toBeNull();
    expect(parseChangeEvent({ ...event, recordedAt: "kdysi" })).toBeNull();
    expect(parseChangeEvent({ ...event, entityKeys: [42] })).toBeNull();
    expect(parseChangeEvent({ ...event, id: "" })).toBeNull();
    expect(parseChangeEvent({ ...event, source: "" })).toBeNull();
  });
});

describe("klíče entit z id uzlů (zrcadlo deníkových klíčů)", () => {
  it("parsuje osobu a IČO, cizí tvary odmítá", () => {
    expect(pspIdFromNodeId("psp:person:6790")).toBe(6790);
    expect(pspIdFromNodeId("psp:organ:174")).toBeNull();
    expect(icoFromNodeId("kg:company:ico:04544152")).toBe("04544152");
    expect(icoFromNodeId("kg:company:04544152")).toBe("04544152");
    expect(icoFromNodeId("kg:contract:abc")).toBeNull();
    expect(edgeEntityKeys("psp:person:1", "kg:company:ico:222222")).toEqual(["poslanec:1", "firma:222222"]);
    expect(edgeEntityKeys(null, null)).toEqual([]);
  });
});
