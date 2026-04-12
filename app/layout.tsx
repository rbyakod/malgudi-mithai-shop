// app/layout.tsx
import type {Metadata} from "next";
import "./globals.css";
import {CartProvider} from "@/context/CartContext";

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
    <html lang="en">
      <body>
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  );
}