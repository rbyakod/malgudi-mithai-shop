// app/layout.tsx
import type {Metadata} from "next";
import "./globals.css";
import {CartProvider} from "@/context/CartContext";
import {QueryProvider} from "@/context/QueryProvider";
import {ThemeProvider} from "@/context/ThemeContext";
import {PageBackground} from "@/components/PageBackground";
import {AnalyticsScripts} from "@/components/Analytics/AnalyticsScripts";
import {InlineScript} from "@/components/InlineScript";
import {DEFAULT_THEME, THEMES} from "@/lib/themes";
import {Toaster} from "sonner";

const validThemes = THEMES.map((theme) => theme.id);
const initialThemeScript = `(function(){try{var valid=${JSON.stringify(validThemes)};var aliases=${JSON.stringify({festive:"diwali-saffron",heritage:"wedding-heritage","heritage-2":"wedding-heritage",sage:"everyday-sage",navy:"mishran-default",mblue2:"mishran-default",mindbox:"mishran-default",coinbase:"mishran-default",ibm:"mishran-default",yoshida:"mishran-default",myblue:"mishran-default"})};var stored=localStorage.getItem("mithai-theme");var normalized=(stored&&aliases[stored])||stored||${JSON.stringify(DEFAULT_THEME)};if(valid.indexOf(normalized)!==-1){document.documentElement.setAttribute("data-theme",normalized);}else{document.documentElement.setAttribute("data-theme",${JSON.stringify(DEFAULT_THEME)});}}catch(e){}})()`;

export const metadata: Metadata = {
  title: "Malgudi Sweets",
  description: "Modern Indian mithai, delivered fresh."
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
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
            <CartProvider>{children}</CartProvider>
          </QueryProvider>
          <Toaster position="top-center" richColors closeButton />
        </ThemeProvider>
        <AnalyticsScripts />
      </body>
    </html>
  );
}
