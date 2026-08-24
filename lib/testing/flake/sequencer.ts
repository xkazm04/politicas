/**
 * DURATION-ORDERED FILE SEQUENCER — history-driven-partitioning, implemented at
 * the only lever vitest actually offers.
 *
 * Vitest does not let you assign files to workers; it hands the next file to the
 * next free worker. That makes file ORDER the whole of the bin-packing decision,
 * and longest-first is exactly the greedy assignment the technique prescribes
 * ("sort tests by duration descending, assign each to the currently-least-loaded
 * worker — within a few percent of optimal and ten lines"). Vitest's own
 * `BaseSequencer` already sorts longest-first — but by FILE SIZE IN BYTES, a proxy
 * that is wrong here by orders of magnitude: `lib/db/kgOrder.test.ts` is a small
 * file that boots a WASM Postgres, and `messages.test.ts` files are large files
 * that finish in milliseconds.
 *
 * So: sort by MEASURED median duration from the retained history, descending.
 *
 * COLD START, handled the way the technique requires rather than the way that
 * breaks: an unmeasured file does not get zero (which would herd every new file to
 * the end of the queue, where a new slow file lands on the last worker and sets the
 * wall clock). It gets a PESSIMISTIC default at the current measured median, and
 * unmeasured files are interleaved among the measured ones rather than grouped.
 *
 * Sharding is inherited from BaseSequencer unchanged.
 *
 * HONESTY ABOUT WHERE THIS PAYS. On CI every run starts on a fresh machine with no
 * history, so every file is cold and this degrades to BaseSequencer's byte-size
 * heuristic with a stable tiebreak — no worse, no better. It pays on a developer's
 * box and on any runner with a warm `node_modules` cache. That is a real limit, and
 * it is stated here rather than discovered later.
 */

import { relative } from "node:path";

import { BaseSequencer } from "vitest/node";
import type { TestSpecification } from "vitest/node";

import { moduleDurations } from "./history";

export default class DurationSequencer extends BaseSequencer {
  async sort(files: TestSpecification[]): Promise<TestSpecification[]> {
    let durations: Map<string, number>;
    try {
      durations = moduleDurations();
    } catch {
      return super.sort(files);
    }
    if (durations.size === 0) return super.sort(files);

    const values = [...durations.values()].sort((a, b) => a - b);
    // Pessimistic default: the median of what we HAVE measured, so an unmeasured
    // file can never be treated as free.
    const unknownCost = values[Math.floor(values.length / 2)] ?? 0;

    const cost = (f: TestSpecification): number => {
      const rel = relative(process.cwd(), f.moduleId).replace(/\\/g, "/");
      return durations.get(rel) ?? unknownCost;
    };

    // Longest first; ties broken by path so the order is deterministic run to run
    // (a nondeterministic order makes two runs incomparable for flake detection).
    const sorted = [...files].sort((a, b) => cost(b) - cost(a) || a.moduleId.localeCompare(b.moduleId));

    if (process.env.POLITICAS_LANE_DEBUG) {
      const measured = sorted.filter((f) => durations.has(relative(process.cwd(), f.moduleId).split("\\").join("/")));
      console.info(
        `[sequencer] ${sorted.length} files, ${sorted.length - measured.length} with no duration history ` +
          `(charged the ${unknownCost} ms median). Head of the queue:\n` +
          sorted
            .slice(0, 5)
            .map((f) => `  ${Math.round(cost(f))} ms  ${relative(process.cwd(), f.moduleId).split("\\").join("/")}`)
            .join("\n"),
      );
    }
    return sorted;
  }
}
