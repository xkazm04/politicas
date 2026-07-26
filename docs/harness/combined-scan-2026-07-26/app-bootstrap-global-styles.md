# App Bootstrap & Global Styles — Combined Bug-Hunt + UI-Perfectionist Scan
> Total: 5

## 1. No `theme-color` metadata — mobile browser chrome stays unbranded/default
- **Lens**: UI
- **Severity**: Medium
- **Category**: missing-meta
- **File**: app/layout.tsx:29-35
- **Scenario**: A user opens any route on a mobile browser (Chrome/Android, Safari/iOS with "Show color in tab bar", or installs the site as a PWA). The address bar / status bar chrome renders with the browser's default color instead of matching the "Konstrukt" poster palette (`--color-ink` #131313 or `--color-paper` #f0eee7).
- **Root cause**: `generateMetadata()` only returns `title` and `description`. Unlike `viewport`, Next.js does not auto-inject a `theme-color` meta tag — it must be declared explicitly (either in the `metadata`/`viewport` export or as a static `<meta>` tag), and no such declaration exists anywhere in the root layout.
- **Impact**: Every route ships an unbranded, jarring browser chrome on mobile, undermining the carefully designed poster identity described in the file's own comments ("jádro plakátu").
- **Fix sketch**: Add `themeColor: "#131313"` (or a light/dark pair) to a `viewport` export in `app/layout.tsx`, matching `--color-ink`/`--color-paper` from `globals.css`.

## 2. No favicon/app icon anywhere in `app/` — every page load 404s the icon request
- **Lens**: UI
- **Severity**: Low
- **Category**: missing-asset
- **File**: app/layout.tsx (root layout scope)
- **Scenario**: Load any route; the browser tab shows a generic globe/blank icon, and DevTools Network tab shows a 404 for `/favicon.ico`. Confirmed via glob: no `app/favicon.ico`, `app/icon.*`, or equivalent file-convention icon exists in the project.
- **Root cause**: Next.js App Router auto-wires `<link rel="icon">` only when a matching `app/favicon.ico`/`app/icon.(ico|png|svg)` file is present; none was added when the layout/design system was built.
- **Impact**: Unbranded browser tabs/bookmarks, plus a wasted 404 request on every navigation (minor noise in logs/network panel), inconsistent with the polished visual identity the rest of the design tokens establish.
- **Fix sketch**: Add an `app/icon.svg` (or `favicon.ico`) using the `--color-signal`/`--color-ink` marks so Next.js auto-generates the icon `<link>` tags.

## 3. Global `body` background is the dark "ink" tone, conflicting with the "paper" canvas convention used everywhere else
- **Lens**: Bug
- **Severity**: Medium
- **Category**: design-token-consistency
- **File**: app/globals.css:43-46; app/layout.tsx:49
- **Scenario**: Any route/boundary that doesn't explicitly paint `bg-paper` over its full viewport height — e.g. a route segment's `loading.tsx`/`error.tsx` boundary, a short-content page, or any gap left by `AppShell`'s route-conditional layout ("vyjmuté plochy si AppShell rozhodne sám podle route") — shows raw near-black (`#131313`) filling the visible area instead of the warm paper canvas (`#f0eee7`) that is documented as the site's actual "plátno" (canvas).
- **Root cause**: The stylesheet's own comment states colors exist so "components konzumují třídy (bg-paper, text-ink, …)" — i.e. paper is meant to be the base surface — yet the actual CSS `body` rule hard-codes `background: var(--color-ink)` as the document-wide default, inverting the intended base/foreground relationship. Nothing in `layout.tsx` (`min-h-full flex flex-col`) sets `bg-paper` at the body/html level to guarantee the intended canvas shows through.
- **Impact**: Any content gap, un-styled boundary, or route AppShell doesn't fully cover produces a jarring solid-black flash/frame instead of the intended paper tone — a visible design regression trap for every future route that forgets to explicitly set the background.
- **Fix sketch**: Set the true default surface at the root (`body { background: var(--color-paper); }` or apply `bg-paper` in `layout.tsx`'s `<body>` className), and let components/sections that specifically want the ink/poster-reverse treatment opt in locally.

## 4. No `metadataBase` configured — relative metadata URLs resolve against `localhost` in production
- **Lens**: Bug
- **Severity**: Medium
- **Category**: metadata-correctness
- **File**: app/layout.tsx:29-35
- **Scenario**: Any future (or already-inherited-from-`next-intl`) Open Graph/Twitter image or canonical URL added to page-level metadata will be resolved by Next.js relative to `metadataBase`. Since it's unset here, Next.js falls back to `http://localhost:3000` in production builds, and logs a build-time warning.
- **Root cause**: `generateMetadata()` in the root layout — the one place shared by every route — never sets `metadataBase: new URL(...)`, so there's no canonical origin declared for the whole metadata tree that all child routes inherit from.
- **Impact**: Social share previews (Twitter/Facebook/LinkedIn cards) and canonical/alternate-locale links for a civic-transparency site meant to be publicly shared would silently point at `localhost` instead of the real domain, breaking link previews with no visible error during development.
- **Fix sketch**: Add `metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://<prod-domain>")` to the object returned from `generateMetadata` in `app/layout.tsx`.

## 5. Root layout eagerly loads the entire i18n message catalog into every route's initial payload
- **Lens**: Bug
- **Severity**: Medium
- **Category**: performance / scalability
- **File**: app/layout.tsx:43,50
- **Scenario**: A user visits any single route (e.g. a lightweight archive detail page). `getMessages()` is called unconditionally in the root layout and the full result is handed to `NextIntlClientProvider`, which serializes it into the RSC payload/hydration data for that page — including every namespace's strings for the whole app, not just the ones the current route's client components actually use.
- **Root cause**: The root layout is the single inheritance point for all routes, so any inefficiency here compounds across the entire app; `getMessages()` with no namespace filter always returns the complete catalog, and nothing narrows it before it reaches `NextIntlClientProvider`.
- **Impact**: As the Czech-language translation catalog grows (this is a data-heavy civic-transparency app with many features), every route pays the download/parse/hydration cost of the full message set, inflating time-to-interactive on slow connections — a cost invisible in local dev but real in production, and it will only get worse since new routes can't opt out.
- **Fix sketch**: Scope `getMessages()`/`NextIntlClientProvider` per route segment (next-intl supports passing only the namespaces a given tree needs), or split provider scope so heavy/rarely-used namespaces are provided closer to the leaf routes that actually use them instead of at the root.
