import { describe, expect, it } from "vitest";
import { PROP_REGISTRY, knownEdgeKeys, knownNodeKeys, unregisteredKeys } from "./propRegistry";

describe("prop-key registry — the jsonb schema", () => {
  it("is well-formed: sorted and de-duplicated per kind/rel (empty is legal — spoke_on carries no props)", () => {
    for (const table of [PROP_REGISTRY.nodes, PROP_REGISTRY.edges]) {
      for (const [scope, keys] of Object.entries(table)) {
        expect([...keys].sort(), `${scope} sorted`).toEqual(keys);
        expect(new Set(keys).size, `${scope} unique`).toBe(keys.length);
      }
    }
  });

  it("carries the keys the money loaders read — a silent drop here breaks a surface", () => {
    // The keys batches 014–016 introduced and the surfaces now render. If any of these
    // ever leaves the registry, persist-batch will refuse the next replay of a committed
    // payload, which is the right failure — but it should fail HERE first.
    for (const k of ["direction", "recipients_shared", "amountBasis"]) expect(knownEdgeKeys("supplies").has(k), k).toBe(true);
    for (const k of ["public_mandate", "public_mandate_attributable", "public_mandate_owners", "ico"])
      expect(knownNodeKeys("company").has(k), k).toBe(true);
    for (const k of ["review_state", "tie_class", "corroboration", "role"]) expect(knownEdgeKeys("linked_to").has(k), k).toBe(true);
  });

  it("flags an unknown key and only the unknown key", () => {
    expect(unregisteredKeys({ kind: "company" }, { ico: "1", public_mandate_reasn: "typo" })).toEqual([
      "public_mandate_reasn",
    ]);
    expect(unregisteredKeys({ rel: "supplies" }, { direction: "payer" })).toEqual([]);
  });

  it("treats an unknown kind/rel as having NO known keys — nothing is grandfathered by accident", () => {
    expect(unregisteredKeys({ kind: "mimozemstan" }, { anything: 1 })).toEqual(["anything"]);
  });
});
