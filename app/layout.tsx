// app/layout.tsx
import type {Metadata} from "next";
import {headers} from "next/headers";
import "./globals.css";
import {CartProvider} from "@/context/CartContext";
import {AuthProvider} from "@/context/AuthContext";
import {QueryProvider} from "@/context/QueryProvider";
import {ThemeProvider} from "@/context/ThemeContext";
import {PageBackground} from "@/components/PageBackground";
import {AnalyticsScripts} from "@/components/Analytics/AnalyticsScripts";
import {InlineScript} from "@/components/InlineScript";
import {buildInitialThemeScript} from "@/lib/themes";
import {readWebDefaultTheme} from "@/lib/storefront-layout-server";
import {Toaster} from "sonner";

export const metadata: Metadata = {
  title: "Mishran",
  description: "Modern Indian mithai, delivered fresh."
};

export default async function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const pathname = (await headers()).get("x-mishran-pathname");

  if (pathname?.startsWith("/admin")) {
    return children;
  }

  // The theme a visitor starts on when they have not chosen one: Theme Settings → Website default theme.
  const initialThemeScript = buildInitialThemeScript(await readWebDefaultTheme());

  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        {/* Theme init — server-rendered as text/javascript so it runs
            before paint (FOUC prevention). On hydration the type becomes
            text/plain so React does not re-execute it. InlineScript
            applies the official Next.js pattern (toggling type between
            server/client) which suppresses the React 19 <script> warning. */}
        <InlineScript
          id="theme-init"
          type="text/javascript"
          html={initialThemeScript}
        />
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-text-light focus:shadow-lg"
        >
          Skip to content
        </a>
        <ThemeProvider>
          <PageBackground />
          <QueryProvider>
            <CartProvider>
              <AuthProvider>{children}</AuthProvider>
            </CartProvider>
          </QueryProvider>
          <Toaster position="top-center" richColors closeButton />
        </ThemeProvider>
        <AnalyticsScripts />
      </body>
    </html>
  );
}
