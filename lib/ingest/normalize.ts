// Re-export shim — the implementation moved to packages/czech-civic-data
// (moonshot batch 6, item 6A: the normalization layer is now a standalone
// in-repo package with its own tests + README). App code keeps importing from
// "@/lib/ingest/normalize"; this shim guarantees the surface is unchanged.
// The relative specifier (not the `czech-civic-data` tsconfig alias) keeps the
// import resolvable under vitest and Next without extra resolver config.
export * from "../../packages/czech-civic-data/src/normalize";
