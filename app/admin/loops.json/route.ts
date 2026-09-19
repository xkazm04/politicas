// GET /admin/loops.json — strojově čitelný stav smyček (6E). Gate-first jako
// stránka /admin (accessGate.ts): dokument obsahuje interní provozní stav,
// takže bez platného tokenu se vrací jen chybový JSON, nikdy data. Kodek je
// čistý (loopsJson.ts) a round-trip testovaný — co server pošle, konzument
// zparsuje týmž modulem.

import { readAdminGate } from "../accessGate";
import { getLoopsDoc } from "@/features/admin/loops/getLoopState";
import { encodeLoopsDoc } from "@/features/admin/loops/loopsJson";

export const dynamic = "force-dynamic";

// NOTHING this route answers may be cached — refused OR served. The document is
// internal operator state behind a cookie; until 2026-09-08 only the refusal
// carried `no-store` (the 503 rule every machine route holds since 2026-09-06)
// and a served 200 said nothing, so a shared cache between the operator and the
// server could hand the gated document to whoever asked next.
const JSON_HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } as const;
const REFUSED_HEADERS = JSON_HEADERS;

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
      { status, headers: REFUSED_HEADERS },
    );
  }
  const doc = await getLoopsDoc();
  return new Response(encodeLoopsDoc(doc), { status: 200, headers: JSON_HEADERS });
}
