import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { defaultLocale, isLocale } from "@/lib/i18n/config";
import DenikPage from "@/features/denik/DenikPage";
import { buildDenik } from "@/features/denik/deriveDenik";
import { getDenikData } from "@/features/denik/getDenikData";
import { isEntityKey } from "@/features/schranka/followCodec";

/*
 * /denik — Deník republiky (moonshot 3A): chronologický denní záznam státu.
 * Tenká routa: načte zdrojová data, spustí čisté odvození (s volitelným
 * filtrem `?entita=<klíč>` — URL je odběr) a předá presentační komponentě.
 * Copy včetně metadat žije od 2026-08-05 v messages/{cs,en}.json pod `denik.*`.
 */

type DenikSearchParams = Promise<{ entita?: string | string[] }>;

/** Klíč entity z query: routa přijímá jakýkoli neprázdný řetězec (plocha pak
 *  přizná, že tvar klíče neodpovídá) — tady se jen normalizuje pole/prázdno. */
function readEntityKey(params: { entita?: string | string[] }): string | null {
  const raw = params.entita;
  return typeof raw === "string" && raw.length > 0 ? raw : null;
}

/**
 * Autodiscovery míří na TENTÝŽ feed, jaký nese viditelný odkaz v hlavičce.
 * Do 2026-08-12 bral `generateMetadata` nulu argumentů, takže `alternates`
 * ohlašovaly NEFILTROVANÝ feed i na pohledu `?entita=…` — čtečka, která si
 * odběr vezme z hlavičky dokumentu, tedy dostala celý deník místo entity, o
 * kterou čtenář stál. Filtr se propíše jen pro klíč PLATNÉHO tvaru (týž test
 * jako plocha): ohlásit odběr adresy, která nemůže nic doručit, je horší než
 * ohlásit celý deník.
 */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: DenikSearchParams;
}): Promise<Metadata> {
  const t = await getTranslations("denik");
  const entityKey = readEntityKey(await searchParams);
  const query =
    entityKey !== null && isEntityKey(entityKey)
      ? `?entita=${encodeURIComponent(entityKey)}`
      : "";
  return {
    title: t("meta.title"),
    description: t("meta.description"),
    alternates: {
      types: {
        "application/rss+xml": `/denik/feed.xml${query}`,
        "application/feed+json": `/denik/feed.json${query}`,
      },
    },
  };
}

export default async function DenikRoute({ searchParams }: { searchParams: DenikSearchParams }) {
  const entityKey = readEntityKey(await searchParams);

  const rawLocale = await getLocale();
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;

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
        locale={locale}
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
      locale={locale}
    />
  );
}
