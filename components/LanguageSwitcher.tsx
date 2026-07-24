"use client";

// CS / EN toggle for the app shell. Flips the NEXT_LOCALE cookie via a server
// action and refreshes the RSC tree in place — the current route is preserved
// (no navigation). Konstrukt styling: mono uppercase, hairline group, active
// segment inverts to ink.

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { locales, localeShort, localeNames, isLocale, defaultLocale, type Locale } from "@/lib/i18n/config";
import { setLocale } from "@/lib/i18n/locale";

export default function LanguageSwitcher({ className = "" }: { className?: string }) {
  const raw = useLocale();
  const active: Locale = isLocale(raw) ? raw : defaultLocale;
  const t = useTranslations("common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const choose = (next: Locale) => {
    if (next === active || pending) return;
    startTransition(async () => {
      await setLocale(next);
      router.refresh();
    });
  };

  return (
    <div
      className={`inline-flex items-stretch border border-ink ${className}`}
      role="group"
      aria-label={t("languageSwitch")}
    >
      {locales.map((loc) => {
        const isActive = loc === active;
        return (
          <button
            key={loc}
            type="button"
            lang={loc}
            onClick={() => choose(loc)}
            aria-pressed={isActive}
            aria-label={localeNames[loc]}
            disabled={pending}
            className={`px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-widest transition-colors ${
              isActive
                ? "bg-ink text-paper"
                : "bg-transparent text-steel hover:text-ink"
            } ${pending ? "cursor-wait" : ""}`}
          >
            {localeShort[loc]}
          </button>
        );
      })}
    </div>
  );
}
