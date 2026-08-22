/* Money loop — batch 016: audit the legal-form tables against ARES's own číselník.
 *
 * WHY. `lib/analysis/public-body.ts` decides whether a company's money may be attributed
 * to a politician, and the first thing it asks is the entity's legal form. Its two tables
 * are hand-maintained, and `PRIVATE_LEGAL_FORMS` is not a fallback — it is an ASSERTION
 * that a code is "known NOT to be a public body". A wrong entry there does not merely fail
 * to detect a public body; it declares one private, which is the module's own stated
 * expensive error.
 *
 * Batch 016 spot-checked two entries and found both wrong, in different ways:
 *
 *   301 "Státní podnik"          — label CORRECT, classification WRONG. Lesy České
 *                                  republiky, s.p. (42196451) and Povodí Labe, s.p.
 *                                  (70890005) are státní podniky; a state enterprise is
 *                                  state-owned by definition and contracts heavily.
 *   736 "Dobrovolný svazek obcí" — label WRONG. ARES's číselník says 736 is
 *                                  **Pobočný spolek**. The classification (non-public)
 *                                  happens to be right for what 736 actually is, so the
 *                                  entry was harmless AND unverifiable at the same time.
 *
 * Two entries checked, two defects. That is a table that needs auditing whole, not
 * spot-checking — so this compares EVERY code in both tables against the číselník ARES
 * publishes, which is the same source several `verifiedVia` notes already cite.
 *
 * It reports; it does not rewrite. Whether a form is a public body is a judgment about
 * Czech public law, and the codes this flags are for a human to rule on — the script's job
 * is to make sure no entry rests on a label nobody checked.
 *
 *   npx tsx scripts/case-loops/money/legal-form-audit-b16.ts
 */
import { PRIVATE_LEGAL_FORMS, PUBLIC_LEGAL_FORMS } from "@/lib/analysis/public-body";

const OUT = "docs/data-analysis/case-money/qmoney-legal-forms-b16.json";
const CISELNIK = "https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ciselniky-nazevniky/vyhledat";

interface CiselnikEntry {
  kod: string;
  nazev: string;
  platnostOd: string | null;
  platnostDo: string | null;
}

/** Flatten the číselník payload into `kod → the CURRENTLY valid Czech label`.
 *  A code may appear several times with different validity windows (801 is
 *  „Obec (obecní úřad)" until 2001 and something else after), so the entry still in
 *  force is the one that decides — an expired label is how a table like this drifts. */
function parseCiselnik(payload: unknown): Map<string, CiselnikEntry[]> {
  const out = new Map<string, CiselnikEntry[]>();
  const groups = (payload as { ciselniky?: unknown[] } | null)?.ciselniky;
  if (!Array.isArray(groups)) return out;
  for (const g of groups as Record<string, unknown>[]) {
    const items = g.polozky ?? g.polozkyCiselniku;
    if (!Array.isArray(items)) continue;
    for (const it of items as Record<string, unknown>[]) {
      const kod = typeof it.kod === "string" ? it.kod : null;
      if (!kod) continue;
      const names = Array.isArray(it.nazev) ? (it.nazev as Record<string, unknown>[]) : [];
      const cs = names.find((n) => n.kodJazyka === "cs") ?? names[0];
      const entry: CiselnikEntry = {
        kod,
        nazev: typeof cs?.nazev === "string" ? cs.nazev : "(bez názvu)",
        platnostOd: typeof it.platnostOd === "string" ? it.platnostOd : null,
        platnostDo: typeof it.platnostDo === "string" ? it.platnostDo : null,
      };
      out.set(kod, [...(out.get(kod) ?? []), entry]);
    }
  }
  return out;
}

const current = (entries: CiselnikEntry[], today: string): CiselnikEntry | null =>
  entries.find((e) => (!e.platnostOd || e.platnostOd <= today) && (!e.platnostDo || e.platnostDo >= today)) ?? null;

/** Normalise for comparison — the tables and ARES differ in case and spacing, not meaning. */
const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

