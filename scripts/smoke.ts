/*
 * Smoke test — the P6 launch ritual. Boots the PRODUCTION server (`next
 * start`) on a free port — or targets an already-running deployment via
 * --base-url — fetches a fixed route list and asserts two tiers:
 *
 *   Tier 1 (any machine, no store needed):
 *     /, /podminky, /ochrana-osobnich-udaju, /metodika → HTTP 200.
 *
 *   Tier 2 (needs the real knowledge-graph store):
 *     /zebricek, /poslanec/<real id>, /penize, /dashboard, /overeni →
 *     HTTP 200 AND the HTML carries NO mock badge (dashboard.mockBadge /
 *     mockTag render "ilustrativní ukázka" cs / "illustrative sample" en —
 *     matched case-insensitively, so both the uppercase badge and the
 *     lowercase tile tag are caught) AND /zebricek carries the 207 marker
 *     ("207 poslanců" / "207 MPs" — civicscore.lead + realNote, both
 *     server-rendered only on the real-data path). The /poslanec id is not
 *     hardcoded: it is harvested from the first /poslanec/<digits> link in
 *     the rendered /zebricek HTML — a second, implicit real-store assert.
 *
 * Usage:
 *   npm run smoke                       # next start on a free port, both tiers
 *   npm run smoke -- --tier1-only       # CI: no store on the runner
 *   npm run smoke -- --base-url https://politicas.cz   # target a live deploy
 *
 * `next start` requires an existing production build (.next) — the script
 * fails fast with a clear message instead of building implicitly; what gets
 * smoked should be EXACTLY the artifact you decided to ship.
 */

import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import process from "node:process";

const ROOT = path.resolve(__dirname, "..");

const TIER1_ROUTES = ["/", "/podminky", "/ochrana-osobnich-udaju", "/metodika"] as const;
/** /poslanec/<id> is appended at runtime, id harvested from /zebricek. */
const TIER2_ROUTES = ["/zebricek", "/penize", "/dashboard", "/overeni"] as const;

/** Rendered output of dashboard.mockBadge / mockTag in both locales (compared lowercase). */
const MOCK_MARKERS = ["ilustrativní ukázka", "illustrative sample"] as const;
/** Real-store signal on /zebricek: civicscore.lead / realNote both carry the literal count. */
const ZEBRICEK_MARKER = /207\s+(poslanc|MPs)/;

interface CheckResult {
  route: string;
  ok: boolean;
  detail: string;
}

function parseArgs(argv: string[]): { baseUrl: string | null; tier1Only: boolean } {
  let baseUrl: string | null = null;
  let tier1Only = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--tier1-only") tier1Only = true;
    else if (a === "--base-url") baseUrl = argv[++i] ?? null;
    else if (a.startsWith("--base-url=")) baseUrl = a.slice("--base-url=".length);
    else {
      console.error(`unknown argument: ${a}`);
      process.exit(2);
    }
  }
  if (baseUrl) baseUrl = baseUrl.replace(/\/+$/, "");
  return { baseUrl, tier1Only };
}

/** OS-assigned free port — listen on 0, read the number, release. No netstat parsing, no races with a fixed guess. */
function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address();
      if (addr && typeof addr === "object") {
        const port = addr.port;
        srv.close(() => resolve(port));
      } else {
        srv.close(() => reject(new Error("could not determine a free port")));
      }
    });
    srv.on("error", reject);
  });
}

async function waitForServer(baseUrl: string, timeoutMs = 60_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastErr = "no response yet";
  while (Date.now() < deadline) {
    try {
      const res = await fetch(baseUrl + "/", { redirect: "manual" });
      if (res.status > 0) return; // any HTTP answer means the server is up
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`server did not answer within ${timeoutMs / 1000}s (${lastErr})`);
}

async function fetchRoute(baseUrl: string, route: string): Promise<{ status: number; html: string }> {
  const res = await fetch(baseUrl + route, { redirect: "follow" });
  const html = await res.text();
  return { status: res.status, html };
}

function mockMarkerHit(html: string): string | null {
  const lower = html.toLowerCase();
  for (const m of MOCK_MARKERS) if (lower.includes(m)) return m;
  return null;
}

async function checkTier1(baseUrl: string): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  for (const route of TIER1_ROUTES) {
    try {
      const { status } = await fetchRoute(baseUrl, route);
      results.push({
        route,
        ok: status === 200,
        detail: status === 200 ? "200" : `expected 200, got ${status}`,
      });
    } catch (e) {
      results.push({ route, ok: false, detail: `fetch failed: ${e instanceof Error ? e.message : e}` });
    }
  }
  return results;
}

