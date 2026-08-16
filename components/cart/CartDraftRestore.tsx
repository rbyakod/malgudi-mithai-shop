"use client";

// components/cart/CartDraftRestore.tsx
// Client half of the abandoned-cart email link: /cart?draft={sessionId}
// fetches the saved draft and replaces the cart with it in one write
// (CartContext.replaceCart), confirms to the customer, fires cart_restored,
// and strips the param so a refresh doesn't re-clobber whatever the
// customer has added since. A missing/expired draft is quiet — the customer
// just lands on a normal cart.
//
// Runs once per session id. useSearchParams lives here (inside the page's
// Suspense boundary) per the Next.js client-hook prerender rule.

import {useEffect, useRef, useState} from "react";
import {useTranslations} from "next-intl";
import {usePathname, useRouter} from "@/i18n/navigation";
import {useSearchParams} from "next/navigation";
import {useCart} from "@/context/CartContext";
import {track} from "@/lib/analytics";
import {fetchCartDraft} from "@/lib/web/cartDraftSync";

export function CartDraftRestore() {
  const t = useTranslations("Cart");
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const {ready, replaceCart} = useCart();

  const [restored, setRestored] = useState(false);
  // The attemptedRef guard makes the restore single-shot per draft id
  // regardless of param/pathname identity churn after router.replace.
  const attemptedRef = useRef<string | null>(null);

  const draftId = params.get("draft");

  useEffect(() => {
    if (!draftId || !ready || attemptedRef.current === draftId) return;
    attemptedRef.current = draftId;
    let cancelled = false;
    void fetchCartDraft(draftId).then((items) => {
      if (cancelled) return;
      // Strip the param either way — a dead link shouldn't haunt the URL.
      const next = new URLSearchParams(params.toString());
      next.delete("draft");
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
      if (!items || items.length === 0) return;
      replaceCart(items);
      setRestored(true);
      track("cart_restored", {
        source: "email",
        itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
      });
    });
    return () => {
      cancelled = true;
    };
    // params/pathname identity churns on the replace above — the
    // attemptedRef guard is what makes this single-shot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftId, ready]);

  if (!restored) return null;

  return (
    <p
      data-testid="cart-restored-note"
      className="rounded-2xl border border-gold/40 bg-gold/5 px-5 py-4 text-sm leading-relaxed text-text-secondary"
    >
      {t("restoredNote")}
    </p>
  );
}

export default CartDraftRestore;