async function main() {
  const fs = await import("node:fs/promises");
  const today = new Date().toISOString().slice(0, 10);

  const res = await fetch(CISELNIK, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ kodCiselniku: "PravniForma", pocet: 1000 }),
    signal: AbortSignal.timeout(30_000),
  });
  const payload = (await res.json()) as unknown;
  const ciselnik = parseCiselnik(payload);
  if (ciselnik.size === 0) throw new Error("číselník parsed to 0 entries — refusing to audit against nothing");
  console.log(`ARES PravniForma číselník: ${ciselnik.size} distinct codes\n`);

  interface Row {
    code: string;
    table: "public" | "private";
    ourLabel: string;
    aresLabel: string | null;
    aresValidTo: string | null;
    status: "match" | "label-mismatch" | "not-in-ciselnik" | "expired";
    /** The entry's own `verifiedVia` already says this code is expired / absent, so the
     *  finding is ACKNOWLEDGED and not drift. A guard that re-reports what the table
     *  already documents is a guard nobody reads (the kernel's fire-rate rule). */
    acknowledged: boolean;
  }
  const rows: Row[] = [];

  const check = (code: string, ourLabel: string, note: string, table: "public" | "private") => {
    const says = (needle: string) => note.toUpperCase().includes(needle);
    const entries = ciselnik.get(code);
    if (!entries) {
      rows.push({
        code, table, ourLabel, aresLabel: null, aresValidTo: null,
        status: "not-in-ciselnik",
        acknowledged: says("NOT IN THE CURRENT ARES"),
      });
      return;
    }
    const now = current(entries, today);
    if (!now) {
      const last = entries[entries.length - 1];
      rows.push({
        code, table, ourLabel, aresLabel: last.nazev, aresValidTo: last.platnostDo,
        status: "expired",
        // Acknowledged only when the label ALSO still matches: an expired code whose text
        // drifted is drift, not a known-historical entry.
        acknowledged: says("EXPIRED") && fold(last.nazev) === fold(ourLabel),
      });
      return;
    }
    const status = fold(now.nazev) === fold(ourLabel) ? "match" : "label-mismatch";
    rows.push({
      code, table, ourLabel, aresLabel: now.nazev, aresValidTo: now.platnostDo,
      status,
      acknowledged: status === "match",
    });
  };

  for (const [code, info] of Object.entries(PUBLIC_LEGAL_FORMS)) check(code, info.label, info.verifiedVia, "public");
  for (const [code, info] of Object.entries(PRIVATE_LEGAL_FORMS)) check(code, info.label, info.verifiedVia, "private");

  rows.sort((a, b) => a.code.localeCompare(b.code));
  const bad = rows.filter((r) => !r.acknowledged);
  const acknowledged = rows.filter((r) => r.acknowledged && r.status !== "match");

  const report = {
    generatedFor: "money batch 016",
    generatedAt: today,
    method: "every code in PUBLIC_LEGAL_FORMS + PRIVATE_LEGAL_FORMS compared against the CURRENTLY valid ARES PravniForma číselník label",
    caveat:
      "a label match does NOT confirm the public/private classification — that is a judgment about Czech public law and is listed separately for a human ruling",
    ciselnikCodes: ciselnik.size,
    checked: rows.length,
    drift: bad.length,
    acknowledgedHistorical: acknowledged.length,
    rows,
  };
  await fs.writeFile(OUT, JSON.stringify(report, null, 2) + "\n", "utf8");

  console.log(
    `checked ${rows.length} codes · ${bad.length} DRIFT · ${acknowledged.length} acknowledged historical` +
      ` (expired or absent from the číselník, documented in verifiedVia)\n`,
  );
  if (bad.length === 0) {
    console.log("  (no drift — every code matches the číselník or is documented as historical)");
  }
  for (const r of bad) {
    console.log(
      `  ${r.code}  [${r.table}]  ${r.status.padEnd(16)} ours: ${r.ourLabel}\n        ARES: ${r.aresLabel ?? "—"}${r.aresValidTo && r.aresValidTo < "9999" ? ` (do ${r.aresValidTo})` : ""}`,
    );
  }
  console.log(`\n-> ${OUT}`);
}

main().then(() => process.exit(0));
