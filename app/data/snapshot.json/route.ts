import { getSnapshotDownload } from "@/features/data-releases/getDataReleasesData";

/*
 * /data/snapshot.json — stažení výřezu veřejného grafu (batch 3D). Payload se
 * sestavuje z aktuálního úložiště přes existující repository API (jen čtení);
 * velikost je PŘIZNANÁ přesně: Content-Length = délka UTF-8 payloadu, tatáž
 * hodnota, jakou stránka /data ukazuje u tlačítka. Store nedostupný → 503,
 * nikdy prázdný soubor tvářící se jako vydání.
 */

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const snapshot = await getSnapshotDownload();
  if (!snapshot) {
    // An outage is never cacheable: the rule the feed routes adopted in c210d19,
    // reached these endpoints on 2026-09-06.
    return new Response(JSON.stringify({ error: "store unavailable" }), {
      status: 503,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "retry-after": "600" },
    });
  }
  return new Response(snapshot.json, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-length": String(snapshot.bytes),
      "content-disposition": `attachment; filename="${snapshot.filename}"`,
    },
  });
}
