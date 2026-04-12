// app/layout.tsx
import type {Metadata} from "next";
import "./globals.css";
import {CartProvider} from "@/context/CartContext";
import {ThemeProvider} from "@/context/ThemeContext";
import {PageBackground} from "@/components/PageBackground";

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
            __html: `(function(){try{var t=localStorage.getItem("mithai-theme");if(t&&["festive","navy","sage","mindbox","myblue"].indexOf(t)!==-1)document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`
          }}
        />
      </head>
      <body>
        <ThemeProvider>
          <PageBackground />
          <CartProvider>{children}</CartProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
