import type { Metadata } from "next";
import { Archivo, Fraunces, IBM_Plex_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
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

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return {
    title: t("rootTitle"),
    description: t("rootDescription"),
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
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
