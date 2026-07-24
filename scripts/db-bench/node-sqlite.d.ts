// Minimal ambient types for Node 24's built-in `node:sqlite` (not yet in
// @types/node@20). Only the surface the DB-bench uses.
declare module "node:sqlite" {
  interface Statement {
    run(...params: unknown[]): { changes: number; lastInsertRowid: number };
    all(...params: unknown[]): Record<string, unknown>[];
    get(...params: unknown[]): Record<string, unknown> | undefined;
  }
  export class DatabaseSync {
    constructor(path: string);
    exec(sql: string): void;
    prepare(sql: string): Statement;
    close(): void;
  }
}
