import type { Metadata } from "next";
import Script from "next/script";
import { Archivo, IBM_Plex_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import AppShell from "@/features/shell/AppShell";
import "./globals.css";

// Two voices, one platform:
//  Archivo   — variable grotesque up to Black (Konstrukt posters, UI)
//  Plex Mono — source citations, audit logs (Rentgen, source chips everywhere)
//
// A THIRD was loaded here until 2026-08-13 and rendered by nothing. Fraunces
// („editorial display serif (Broadsheet)") arrived with the art-direction round
// that Konstrukt won; the surface it was meant for was never built, and a
// repo-wide grep for `font-serif` / `--font-fraunces` found exactly ONE hit —
// the token declaration in app/globals.css. Measured on the 2026-08-13 build:
// two `rel=preload`ed subsets, 67 388 B + 59 540 B = 126 928 B, i.e. 47 % of
// this app's 270 316 B preloaded font payload, on EVERY route, for zero
// rendered glyphs (plus a 19 748 B fallback-adjust file that was not
// preloaded). docs/DESIGN.md §2 called it „reserved"; a reserve that ships is
// not a reserve, so both the font and the token are gone. If an editorial
// sub-surface ever wants a serif, it costs one `next/font` call to bring back —
// and then it will be paid for by a page that draws it.
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin", "latin-ext"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
});

/**
 * Základ absolutní adresy pro metadata (og:image apod.) — čte se z env,
 * NIKDY se nevymýšlí doména (týž princip jako header-derived základ
 * v app/sitemap.ts, jen tady headers nejsou k dispozici: metadata se
 * renderují i staticky). Bez NEXT_PUBLIC_SITE_URL platí výchozí chování
 * Nextu; neplatná hodnota se poctivě ignoruje, nikdy neshodí render.
 */
function metadataBaseFromEnv(): URL | undefined {
  const raw = process.env.NEXT_PUBLIC_SITE_URL;
  if (!raw) return undefined;
  try {
    return new URL(raw);
  } catch {
    console.error(`[metadata] NEXT_PUBLIC_SITE_URL není platná URL, ignoruje se: ${raw}`);
    return undefined;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  const title = t("rootTitle");
  const description = t("rootDescription");
  // Sdílené openGraph/twitter bloky: každá routa tak dědí kartu (obraz dodává
  // app/opengraph-image.tsx přes file convention). Per-route title/description
  // zůstávají netknuté — tohle je jen kořenový základ.
  return {
    metadataBase: metadataBaseFromEnv(),
    title,
    description,
    openGraph: {
      type: "website",
      siteName: "politicas",
      title,
      description,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    <html
      lang={locale}
      className={`${archivo.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider locale={locale} messages={messages}>
          {/* Levá lišta je součástí layoutu — vyjmuté plochy si AppShell
              rozhodne sám podle route (landing, admin, archiv Rentgen). */}
          <AppShell>{children}</AppShell>
        </NextIntlClientProvider>
        {/* Plausible — cookieless analytika, env-gated: bez
            NEXT_PUBLIC_PLAUSIBLE_DOMAIN se skript vůbec nevykreslí (týž
            no-op-bez-env vzor jako Sentry v instrumentation-client.ts).
            Žádné cookies → žádný consent banner (viz .env.example). */}
        {process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN && (
          <Script
            strategy="afterInteractive"
            data-domain={process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN}
            src="https://plausible.io/js/script.js"
          />
        )}
      </body>
    </html>
  );
}
