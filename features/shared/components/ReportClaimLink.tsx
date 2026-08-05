"use client";

/*
 * „Nahlásit chybu" — sourozenec ověřovacího odkazu u citovatelného čísla.
 *
 * Každé citovatelné tvrzení má trvalou adresu, kterou /overeni umí znovu
 * odvodit — tohle je druhá půlka smlouvy se čtenářem: když si myslí, že je
 * číslo ŠPATNĚ, má kam napsat, a mail s sebou nese vše, co redakce potřebuje
 * (ref tvrzení, adresu stránky v okamžiku kliknutí, dnešní datum).
 *
 * ENV-GATED: bez NEXT_PUBLIC_CONTACT_EMAIL se nevykreslí NIC — týž vzor jako
 * SiteFooter a PrivacyContent (NEXT_PUBLIC_* se inlinuje při buildu, prázdno
 * = nenastaveno). Tělo mailta se skládá až v onClick, protože adresa stránky
 * (window.location) existuje jen na klientovi a musí být ta AKTUÁLNÍ.
 */

import type { MouseEvent } from "react";
import { useTranslations } from "next-intl";

export default function ReportClaimLink({
  claimRef,
  className,
  label,
}: {
  /** Trvalý ref tvrzení (týž, který nese /overeni?ref=… nebo účtenka). */
  claimRef: string;
  /** Volitelné ladění na vizuální idiom plochy — výchozí je poznámkový stupeň. */
  className?: string;
  /** Volitelný text odkazu (výchozí: feedback.reportLabel). */
  label?: string;
}) {
  const t = useTranslations("feedback");
  const email = process.env.NEXT_PUBLIC_CONTACT_EMAIL;
  if (!email) return null;

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    // Adresa i datum se čtou v OKAMŽIKU kliknutí — href se přepíše dřív, než
    // prohlížeč provede výchozí navigaci na něj.
    const subject = t("emailSubject", { ref: claimRef });
    const body = t("emailBody", {
      ref: claimRef,
      url: window.location.href,
      date: new Date().toISOString().slice(0, 10),
    });
    e.currentTarget.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  return (
    <a
      href={`mailto:${email}`}
      onClick={handleClick}
      className={
        className ??
        "font-mono text-[10px] uppercase tracking-widest text-steel transition-colors hover:text-signal"
      }
    >
      {label ?? t("reportLabel")}
    </a>
  );
}
