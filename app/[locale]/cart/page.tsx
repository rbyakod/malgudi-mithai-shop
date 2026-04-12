"use client";

import Image from "next/image";
import { Header } from "@/components/Header";
import { useCart } from "@/context/CartContext";

export default function CartPage() {
  const { items, updateQuantity, removeItem, clear } = useCart();

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="min-h-screen bg-[#fdf7f0] text-[#1b0b07]">
      <Header />
      <div className="mx-auto max-w-4xl px-4 pb-16 pt-4 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-semibold text-[#1b0b07] sm:text-3xl">
          Your cart
        </h1>
        <p className="mt-1 text-xs text-[#7a4f42] sm:text-sm">
          You have {totalItems} item{totalItems === 1 ? "" : "s"} in your cart.
        </p>

        {items.length === 0 ? (
          <p className="mt-6 text-sm text-[#7a4f42]">
            Your cart is empty. Explore our{" "}
            <a href="/sweets" className="font-semibold text-[#b94b4b]">
              sweets catalog
            </a>{" "}
            to add something sweet.
          </p>
        ) : (
          <>
            <div className="mt-6 space-y-4">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex gap-4 rounded-2xl border border-[#f0d7bf] bg-[#fefaf5] p-4"
                >
                  <div className="relative h-20 w-20 overflow-hidden rounded-xl bg-[#f7e0c9]">
                    <Image
                      src={item.image}
                      alt={item.name}
                      fill
                      sizes="80px"
                      className="object-cover"
                    />
                  </div>
                  <div className="flex flex-1 flex-col justify-between gap-1 text-xs">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-[#3b221b]">
                          {item.name}
                        </p>
                        <p className="text-[11px] text-[#7a4f42]">
                          {item.priceLabel}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="text-[11px] text-[#b94b4b] hover:underline"
                        onClick={() => removeItem(item.id)}
                      >
                        Remove
                      </button>
                    </div>
                    <div className="flex items-center gap-3">
                      <label
                        htmlFor={`qty-${item.id}`}
                        className="text-[11px] text-[#7a4f42]"
                      >
                        Qty
                      </label>
                      <input
                        id={`qty-${item.id}`}
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) =>
                          updateQuantity(
                            item.id,
                            Number(e.target.value) || 1
                          )
                        }
                        className="w-16 rounded-lg border border-[#e5cbb2] bg-white px-2 py-1 text-[11px] text-[#3b221b] outline-none ring-[#b94b4b]/20 focus:ring-2"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex flex-col gap-3 border-t border-[#f0d7bf] pt-4 text-xs text-[#7a4f42]">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-[#5c372c]">
                  Order summary
                </p>
                <button
                  type="button"
                  className="text-[11px] text-[#b94b4b] hover:underline"
                  onClick={clear}
                >
                  Clear cart
                </button>
              </div>
              <p>
                Final pricing, shipping, and taxes will be shown at checkout.
                For bulk or corporate orders, we may contact you to confirm
                details.
              </p>
              <button className="mt-2 w-full rounded-full bg-[#b94b4b] px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.16em] text-[#fdf7f0] shadow-sm hover:bg-[#a23f3f]">
                Proceed to checkout (demo)
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
