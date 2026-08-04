/*
 * Server-only čtení faktu o přepočtu indexu pro /schranka/novinky.json
 * a feedy schránky.
 *
 * ── PROČ NE getLeaderboardData ──────────────────────────────────────────────
 * Žebříček provenance NESE (`LeaderboardData.provenance`), ale sestavit ho
 * znamená postavit celý žebříček: čte uzly osob, strany, orgány, mandáty
 * i členství a počítá 207 rozpadů skóre (CLAUDE.md: teple 424–522 ms).
 * Schránka z toho potřebuje TŘI pole z jednoho props, a odznak lišty se ptá
 * z každé stránky — tohle je proto JEDEN indexovaný list uzlů osob, striktní
 * podmnožina toho, co žebříček stejně čte.
 *
 * Čte se JEDNÍM indexovaným listem na KG_READ_CAP: malý limit nutí PGlite jít
 * primárním klíčem `kg_node` a filtrovat kind ručně (viz CLAUDE.md, měření
 * u buildLeaderboard). Agregace je čistá (recomputeFactFromProps).
 *
 * Neúspěch = null a `reportLoaderFailure`: schránka pak řádek o přepočtu
 * prostě nemá, zbytek delty platí (žádná polovičatá pravda).
 */

import "server-only";
import { cache } from "react";
import { reportLoaderFailure } from "@/lib/db/loaderGuard";
import { KG_READ_CAP } from "@/lib/db/readCap";
import { getStore } from "@/lib/db/store";
import { recomputeFactFromProps, type RecomputeFact } from "./recomputeFact";

export const getRecomputeFact = cache(async (): Promise<RecomputeFact | null> => {
  try {
    const store = await getStore();
    if (!store) return null;
    const persons = await store.listKgNodes({ kind: "person", limit: KG_READ_CAP });
    return recomputeFactFromProps(persons.map((p) => p.props ?? {}));
  } catch (err) {
    reportLoaderFailure("getRecomputeFact", err);
    return null;
  }
});
