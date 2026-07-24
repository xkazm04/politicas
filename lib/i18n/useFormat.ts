"use client";

// Client hook: locale-aware formatters bound to the active locale.
// Usage in a client component:
//   const f = useFormat();
//   f.dec(mp.score)  ·  f.int(5214)  ·  f.date("2026-07-14")  ·  f.czk(2300)

import { useMemo } from "react";
import { useLocale } from "next-intl";
import { formattersFor, type Formatters } from "@/lib/format";
import { isLocale, defaultLocale } from "./config";

export function useFormat(): Formatters {
  const raw = useLocale();
  const locale = isLocale(raw) ? raw : defaultLocale;
  return useMemo(() => formattersFor(locale), [locale]);
}
