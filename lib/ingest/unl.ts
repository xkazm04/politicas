// Re-export shim — the implementation moved to packages/czech-civic-data
// (moonshot batch 6, item 6A). See lib/ingest/normalize.ts for the rationale;
// the shim-equivalence test (lib/ingest/shims.test.ts) pins the export surface.
export * from "../../packages/czech-civic-data/src/unl";
