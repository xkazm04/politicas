import type { Metadata } from "next";
import SchrankaPage from "@/features/schranka/SchrankaPage";

/*
 * /schranka — Občanská schránka (moonshot 7A): osobní civic inbox.
 * Tenká routa: plocha je klientská z nutnosti (sledování žije v localStorage,
 * server ho nezná). Metadata česky přímo zde (messages/*.json mimo plochu —
 * precedens /denik, /dukazy).
 */

export const metadata: Metadata = {
  title: "Občanská schránka — Politicas",
  description:
    "Sledujte poslance, sněmovní tisky, firmy a obce — bez účtu, sledování žije jen ve vašem prohlížeči. Schránka při každé návštěvě ukáže, co se v záznamu změnilo od té minulé: datované, citované zápisy deníku republiky a deníku důkazů.",
};

export default function SchrankaRoute() {
  return <SchrankaPage />;
}
