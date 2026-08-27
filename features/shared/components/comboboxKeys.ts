/**
 * @catalog Pure keyboard model for the ARIA combobox — the one place that says
 * what ArrowDown/Home/Enter/Escape mean, tested without a DOM.
 *
 * `Combobox.tsx` maps the result onto state; nothing here touches React, so the
 * idiom (open on arrow, clamp at the ends, Enter picks the active row, Escape
 * and Tab close) is pinned by a unit test rather than by three hand-rolled
 * copies agreeing by accident.
 */

export type ComboboxKeyState = {
  open: boolean;
  active: number;
  count: number;
};

export type ComboboxKeyAction =
  | { type: "open" }
  | { type: "move"; active: number }
  | { type: "select"; index: number }
  | { type: "close"; blur?: boolean }
  | { type: "none" };

/** Keys the combobox owns. Everything else is `none` (the input keeps it). */
export function comboboxKey(key: string, state: ComboboxKeyState): ComboboxKeyAction {
  const { open, active, count } = state;
  const last = Math.max(count - 1, 0);
  if (!open) {
    if (key === "ArrowDown" || key === "ArrowUp") return { type: "open" };
    return { type: "none" };
  }
  switch (key) {
    case "ArrowDown":
      return { type: "move", active: Math.min(active + 1, last) };
    case "ArrowUp":
      return { type: "move", active: Math.max(active - 1, 0) };
    case "Home":
      return { type: "move", active: 0 };
    case "End":
      return { type: "move", active: last };
    case "Enter":
      return count > 0 && active < count ? { type: "select", index: active } : { type: "none" };
    case "Escape":
      return { type: "close" };
    case "Tab":
      return { type: "close", blur: true };
    default:
      return { type: "none" };
  }
}

/** Groups a flat, already-ranked result list by `getGroup`, first-occurrence
 *  order, keeping each item's FLAT index — the keyboard walks the flat list,
 *  group headers are only a visual divider. */
export function groupItems<T>(
  items: readonly T[],
  getGroup: (item: T) => string,
): { group: string; items: { item: T; flatIndex: number }[] }[] {
  const out: { group: string; items: { item: T; flatIndex: number }[] }[] = [];
  const index = new Map<string, number>();
  items.forEach((item, flatIndex) => {
    const group = getGroup(item);
    let gi = index.get(group);
    if (gi === undefined) {
      gi = out.length;
      index.set(group, gi);
      out.push({ group, items: [] });
    }
    out[gi].items.push({ item, flatIndex });
  });
  return out;
}
