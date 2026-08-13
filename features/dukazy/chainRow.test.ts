// ŘETĚZ SE DOSTANE AŽ NA VĚSTNÍK — od zápisu po vykreslený záznam.
//
// `review_audit` je připojený append-only řetěz (chain_pos + prev_hash +
// row_hash, ověřovaný `verifyAuditChain`) a /dukazy je veřejná plocha právě
// těchhle řádků. Do 2026-08-13 z něj nepublikovala nic: sloupce se SELECTovaly
// (`select *`) a mapper je zahazoval, protože `ReviewAuditRow` pro ně neměl
// pole. Novinář, který si na věstníku přečetl „tenhle nález prošel branou",
// neměl jediný údaj, kterým by si to ověřil.
//
// Tenhle test jde celou cestou nad SKUTEČNOU PGlite: zapíše dvě rozhodnutí,
// přečte je zpátky mapperem a ověří, že (1) řetězové sloupce dorazí, (2) to, co
// dorazí, JE ten řetěz — `verifyAuditChain` nad poli složenými výhradně
// z mapperova výstupu projde, (3) čistá derivace je donese až na záznam.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Izolovaný datový adresář — NIKDY ne ./.pglite (živý/pracovní), viz precedens
// lib/db/pglite/repositories/review.test.ts. Nastavit PŘED importem open().
const dataDir = mkdtempSync(join(tmpdir(), "politicas-dukazy-chain-"));
process.env.PGLITE_PATH = dataDir;

const { open } = await import("@/lib/db/pglite/internals");
const { makeReviewRepo } = await import("@/lib/db/pglite/repositories/review");
const { verifyAuditChain } = await import("@/lib/db/pglite/ledger");
const { deriveEvidenceFeed } = await import("./deriveFeed");

const SRC = "psp:person:6790";
const DST = "company:ico:00000111";

describe("řetěz brány dorazí z databáze až na věstník", () => {
  let pg: Awaited<ReturnType<typeof open>>;
  let repo: ReturnType<typeof makeReviewRepo>;

  beforeAll(async () => {
    pg = await open();
    repo = makeReviewRepo(pg);
    await pg.query(
      `insert into kg_node (id, kind, label, props, first_seen_pass, provenance)
       values ($1, 'person', 'Testovací Poslanec', '{}'::jsonb, 1, '{}'::jsonb),
              ($2, 'company', 'Testovací s.r.o.', '{}'::jsonb, 1, '{}'::jsonb)`,
      [SRC, DST],
    );
    await pg.query(
      `insert into kg_edge (src, rel, dst, weight, props, provenance)
       values ($1, 'linked_to', $2, null, $3::jsonb, $4::jsonb)`,
      [SRC, DST, JSON.stringify({ review_state: "pending_review" }), JSON.stringify({ pass: 1 })],
    );
    await repo.setTieReviewState(SRC, DST, "needs-more", "tester", "chybí výpis");
    await repo.setTieReviewState(SRC, DST, "confirm", "tester", null);
  });

  afterAll(async () => {
    await pg.close();
    rmSync(dataDir, { recursive: true, force: true });
  });

  it("mapper vrací pozici v řetězu i oba otisky — dřív je zahazoval", async () => {
    const rows = await repo.listReviewAudit({ src: SRC, dst: DST });
    expect(rows).toHaveLength(2);
    for (const r of rows) {
      expect(typeof r.chainPos).toBe("number");
      expect(r.prevHash).toMatch(/^[0-9a-f]{64}$/);
      expect(r.rowHash).toMatch(/^[0-9a-f]{64}$/);
    }
    // Pozice jsou po sobě jdoucí a přiřazuje je zapisovatel, ne odečet.
    expect([...rows].map((r) => r.chainPos).sort()).toEqual([1, 2]);
  });

  it("to, co mapper vrátí, JE ten řetěz — verifikátor nad ním projde", async () => {
    const rows = await repo.listReviewAudit({ src: SRC, dst: DST });
    // Složeno VÝHRADNĚ z mapperova výstupu: kdyby některé pole cestou ztratilo
    // hodnotu nebo se přepsalo, `verifyAuditChain` to tady odhalí.
    const chained = rows
      .map((r) => ({
        id: r.id,
        src: r.src,
        rel: r.rel,
        dst: r.dst,
        decision: r.decision,
        reviewer: r.reviewer,
        note: r.note,
        decidedAt: r.decidedAt,
        priorState: r.priorState,
        chainPos: r.chainPos as number,
        prevHash: r.prevHash as string,
        rowHash: r.rowHash as string,
      }))
      .sort((a, b) => a.chainPos - b.chainPos);
    const verdict = verifyAuditChain(chained);
    expect(verdict.ok, JSON.stringify(verdict)).toBe(true);
  });

  it("čistá derivace donese řetěz i účtenku až na záznam věstníku", async () => {
    const rows = await repo.listReviewAudit({ src: SRC, dst: DST });
    const entries = deriveEvidenceFeed({
      audit: rows,
      nodeLabels: new Map([
        [SRC, "Testovací Poslanec"],
        [DST, "Testovací s.r.o."],
      ]),
      tieSources: new Map(),
      forensic: [],
    });
    expect(entries).toHaveLength(2);
    for (const e of entries) {
      const row = rows.find((r) => r.id === e.id)!;
      expect(e.chainPos).toBe(row.chainPos);
      expect(e.rowHash).toBe(row.rowHash);
      // Účtenka cituje HRANU, kterou brána rozhodla, a firma svůj spis.
      expect(e.receiptHref).toMatch(/^\/zdroj\/h\./);
      expect(e.companyHref).toBe("/penize/firma/00000111");
    }
    // Pracovní poznámka revizora ven nesmí ani teď (rozšířený řádek nese `note`).
    expect(JSON.stringify(entries)).not.toContain("chybí výpis");
  });
});
