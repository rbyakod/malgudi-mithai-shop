// app/layout.tsx
import type {Metadata} from "next";
import "./globals.css";
import {CartProvider} from "@/context/CartContext";
import {ThemeProvider} from "@/context/ThemeContext";

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
            __html: `(function(){try{var t=localStorage.getItem("mithai-theme");if(t)document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`
          }}
        />
      </head>
      <body>
        <ThemeProvider>
          <CartProvider>{children}</CartProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
