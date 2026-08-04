import type { Metadata } from "next";
import DenikPage from "@/features/denik/DenikPage";
import { buildDenik } from "@/features/denik/deriveDenik";
import { getDenikData } from "@/features/denik/getDenikData";

/*
 * /denik — Deník republiky (moonshot 3A): chronologický denní záznam státu.
 * Tenká routa: načte zdrojová data, spustí čisté odvození (s volitelným
 * filtrem `?entita=<klíč>` — URL je odběr) a předá presentační komponentě.
 * Metadata česky přímo zde (messages/*.json mimo plochu — precedens /dukazy).
 */

export const metadata: Metadata = {
  title: "Deník republiky — Politicas",
  description:
    "Chronologický denní záznam státu: podepsané smlouvy, přikázání tisků výborům, vyhlášení ve Sbírce, rejstříkové role a rozhodnutí lidské brány — datované, citované, trvale odkazovatelné.",
  alternates: {
    types: {
      "application/rss+xml": "/denik/feed.xml",
      "application/feed+json": "/denik/feed.json",
    },
  },
};

export default async function DenikRoute({
  searchParams,
}: {
  searchParams: Promise<{ entita?: string | string[] }>;
}) {
  const params = await searchParams;
  const raw = params.entita;
  const entityKey = typeof raw === "string" && raw.length > 0 ? raw : null;

  const data = await getDenikData();
  if (!data) {
    return (
      <DenikPage
        ledger={null}
        coverage={null}
        limits={null}
        auditRows={0}
        builtOn={null}
        entityKey={entityKey}
        entityLabelCs={null}
      />
    );
  }

  const view = buildDenik(
    {
      contracts: data.contracts,
      roles: data.roles,
      bills: data.bills,
      reviews: data.reviews,
      changes: data.changes,
      today: data.builtOn,
    },
    entityKey,
  );

  return (
    <DenikPage
      ledger={view.ledger}
      coverage={data.coverage}
      limits={data.limits}
      auditRows={data.auditRows}
      builtOn={data.builtOn}
      entityKey={entityKey}
      entityLabelCs={view.entityLabelCs}
    />
  );
}
