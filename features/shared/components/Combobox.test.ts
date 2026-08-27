/**
 * The combobox keyboard model, pinned without a DOM (no @testing-library in
 * devDependencies — the repo's test globs are `*.test.ts`, so the pure
 * reducer is what a unit can hold). `Combobox.tsx` maps these actions 1:1.
 */
import { describe, expect, it } from "vitest";

import { comboboxKey, groupItems } from "./comboboxKeys";

describe("comboboxKey", () => {
  it("opens on either arrow when closed, ignores everything else", () => {
    const closed = { open: false, active: 0, count: 5 };
    expect(comboboxKey("ArrowDown", closed)).toEqual({ type: "open" });
    expect(comboboxKey("ArrowUp", closed)).toEqual({ type: "open" });
    expect(comboboxKey("Enter", closed)).toEqual({ type: "none" });
    expect(comboboxKey("Escape", closed)).toEqual({ type: "none" });
  });

  it("moves and clamps at both ends", () => {
    expect(comboboxKey("ArrowDown", { open: true, active: 0, count: 3 })).toEqual({ type: "move", active: 1 });
    expect(comboboxKey("ArrowDown", { open: true, active: 2, count: 3 })).toEqual({ type: "move", active: 2 });
    expect(comboboxKey("ArrowUp", { open: true, active: 0, count: 3 })).toEqual({ type: "move", active: 0 });
    expect(comboboxKey("Home", { open: true, active: 2, count: 3 })).toEqual({ type: "move", active: 0 });
    expect(comboboxKey("End", { open: true, active: 0, count: 3 })).toEqual({ type: "move", active: 2 });
  });

  it("never moves below zero on an empty list", () => {
    expect(comboboxKey("End", { open: true, active: 0, count: 0 })).toEqual({ type: "move", active: 0 });
    expect(comboboxKey("ArrowDown", { open: true, active: 0, count: 0 })).toEqual({ type: "move", active: 0 });
  });

  it("Enter selects the active row only when one exists", () => {
    expect(comboboxKey("Enter", { open: true, active: 1, count: 3 })).toEqual({ type: "select", index: 1 });
    expect(comboboxKey("Enter", { open: true, active: 0, count: 0 })).toEqual({ type: "none" });
  });

  it("Escape closes and keeps focus; Tab closes and lets focus move on", () => {
    expect(comboboxKey("Escape", { open: true, active: 0, count: 3 })).toEqual({ type: "close" });
    expect(comboboxKey("Tab", { open: true, active: 0, count: 3 })).toEqual({ type: "close", blur: true });
  });

  it("leaves typing keys to the input", () => {
    expect(comboboxKey("a", { open: true, active: 0, count: 3 })).toEqual({ type: "none" });
  });
});

describe("groupItems", () => {
  it("groups in first-occurrence order and keeps flat indexes", () => {
    const items = [
      { n: "Brno", k: "JM" },
      { n: "Praha", k: "PHA" },
      { n: "Znojmo", k: "JM" },
    ];
    const groups = groupItems(items, (i) => i.k);
    expect(groups.map((g) => g.group)).toEqual(["JM", "PHA"]);
    expect(groups[0].items.map((x) => x.flatIndex)).toEqual([0, 2]);
    expect(groups[1].items.map((x) => x.flatIndex)).toEqual([1]);
  });

  it("returns no groups for no items", () => {
    expect(groupItems([], () => "x")).toEqual([]);
  });
});
