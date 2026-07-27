/**
 * The one cap every whole-relation knowledge-graph read uses.
 *
 * Callers used to pass ad-hoc limits (100_000 here, 200_000 there, 10_000 elsewhere).
 * That was harmless while the graph was small and became a correctness bug the moment it
 * was not: money batch 012 grew `supplies` from 2 290 to 153 731 rows against loaders
 * capped at 100_000, and because both listers ORDER their reads, the loss was systematic —
 * every company whose id sorted late lost all of its contracts, silently, on a page whose
 * whole promise is that its numbers are real.
 *
 * One shared constant means the next ingest that outgrows it trips ONE guard
 * (`warnIfTruncated` in the kg repository) and is fixed in ONE place, instead of degrading
 * three surfaces differently. It is deliberately far above the current corpus (~154k nodes
 * / ~178k edges) rather than snugly above it.
 */
export const KG_READ_CAP = 1_000_000;