async function checkTier2(baseUrl: string): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  let mpRoute: string | null = null;

  for (const route of TIER2_ROUTES) {
    try {
      const { status, html } = await fetchRoute(baseUrl, route);
      const problems: string[] = [];
      if (status !== 200) problems.push(`expected 200, got ${status}`);
      const mock = mockMarkerHit(html);
      if (mock) problems.push(`mock badge rendered ("${mock}") — the real store is not backing this page`);
      if (route === "/zebricek") {
        if (!ZEBRICEK_MARKER.test(html)) problems.push('missing "207 poslanců/MPs" marker — leaderboard not on real data');
        const m = html.match(/\/poslanec\/(\d+)/);
        if (m) mpRoute = `/poslanec/${m[1]}`;
        else problems.push("no /poslanec/<id> link found — cannot derive a real MP id");
      }
      results.push({ route, ok: problems.length === 0, detail: problems.length === 0 ? "200, real data" : problems.join("; ") });
    } catch (e) {
      results.push({ route, ok: false, detail: `fetch failed: ${e instanceof Error ? e.message : e}` });
    }
  }

  if (mpRoute) {
    try {
      const { status, html } = await fetchRoute(baseUrl, mpRoute);
      const problems: string[] = [];
      if (status !== 200) problems.push(`expected 200, got ${status}`);
      const mock = mockMarkerHit(html);
      if (mock) problems.push(`mock badge rendered ("${mock}")`);
      results.push({ route: mpRoute, ok: problems.length === 0, detail: problems.length === 0 ? "200, real data" : problems.join("; ") });
    } catch (e) {
      results.push({ route: mpRoute, ok: false, detail: `fetch failed: ${e instanceof Error ? e.message : e}` });
    }
  } else {
    results.push({ route: "/poslanec/<id>", ok: false, detail: "skipped — no real MP id harvested from /zebricek" });
  }

  return results;
}

async function main(): Promise<void> {
  const { baseUrl: givenBaseUrl, tier1Only } = parseArgs(process.argv.slice(2));

  let child: ChildProcess | null = null;
  let baseUrl = givenBaseUrl;

  const shutdown = () => {
    if (child && !child.killed) child.kill();
  };
  process.on("SIGINT", () => {
    shutdown();
    process.exit(130);
  });

  try {
    if (!baseUrl) {
      if (!existsSync(path.join(ROOT, ".next"))) {
        console.error("no .next build found — run `npm run build` first (the smoke test boots the exact artifact you ship).");
        process.exit(2);
      }
      const port = await findFreePort();
      baseUrl = `http://127.0.0.1:${port}`;
      console.log(`booting production server: next start -p ${port}`);
      child = spawn(process.platform === "win32" ? "npx.cmd" : "npx", ["next", "start", "-p", String(port)], {
        cwd: ROOT,
        stdio: ["ignore", "pipe", "pipe"],
        shell: process.platform === "win32",
      });
      child.stderr?.on("data", (d: Buffer) => process.stderr.write(`[next] ${d}`));
      await waitForServer(baseUrl);
    } else {
      console.log(`targeting running server: ${baseUrl}`);
    }

    const results: CheckResult[] = await checkTier1(baseUrl);
    if (!tier1Only) results.push(...(await checkTier2(baseUrl)));

    console.log("\n── smoke results ─────────────────────────────");
    for (const r of results) {
      console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.route.padEnd(28)} ${r.detail}`);
    }
    const failed = results.filter((r) => !r.ok);
    console.log("──────────────────────────────────────────────");
    console.log(
      `${results.length - failed.length}/${results.length} passed` +
        (tier1Only ? " (tier 1 only)" : "") +
        (failed.length ? ` — ${failed.length} FAILED` : " — all green"),
    );
    process.exitCode = failed.length ? 1 : 0;
  } finally {
    shutdown();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
