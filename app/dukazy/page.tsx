import type { Metadata } from "next";
import DukazyPage from "@/features/dukazy/DukazyPage";
import { getDukazyData } from "@/features/dukazy/getDukazyData";

/*
 * /dukazy — Deník důkazů (batch 2C): veřejný věstník rozhodnutí lidské brány.
 * Tenká routa: načte feed a předá ho presentační komponentě. Metadata jsou
 * česky přímo zde (messages/*.json je mimo plochu 2C — precedens /plakat) a
 * ohlašují oba strojové formáty věstníku.
 */

export const metadata: Metadata = {
  title: "Deník důkazů — Politicas",
  description:
    "Veřejný věstník lidské brány: každé ověření, zamítnutí či žádost o doplnění vazby poslanec ↔ firma jako datovaný, citovatelný záznam s odkazy na primární registry.",
  alternates: {
    types: {
      "application/rss+xml": "/dukazy/feed.xml",
      "application/feed+json": "/dukazy/feed.json",
    },
  },
};

export default async function DukazyRoute() {
  // review_audit se mění každým rozhodnutím revizora — čte se za requestu,
  // null → čestný stav „nečitelné, ne prázdné" (viz getDukazyData).
  const data = await getDukazyData();
  return <DukazyPage data={data} />;
}
