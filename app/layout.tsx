// app/layout.tsx
import type {Metadata} from "next";
import "./globals.css";
import {CartProvider} from "@/context/CartContext";
import {ThemeProvider} from "@/context/ThemeContext";
import {PageBackground} from "@/components/PageBackground";
import {DEFAULT_THEME, THEMES} from "@/lib/themes";

const validThemes = THEMES.map((theme) => theme.id);
const initialThemeScript = `(function(){try{var valid=${JSON.stringify(validThemes)};var stored=localStorage.getItem("mithai-theme");var aliases={myblue:"mblue2"};var normalized=(stored&&aliases[stored])||stored||${JSON.stringify(DEFAULT_THEME)};if(valid.indexOf(normalized)!==-1){document.documentElement.setAttribute("data-theme",normalized);if(stored!==normalized){localStorage.setItem("mithai-theme",normalized);}}}catch(e){}})()`;

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
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: initialThemeScript
          }}
        />
      </head>
      <body>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-text-light focus:shadow-lg"
        >
          Skip to content
        </a>
        <ThemeProvider>
          <PageBackground />
          <CartProvider>{children}</CartProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
