// ChangeEventRepository — backfill nad bitemporální stopou + review_audit
// (moonshot 5C): epocha je tichá nultá událost, review-only přepnutí se
// nepočítá dvakrát, opakované odvození je idempotentní, filtr entity čte
// GIN-indexované klíče.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Izolovaný PGlite adresář — NIKDY ./.pglite (živá data). Nastavit PŘED importem
// čehokoli, co volá open() (pglitePath čte env líně, ale spojení se memoizuje).
const dataDir = mkdtempSync(join(tmpdir(), "politicas-changes-repo-"));
process.env.PGLITE_PATH = dataDir;

const { open } = await import("../internals");
const { makeChangesRepo } = await import("./changes");
const { makeReviewRepo } = await import("./review");

const EPOCH = "2026-07-01T00:00:00.000Z";
const T1 = "2026-07-10T12:00:00.000Z";
const T2 = "2026-07-20T12:00:00.000Z";

const MP_OLD = "psp:person:1000"; // vazba existující už v epoše
const MP_NEW = "psp:person:2000"; // vazba zaznamenaná až po epoše
const CO_OLD = "kg:company:ico:111111";
const CO_NEW = "kg:company:ico:222222";
const CONTRACT_OLD = "kg:contract:old";
const CONTRACT_NEW = "kg:contract:new";

describe("ChangeEventRepository.backfillChangeEvents", () => {
  let pg: Awaited<ReturnType<typeof open>>;
  let repo: ReturnType<typeof makeChangesRepo>;

  beforeAll(async () => {
    pg = await open();
    repo = makeChangesRepo(pg);

    // ── fixture: graf s bitemporální stopou ──────────────────────────────────
    // 1. vazba MP_OLD↔CO_OLD: v epoše, později (T2) review-only přepnutí
    //    (stará verze v history, nová na serving) → ŽÁDNÝ tie event.
    await pg.query(
      `insert into kg_edge (src, rel, dst, weight, props, provenance, recorded_at)
       values ($1, 'linked_to', $2, null, $3::jsonb, '{}'::jsonb, $4::timestamptz)`,
      [
        MP_OLD,
        CO_OLD,
        JSON.stringify({ role: "jednatel", review_state: "verified", last_decision: "confirm" }),
        T2,
      ],
    );
    await pg.query(
      `insert into kg_edge_history (src, rel, dst, weight, props, provenance, recorded_at, superseded_at)
       values ($1, 'linked_to', $2, null, $3::jsonb, '{}'::jsonb, $4::timestamptz, $5::timestamptz)`,
      [MP_OLD, CO_OLD, JSON.stringify({ role: "jednatel", review_state: "pending_review" }), EPOCH, T2],
    );
    // 2. vazba MP_NEW↔CO_NEW: poprvé zaznamenaná v T1 → tie-new.
    await pg.query(
      `insert into kg_edge (src, rel, dst, weight, props, provenance, recorded_at)
       values ($1, 'linked_to', $2, null, $3::jsonb, '{}'::jsonb, $4::timestamptz)`,
      [MP_NEW, CO_NEW, JSON.stringify({ role: "společník", review_state: "pending_review" }), T1],
    );
    // 3. smlouvy: jedna v epoše (ticho), jedna v T1 → contract-new.
    await pg.query(
      `insert into kg_edge (src, rel, dst, weight, props, provenance, recorded_at)
       values ($1, 'supplies', $2, 100, '{}'::jsonb, '{}'::jsonb, $3::timestamptz),
              ($1, 'supplies', $4, 200, '{}'::jsonb, '{}'::jsonb, $5::timestamptz)`,
      [CO_OLD, CONTRACT_OLD, EPOCH, CONTRACT_NEW, T1],
    );
    // 4. jedno rozhodnutí brány (skutečný writer, ať decided_at i řetěz sedí).
    await makeReviewRepo(pg).setTieReviewState(MP_OLD, CO_OLD, "confirm", "tester", null);
  });

  afterAll(async () => {
    await pg.close();
    rmSync(dataDir, { recursive: true, force: true });
  });

  it("odvodí přesně: tie-new + contract-new + review-decision; epocha a review-only mlčí", async () => {
    const { derived, epoch } = await repo.backfillChangeEvents();
    expect(epoch).toBe(EPOCH);
    expect(derived).toBe(3);

    const events = await repo.listChangeEvents();
    const byType = new Map(events.map((e) => [e.eventType, e]));
    expect([...byType.keys()].sort()).toEqual(["contract-new", "review-decision", "tie-new"]);

    const tieNew = byType.get("tie-new")!;
    expect(tieNew.src).toBe(MP_NEW);
    expect(tieNew.recordedAt).toBe(T1);
    expect(tieNew.entityKeys).toEqual(["poslanec:2000", "firma:222222"]);

    const contractNew = byType.get("contract-new")!;
    expect(contractNew.dst).toBe(CONTRACT_NEW);
    expect(contractNew.entityKeys).toEqual(["firma:111111"]);

    // review-only přepnutí MP_OLD↔CO_OLD NENÍ tie-changed — jeho event je
    // rozhodnutí brány samo.
    const review = byType.get("review-decision")!;
    expect(review.src).toBe(MP_OLD);
    expect(review.payload).toEqual({ decision: "confirm" });
  });

  it("opakované odvození je idempotentní: tatáž id, žádné duplikáty", async () => {
    const first = await repo.listChangeEvents();
    const { derived } = await repo.backfillChangeEvents();
    expect(derived).toBe(3); // znovu odvozeno, upsert na místě
    const second = await repo.listChangeEvents();
    expect(second.map((e) => e.id)).toEqual(first.map((e) => e.id));
    expect(await repo.countChangeEvents()).toBe(3);
  });

  it("filtr entity čte jsonb klíče; neznámý klíč → poctivě prázdno", async () => {
    const mp = await repo.listChangeEvents({ entityKey: "poslanec:2000" });
    expect(mp.map((e) => e.eventType)).toEqual(["tie-new"]);
    const co = await repo.listChangeEvents({ entityKey: "firma:111111" });
    expect(co.map((e) => e.eventType).sort()).toEqual(["contract-new", "review-decision"]);
    expect(await repo.listChangeEvents({ entityKey: "firma:999999" })).toEqual([]);
    const typed = await repo.listChangeEvents({ eventType: "contract-new" });
    expect(typed).toHaveLength(1);
  });

  it("řazení: záznamový čas sestupně, uvnitř instantu id vzestupně", async () => {
    const events = await repo.listChangeEvents();
    const sorted = [...events].sort(
      (a, b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt) || a.id.localeCompare(b.id),
    );
    expect(events.map((e) => e.id)).toEqual(sorted.map((e) => e.id));
  });
});
