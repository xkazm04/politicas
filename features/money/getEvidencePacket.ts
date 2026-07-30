// Server-only: sestavení důkazního paketu pro /penize/[pspId]/paket.
// Jedno kliknutí = spis poslance (getMoneyMpDetail, indexovaná cesta) →
// čistá kompilace (packet.ts). Žádný zápis: paket se odvozuje při každém
// požadavku z aktuálního stavu grafu, takže vazba, kterou kontrola mezitím
// zamítla, z paketu zmizí sama (a přibude do přiznaných vyloučení).
//
// Degradace jako všude: žádný store / žádné vazby / chyba → null, nikdy
// částečný paket.

import "server-only";
import { reportLoaderFailure } from "@/lib/db/loaderGuard";
import { getMoneyMpDetail } from "./getMpDetail";
import { compileEvidencePacket, type EvidencePacket } from "./packet";

export async function getEvidencePacket(pspId: number): Promise<EvidencePacket | null> {
  try {
    const detail = await getMoneyMpDetail(pspId);
    if (!detail) return null;
    // Datum sestavení je datovaný otisk (poster-konvence "stav dat ke dni");
    // ZÁMĚRNĚ není součástí hashe obsahu — viz packet.ts.
    const compiledAt = new Date().toISOString().slice(0, 10);
    return compileEvidencePacket(detail, { compiledAt });
  } catch (err) {
    reportLoaderFailure("getEvidencePacket", err);
    return null;
  }
}
