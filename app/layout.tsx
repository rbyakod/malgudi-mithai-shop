// app/layout.tsx
import type {Metadata} from "next";
import {headers} from "next/headers";
import "./globals.css";
import {CartProvider} from "@/context/CartContext";
import {AuthProvider} from "@/context/AuthContext";
import {QueryProvider} from "@/context/QueryProvider";
import {ThemeProvider} from "@/context/ThemeContext";
import {AnalyticsScripts} from "@/components/Analytics/AnalyticsScripts";
import {InlineScript} from "@/components/InlineScript";
import {DEFAULT_THEME} from "@/lib/themes";
import {Toaster} from "sonner";
import localFont from "next/font/local";

// Mishran Design System: the two families inside the logo, self-hosted.
const mishranMono = localFont({
  src: "./fonts/JetBrainsMono-Medium.woff2",
  weight: "500",
  display: "swap",
  variable: "--font-ms-mono",
});
const mishranSerif = localFont({
  src: [
    {path: "./fonts/TiroDevanagariHindi-Regular.woff2", weight: "400", style: "normal"},
    {path: "./fonts/TiroDevanagariHindi-Italic.woff2", weight: "400", style: "italic"},
  ],
  display: "swap",
  variable: "--font-ms-serif",
});

// The Mishran Design System has one look, so the stored theme choice is
// ignored and the house theme is pinned before paint.
const initialThemeScript = `document.documentElement.setAttribute("data-theme",${JSON.stringify(DEFAULT_THEME)})`;

export const metadata: Metadata = {
  title: "Mishran",
  description: "Honest Indian mithai, made by hand with milk from our own dairy."
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

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${mishranMono.variable} ${mishranSerif.variable}`}
    >
      <body className="ms-site">
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
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-text-light focus:shadow-lg"
        >
          Skip to content
        </a>
        <ThemeProvider>
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
