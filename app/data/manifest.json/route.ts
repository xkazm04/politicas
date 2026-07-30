import { getReleaseManifest } from "@/features/data-releases/getDataReleasesData";

/*
 * /data/manifest.json — strojově čitelný manifest aktuálního vydání (batch
 * 3D). Týž objekt, ze kterého se sází stránka /data: verze, verdikty prahů,
 * počty, hlavy trezoru a otisk manifestu (FNV-1a/32, přiznaný v poli
 * hashAlgorithm — kontrolní otisk, ne podpis).
 */

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const manifest = await getReleaseManifest();
  if (!manifest) {
    return new Response(JSON.stringify({ error: "store unavailable" }), {
      status: 503,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }
  return new Response(JSON.stringify(manifest, null, 2), {
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
