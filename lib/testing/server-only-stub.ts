// Vitest alias target for the `server-only` package (see vitest.config.ts).
// The real package throws on import outside a React Server environment, which
// would break the lib-hosted tests that import feature loaders across the
// boundary (e.g. lib/db/pglite/repositories/review.test.ts). Under vitest the
// boundary marker is meaningless, so it resolves to this empty module.
export {};
