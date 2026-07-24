// D1 (batch 004) regression: proves the merge-preserve fix survives a REAL re-ingest
// cycle through the store, not just the pure function in isolation. Uses an isolated
// temp-dir PGlite, same pattern as lib/db/pglite/repositories/review.test.ts. Never
// touches ./.pglite or ./.pglite-copy-money.
//
// This does NOT import scripts/data-analysis/kg-money-ingest.ts (it self-executes
// main() on import — unsafe in a test). Instead it exercises the exact sequence that
// script performs for a `linked_to` edge on re-ingest: read current props from the
// store → mergePreservedTieProps(existing, fresh) → upsertKgEdges. That IS the fix
// (moneyGraphToKgRows in the ingest script does exactly this, see its
// `existingLinkedToProps` param), so this proves the fix end-to-end against the store.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const dataDir = mkdtempSync(join(tmpdir(), "politicas-kg-money-reingest-"));
process.env.PGLITE_PATH = dataDir;

const { open } = await import("../db/pglite/internals");
const { makeKgRepo } = await import("../db/pglite/repositories/kg");
const { makeReviewRepo } = await import("../db/pglite/repositories/review");
const { mergePreservedTieProps } = await import("./kg-money");

const SRC = "psp:person:6790";
const DST = "company:ico:111";

describe("D1 re-ingest merge-preserve, end-to-end through the store", () => {
  let pg: Awaited<ReturnType<typeof open>>;

  beforeAll(async () => {
    pg = await open();
    // seed the node rows setTieReviewState/getVerificationQueue-adjacent code expects
    await pg.query(
      `insert into kg_node (id, kind, label, props, first_seen_pass, provenance)
       values
        ($1, 'person', 'Testovací Poslanec', '{}'::jsonb, 1, '{}'::jsonb),
        ($2, 'company', 'Testovací s.r.o.', $3::jsonb, 1, '{}'::jsonb)`,
      [SRC, DST, JSON.stringify({ ico: "111" })],
    );
  });

  afterAll(async () => {
    await pg.close();
    rmSync(dataDir, { recursive: true, force: true });
  });

  it("a human-verified + annotated tie survives a simulated re-ingest that would otherwise revert it", async () => {
    const kg = makeKgRepo(pg);
    const review = makeReviewRepo(pg);

    // pass 1: first ingest — pending_review, straight from source, nothing to preserve yet
    await kg.upsertKgEdges([
      {
        src: SRC,
        rel: "linked_to",
        dst: DST,
        weight: null,
        props: { role: "jednatel", source: "oi-declaration-2026", review_state: "pending_review" },
        provenance: { pass: 1, method: "deterministic", ref: "money-feed", computedAt: "2026-01-01T00:00:00.000Z" },
      },
    ]);

    // a human reviewer confirms the tie via the ONLY writer of review_state
    const confirmResult = await review.setTieReviewState(SRC, DST, "confirm", "tester", "confirmed via ARES VR");
    expect(confirmResult).toEqual({ ok: true, reviewState: "verified" });

    // separately, some other pass stamps a corroboration prop directly on the edge
    // (simulating the registry-corroboration enrichment pass, not the review write path)
    const beforeReingest = await kg.listKgEdges({ rel: "linked_to" });
    const edge = beforeReingest.find((e) => e.src === SRC && e.dst === DST)!;
    await kg.upsertKgEdges([
      {
        src: SRC,
        rel: "linked_to",
        dst: DST,
        weight: null,
        props: { ...edge.props, corroboration: "registry-confirmed" },
        provenance: edge.provenance,
      },
    ]);

    const annotated = (await kg.listKgEdges({ rel: "linked_to" })).find((e) => e.src === SRC && e.dst === DST)!;
    expect(annotated.props.review_state).toBe("verified");
    expect(annotated.props.corroboration).toBe("registry-confirmed");

    // pass 2: re-ingest runs again over the SAME source data — same fresh-derived
    // props a real re-run would produce, always defaulting to pending_review.
    const freshFromSourceFeed = { role: "jednatel", source: "oi-declaration-2026", review_state: "pending_review" };

    // this is exactly what moneyGraphToKgRows now does for a linked_to edge: read the
    // CURRENT props (already fetched above as `annotated.props`) and merge-preserve
    // before writing, instead of writing freshFromSourceFeed straight through.
    const mergedProps = mergePreservedTieProps(annotated.props, freshFromSourceFeed);
    await kg.upsertKgEdges([
      {
        src: SRC,
        rel: "linked_to",
        dst: DST,
        weight: null,
        props: mergedProps,
        provenance: { pass: 2, method: "deterministic", ref: "money-feed", computedAt: "2026-02-01T00:00:00.000Z" },
      },
    ]);

    const afterReingest = (await kg.listKgEdges({ rel: "linked_to" })).find((e) => e.src === SRC && e.dst === DST)!;

    // the core proof: none of the human-gated/annotation fields were reverted by the
    // re-ingest, even though the fresh source feed still says pending_review.
    expect(afterReingest.props.review_state).toBe("verified");
    expect(afterReingest.props.last_decision).toBe("confirm");
    expect(afterReingest.props.last_reviewer).toBe("tester");
    expect(afterReingest.props.review_note).toBe("confirmed via ARES VR");
    expect(afterReingest.props.corroboration).toBe("registry-confirmed");
    // non-preserved fields still refresh from the source feed as normal
    expect(afterReingest.props.role).toBe("jednatel");
  });

  it("WITHOUT the fix, a naive wholesale write would have reverted the human decision (control case)", async () => {
    const kg = makeKgRepo(pg);
    const NAIVE_SRC = "psp:person:9001";
    const NAIVE_DST = "company:ico:222";
    await pg.query(
      `insert into kg_node (id, kind, label, props, first_seen_pass, provenance)
       values
        ($1, 'person', 'Kontrolní Poslanec', '{}'::jsonb, 1, '{}'::jsonb),
        ($2, 'company', 'Kontrolní a.s.', $3::jsonb, 1, '{}'::jsonb)`,
      [NAIVE_SRC, NAIVE_DST, JSON.stringify({ ico: "222" })],
    );
    await kg.upsertKgEdges([
      {
        src: NAIVE_SRC,
        rel: "linked_to",
        dst: NAIVE_DST,
        weight: null,
        props: { role: "jednatel", source: "x", review_state: "verified", last_decision: "confirm" },
        provenance: { pass: 1, method: "deterministic", ref: "money-feed", computedAt: "2026-01-01T00:00:00.000Z" },
      },
    ]);
    // naive re-ingest: write the fresh props straight through, no merge (this is the
    // bug D1 describes — upsertKgEdges itself is, correctly, a wholesale replace)
    await kg.upsertKgEdges([
      {
        src: NAIVE_SRC,
        rel: "linked_to",
        dst: NAIVE_DST,
        weight: null,
        props: { role: "jednatel", source: "x", review_state: "pending_review" },
        provenance: { pass: 2, method: "deterministic", ref: "money-feed", computedAt: "2026-02-01T00:00:00.000Z" },
      },
    ]);
    const reverted = (await kg.listKgEdges({ rel: "linked_to" })).find((e) => e.src === NAIVE_SRC && e.dst === NAIVE_DST)!;
    expect(reverted.props.review_state).toBe("pending_review"); // confirms the bug is real without the fix
  });
});
