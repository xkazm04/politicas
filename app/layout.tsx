import type { Metadata } from "next";
import Script from "next/script";
import { Archivo, Fraunces, IBM_Plex_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import AppShell from "@/features/shell/AppShell";
import "./globals.css";

// Three voices, one platform:
//  Fraunces  — editorial display serif (Broadsheet)
//  Archivo   — variable grotesque up to Black (Konstrukt posters, UI)
//  Plex Mono — source citations, audit logs (Rentgen, source chips everywhere)
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin", "latin-ext"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin", "latin-ext"],
  axes: ["opsz"],
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
      className={`${archivo.variable} ${fraunces.variable} ${plexMono.variable} h-full antialiased`}
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
