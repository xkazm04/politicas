// GET /admin/loops.json — strojově čitelný stav smyček (6E). Gate-first jako
// stránka /admin (accessGate.ts): dokument obsahuje interní provozní stav,
// takže bez platného tokenu se vrací jen chybový JSON, nikdy data. Kodek je
// čistý (loopsJson.ts) a round-trip testovaný — co server pošle, konzument
// zparsuje týmž modulem.

import { readAdminGate } from "../accessGate";
import { getLoopsDoc } from "@/features/admin/loops/getLoopState";
import { encodeLoopsDoc } from "@/features/admin/loops/loopsJson";

export const dynamic = "force-dynamic";

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" } as const;

export async function GET(): Promise<Response> {
  const gate = await readAdminGate();
  if (gate !== "ok") {
    const status = gate === "not-configured" ? 503 : 401;
    return new Response(
      JSON.stringify({
        error:
          gate === "not-configured"
            ? "Konzole není nakonfigurována (ADMIN_TOKEN chybí)."
            : "Přístup neověřen — přihlaste se tokenem na /admin.",
      }),
      { status, headers: JSON_HEADERS },
    );
  }
  const doc = await getLoopsDoc();
  return new Response(encodeLoopsDoc(doc), { status: 200, headers: JSON_HEADERS });
}
