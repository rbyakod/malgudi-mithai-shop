"use client";

// components/checkout/CheckoutFlow.tsx
// The checkout wizard — the web counterpart of the apps' checkout screens,
// over the SAME mobile API routes:
//
//   1. Address   — compact AddressBook picker (variant="checkout") +
//                  "Deliver here" + the shared serviceability lookup.
//   2. Delivery  — fresh tier only: today/tomorrow × morning/evening slots
//                  (buildSlotChoices, Android CheckoutViewModel parity).
//                  Shelf tier skips straight to the summary with an SLA note.
//   3. Payment   — POST /cart/validate mints the server-priced snapshot
//                  (totals displayed here are the SERVER's, not the cart
//                  estimate), then the payment sequence in
//                  lib/web/checkoutMachine drives create-order → Razorpay
//                  → verify. Success fires `purchase`, clears the cart, and
//                  lands on /checkout/success. Failures leave the order
//                  pending server-side and offer retry + WhatsApp.
//
// Guards: signed-out customers see the sign-in prompt (deep-linked back to
// /checkout); an empty cart redirects to /cart once both hydration restore
// passes have run.

import {useEffect, useRef, useState} from "react";
import {useLocale, useTranslations} from "next-intl";
import {useRouter, Link} from "@/i18n/navigation";
import {apiFetch, ApiClientError} from "@/lib/web/apiClient";
import {useAuth} from "@/context/AuthContext";
import {useCart} from "@/context/CartContext";
import {AddressBook, type Address} from "@/components/account/AddressBook";
import {SignInPrompt} from "@/components/account/SignInPrompt";
import {track} from "@/lib/analytics";
import {checkServiceability, type ServiceabilityTier} from "@/lib/web/serviceability";
import {splitCartId} from "@/lib/web/cartEstimate";
import {formatPaise} from "@/lib/web/format";
import {
  buildSlotChoices,
  initialPaymentState,
  runPayment,
  CheckoutStepError,
  type CheckoutDeps,
  type CreateOrderResult,
  type PaymentState,
  type SlotChoice,
} from "@/lib/web/checkoutMachine";
import {openRazorpayCheckout} from "@/lib/web/razorpay";
import {toWaDigits} from "@/lib/whatsapp";

type Props = {
  whatsapp: string;
};

type ValidateResponse = {
  snapshotId: string;
  items: Array<{
    productId: string;
    name: string;
    quantity: number;
    unit: string;
    priceInPaise: number;
  }>;
  totals: {
    itemsTotalInPaise: number;
    deliveryFeeInPaise: number;
    taxesInPaise: number;
    discountInPaise: number;
    totalInPaise: number;
  };
  pincodeTier: string;
  /** Applied coupon, normalized uppercase by the server (B8). */
  couponCode: string | null;
  freeDeliveryThresholdInPaise: number | null;
  expiresAt: string;
};

type Delivery = {
  address: Address;
  tier: ServiceabilityTier;
  city: string;
  slaDays: number;
};

type Phase = "address" | "slot" | "summary";

export function CheckoutFlow({whatsapp}: Props) {
  const t = useTranslations("Checkout");
  const locale = useLocale();
  const router = useRouter();
  const {session, ready} = useAuth();
  const {items, ready: cartReady, clear} = useCart();

  const [phase, setPhase] = useState<Phase>("address");
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [checkingAddress, setCheckingAddress] = useState(false);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [slot, setSlot] = useState<SlotChoice | null>(null);
  const [validating, setValidating] = useState(false);
  const [snapshot, setSnapshot] = useState<ValidateResponse | null>(null);
  const [validateError, setValidateError] = useState<string | null>(null);
  // Coupon (B8): `couponInput` is the live field; `appliedCoupon` is the
  // code the server accepted and stamped on the snapshot. Only the
  // SERVER's totals ever render — the coupon-blind local estimate is
  // never adjusted client-side.
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  // Payment rail (B12 online/COD, B14 UPI): online (full Razorpay sheet),
  // UPI (Razorpay checkout restricted to UPI — one-tap intent on mobile,
  // QR on desktop), or cash on delivery. Defaults to online; the choice
  // re-reads on every render of the summary step.
  const [paymentChoice, setPaymentChoice] = useState<"online" | "upi" | "cod">("online");
  const [payBusy, setPayBusy] = useState(false);
  const [payError, setPayError] = useState<{reason: string; message?: string} | null>(
    null,
  );

  // begin_checkout fires once per checkout visit, after the FIRST
  // successful validate — re-validations (slot change, stale snapshot)
  // must not re-fire it.
  const beginCheckoutFired = useRef(false);
  const paymentStateRef = useRef<PaymentState | null>(null);

  // An empty cart has nothing to check out with — redirect once both
  // hydration restore passes (auth + cart) have run, so a restoring cart
  // is never mistaken for an empty one. Suppressed on payment
  // confirmation: pay() clears the cart (now legitimately empty) right
  // before pushing the receipt, and this redirect would clobber it.
  const confirmRedirectGuard = useRef(false);
  const cartEmpty = ready && cartReady && !!session && items.length === 0;
  useEffect(() => {
    if (cartEmpty && !confirmRedirectGuard.current) void router.replace("/cart");
  }, [cartEmpty, router]);

  // ---- Validate: mint the server-priced snapshot ---------------------------

  async function validate(
    deliveryArg: Delivery,
    slotArg: SlotChoice | null,
    // undefined = keep the currently applied code; null = drop it (Remove).
    couponOverride?: string | null,
  ): Promise<ValidateResponse | null> {
    const code = couponOverride === undefined ? appliedCoupon : couponOverride;
    setValidating(true);
    setValidateError(null);
    setCouponError(null);
    try {
      const snap = await apiFetch<ValidateResponse>("/cart/validate", {
        method: "POST",
        body: {
          // Web cart ids are `${productId}:${packLabel}` for derived pack
          // sizes — split before sending (the API wants the base id).
          items: items.map(({id, quantity}) => {
            const {productId, packLabel} = splitCartId(id);
            return {productId, quantity, ...(packLabel ? {packLabel} : {})};
          }),
          pincode: deliveryArg.address.pincode,
          ...(slotArg ? {slot: {date: slotArg.date, window: slotArg.window}} : {}),
          ...(code ? {couponCode: code} : {}),
        },
      });
      setSnapshot(snap);
      setAppliedCoupon(snap.couponCode ?? null);
      if (snap.couponCode) setCouponInput(snap.couponCode);
      paymentStateRef.current = initialPaymentState(
        snap.snapshotId,
        deliveryArg.address.id,
      );
      if (!beginCheckoutFired.current) {
        beginCheckoutFired.current = true;
        track("begin_checkout", {
          value: snap.totals.totalInPaise / 100,
          currency: "INR",
          items: items.length,
        });
      }
      return snap;
    } catch (err) {
      if (err instanceof ApiClientError && err.code === "INVALID_COUPON") {
        // A coupon problem, not a cart problem: keep the last good
        // snapshot (totals stay clean, without the dead code) and surface
        // the server's reason — it is precise ("expired", "add ₹x more").
        setCouponError(err.message);
        setAppliedCoupon(null);
        return null;
      }
      setValidateError(messageForValidateError(err));
      return null;
    } finally {
      setValidating(false);
    }
  }

  function messageForValidateError(err: unknown): string {
    if (err instanceof ApiClientError) {
      switch (err.code) {
        case "PINCODE_NOT_SERVICEABLE":
          // The server message names the offending line (fresh-tier rule).
          return `${t("errors.pincode")} ${err.message}`;
        case "PRODUCT_NOT_FOUND":
          return t("errors.productGone");
        case "VALIDATION":
          return t("errors.notPriced");
        default:
          return t("errors.validate");
      }
    }
    return t("errors.validate");
  }

  // ---- Step 1: address + serviceability -------------------------------------

  async function selectAddress(address: Address) {
    setCheckingAddress(true);
    setAddressError(null);
    const result = await checkServiceability(address.pincode);
    setCheckingAddress(false);
    if (result.kind === "ok") {
      const next: Delivery = {
        address,
        tier: result.tier,
        city: result.city,
        slaDays: result.slaDays,
      };
      setDelivery(next);
      setSlot(null);
      setSnapshot(null);
      if (result.tier === "fresh") {
        setPhase("slot");
      } else {
        // Shelf-stable: no slot picking — straight to the server summary.
        setPhase("summary");
        void validate(next, null);
      }
      return;
    }
    setAddressError(
      result.kind === "notServiceable"
        ? t("errors.notServiceable")
        : result.kind === "invalid"
          ? t("errors.invalidPincode")
          : t("errors.serviceabilityCheck"),
    );
  }

  // ---- Step 2: slot (fresh only) ---------------------------------------------

  function confirmSlot() {
    if (!slot || !delivery) return;
    setPhase("summary");
    void validate(delivery, slot);
  }

  // ---- Coupon apply/remove (B8) --------------------------------------------------

  function applyCoupon() {
    if (!delivery) return;
    const code = couponInput.trim();
    if (!code) return;
    void validate(delivery, slot, code);
  }

  function removeCoupon() {
    if (!delivery) return;
    setCouponInput("");
    setCouponError(null);
    void validate(delivery, slot, null);
  }

  // ---- Step 3: pay -------------------------------------------------------------

  function stepError(err: unknown): CheckoutStepError {
    if (err instanceof CheckoutStepError) return err;
    if (err instanceof ApiClientError) {
      return new CheckoutStepError(err.message, err.code, err.status);
    }
    return new CheckoutStepError(
      err instanceof Error ? err.message : "Request failed",
      "NETWORK",
      0,
    );
  }

  function makeDeps(deliveryArg: Delivery, slotArg: SlotChoice | null): CheckoutDeps {
    return {
      createOrder: async (input, idempotencyKey) => {
        try {
          return await apiFetch<CreateOrderResult>(
            "/payments/razorpay/create-order",
            {method: "POST", body: input, idempotencyKey},
          );
        } catch (err) {
          throw stepError(err);
        }
      },
      verifyPayment: async (input, idempotencyKey) => {
        try {
          return await apiFetch("/payments/razorpay/verify", {
            method: "POST",
            body: input,
            idempotencyKey,
          });
        } catch (err) {
          throw stepError(err);
        }
      },
      openCheckout: async (input) => {
        const result = await openRazorpayCheckout({
          ...input,
          name: t("razorpayName"),
          description: t("razorpayDescription"),
          // B14 UPI rail: same order/verify pipeline — the widget just
          // opens with UPI as the only block (Razorpay's own intent/QR).
          ...(paymentChoice === "upi" ? {restrictToMethod: "upi" as const} : {}),
          // Prefill from the signed-in customer — never asked twice.
          prefill: {
            ...(session?.customer.name ? {name: session.customer.name} : {}),
            ...(session?.customer.email ? {email: session.customer.email} : {}),
            ...(session?.customer.phone ? {contact: session.customer.phone} : {}),
          },
        });
        // Adapt the widget's handler payload to the machine's outcome.
        return result.kind === "ok"
          ? {
              kind: "ok",
              paymentId: result.response.razorpay_payment_id,
              signature: result.response.razorpay_signature,
            }
          : result;
      },
      revalidate: async () => {
        const snap = await validate(deliveryArg, slotArg);
        if (!snap) throw new Error(validateError ?? t("errors.cartChanged"));
        return snap.snapshotId;
      },
      newIdempotencyKey: () => crypto.randomUUID(),
    };
  }

  async function pay() {
    if (!delivery || !snapshot || !session) return;
    // COD (B12): skip the payment machine entirely — the server mints the
    // order born confirmed with cash pending, no provider artifacts.
    if (paymentChoice === "cod") {
      setPayBusy(true);
      setPayError(null);
      try {
        const order = await apiFetch<{id: string}>("/orders/cod", {
          method: "POST",
          body: {
            snapshotId: snapshot.snapshotId,
            deliveryAddressId: delivery.address.id,
          },
          idempotencyKey: crypto.randomUUID(),
        });
        confirmRedirectGuard.current = true;
        track("purchase", {
          orderId: order.id,
          value: snapshot.totals.totalInPaise / 100,
          currency: "INR",
          items: items.length,
        });
        clear();
        router.push(`/checkout/success?orderId=${encodeURIComponent(order.id)}`);
      } catch (err) {
        const step = stepError(err);
        setPayError({reason: "create-failed", message: step.message});
        // An expired/stale snapshot explains itself on re-validate.
        if (step.code === "VALIDATION" || step.code === "SNAPSHOT_NOT_FOUND") {
          void validate(delivery, slot);
        }
      } finally {
        setPayBusy(false);
      }
      return;
    }
    setPayBusy(true);
    setPayError(null);
    const state =
      paymentStateRef.current ??
      initialPaymentState(snapshot.snapshotId, delivery.address.id);
    const {state: nextState, outcome} = await runPayment(
      makeDeps(delivery, slot),
      state,
    );
    paymentStateRef.current = nextState;
    setPayBusy(false);

    if (outcome.kind === "confirmed") {
      // Set BEFORE clear() — the empty-cart effect must not steal this
      // navigation with its /cart redirect.
      confirmRedirectGuard.current = true;
      track("purchase", {
        orderId: outcome.orderId,
        value:
          (nextState.created?.amountInPaise ?? snapshot.totals.totalInPaise) / 100,
        currency: "INR",
        items: items.length,
      });
      clear();
      router.push(`/checkout/success?orderId=${encodeURIComponent(outcome.orderId)}`);
      return;
    }
    if (outcome.kind === "cart-changed") {
      // The cart can no longer be validated — refresh the summary (its
      // error state explains what changed) and surface the fallback.
      setPayError({reason: "cart-changed", message: outcome.message});
      void validate(delivery, slot);
      return;
    }
    // retryable — the order (if any) stays pending server-side.
    setPayError({reason: outcome.reason, message: outcome.message});
  }

  // ---- Shared rendering bits ---------------------------------------------------

  const digits = toWaDigits(whatsapp);
  const waFallbackHref = digits
    ? `https://wa.me/${digits}?text=${encodeURIComponent(
        [
          "Hi Mishran — I need help completing my checkout order:",
          "",
          ...items.map((i, idx) => `${idx + 1}. ${i.name} x ${i.quantity}${i.priceLabel ? ` · ${i.priceLabel}` : ""}`),
        ].join("\n"),
      )}`
    : "#";

  function formatSlotDate(date: string): string {
    try {
      return new Intl.DateTimeFormat(locale, {
        day: "numeric",
        month: "short",
        timeZone: "Asia/Kolkata",
      }).format(new Date(`${date}T12:00:00Z`));
    } catch {
      return date;
    }
  }

  function slotLabel(choice: SlotChoice): string {
    return t("slotLabel", {
      day: t(choice.offsetDay === 0 ? "slotToday" : "slotTomorrow"),
      date: formatSlotDate(choice.date),
      window: choice.window,
    });
  }

  const steps: Array<{key: string; label: string; state: "done" | "active" | "todo"}> =
    [
      {
        key: "address",
        label: t("steps.address"),
        state: phase === "address" ? "active" : "done",
      },
      {
        key: "delivery",
        label: t("steps.delivery"),
        state:
          phase === "slot"
            ? "active"
            : delivery && phase === "summary"
              ? "done"
              : "todo",
      },
      {key: "payment", label: t("steps.payment"), state: phase === "summary" ? "active" : "todo"},
    ];

  const stepList = (
    <ol className="flex flex-wrap gap-x-8 gap-y-2 border-b border-border-card pb-5 text-[10px] font-medium uppercase tracking-[0.22em]">
      {steps.map((step, index) => (
        <li
          key={step.key}
          className={
            step.state === "active"
              ? "text-gold"
              : step.state === "done"
                ? "text-text-secondary"
                : "text-text-muted/60"
          }
          aria-current={step.state === "active" ? "step" : undefined}
        >
          {String(index + 1).padStart(2, "0")} · {step.label}
        </li>
      ))}
    </ol>
  );

  // ---- Guards -------------------------------------------------------------------

  if (!ready || !cartReady) {
    return (
      <p aria-busy="true" className="text-sm italic text-text-muted">
        {t("loading")}
      </p>
    );
  }

  if (!session) {
    return <SignInPrompt next="/checkout" />;
  }

  if (items.length === 0) {
    // The redirect effect above owns the navigation — this is just the
    // quiet first frame while it happens.
    return (
      <p aria-busy="true" className="text-sm italic text-text-muted">
        {t("emptyCart")}
      </p>
    );
  }

  // ---- Phases ---------------------------------------------------------------------

  return (
    <div className="space-y-10">
      {stepList}

      {phase === "address" ? (
        <section aria-labelledby="checkout-address-heading">
          <AddressBook
            variant="checkout"
            selectedId={delivery?.address.id ?? null}
            onSelect={(address) => void selectAddress(address)}
          />
          {checkingAddress ? (
            <p aria-busy="true" className="mt-4 text-sm italic text-text-muted">
              {t("checkingAddress")}
            </p>
          ) : null}
          {addressError ? (
            <p
              data-testid="checkout-address-error"
              aria-live="polite"
              className="mt-4 text-sm italic leading-relaxed text-text-muted"
            >
              {addressError}
            </p>
          ) : null}
        </section>
      ) : null}

      {phase === "slot" && delivery ? (
        <section aria-labelledby="checkout-slot-heading">
          <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border-card pb-4">
            <h2
              id="checkout-slot-heading"
              className="text-[11px] font-medium uppercase tracking-[0.22em] text-gold"
            >
              {t("slotHeading")}
            </h2>
            <button
              type="button"
              onClick={() => setPhase("address")}
              className="text-[11px] font-medium uppercase tracking-[0.18em] text-primary underline-offset-4 hover:underline"
            >
              {t("changeAddress")}
            </button>
          </div>
          <div
            role="radiogroup"
            aria-labelledby="checkout-slot-heading"
            className="mt-5 grid gap-3 sm:grid-cols-2"
          >
            {buildSlotChoices().map((choice) => {
              const isSelected =
                slot?.date === choice.date && slot?.window === choice.window;
              return (
                <button
                  key={`${choice.date}-${choice.window}`}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  data-testid="slot-option"
                  onClick={() => setSlot(choice)}
                  className={`border px-4 py-3 text-left font-display text-sm transition-colors ${
                    isSelected
                      ? "border-gold bg-bg-accent text-primary"
                      : "border-border-card text-text-secondary hover:border-gold/60 hover:text-text-heading"
                  }`}
                >
                  {slotLabel(choice)}
                </button>
              );
            })}
          </div>
          <div className="mt-6 flex items-center gap-6">
            <button
              type="button"
              data-testid="slot-continue"
              onClick={confirmSlot}
              disabled={!slot}
              className="border-y border-gold/60 bg-bg-control px-6 py-3 font-display text-sm font-medium uppercase tracking-[0.18em] text-primary transition-colors hover:bg-bg-accent disabled:opacity-50"
            >
              {t("continue")}
            </button>
            <p className="text-xs italic text-text-muted">{t("slotNote")}</p>
          </div>
        </section>
      ) : null}

      {phase === "summary" && delivery ? (
        <section aria-labelledby="checkout-summary-heading">
          <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border-card pb-4">
            <h2
              id="checkout-summary-heading"
              className="text-[11px] font-medium uppercase tracking-[0.22em] text-gold"
            >
              {t("summaryHeading")}
            </h2>
            <button
              type="button"
              onClick={() => setPhase(delivery.tier === "fresh" ? "slot" : "address")}
              className="text-[11px] font-medium uppercase tracking-[0.18em] text-primary underline-offset-4 hover:underline"
            >
              {delivery.tier === "fresh" ? t("changeSlot") : t("changeAddress")}
            </button>
          </div>

          <p className="mt-4 text-sm leading-relaxed text-text-secondary">
            {delivery.address.line1}
            {delivery.address.line2 ? `, ${delivery.address.line2}` : ""},{" "}
            {delivery.address.city}, {delivery.address.state} —{" "}
            {delivery.address.pincode}
          </p>
          <p className="mt-1 text-xs italic text-text-muted">
            {slot
              ? slotLabel(slot)
              : t("shelfNote", {days: String(delivery.slaDays)})}
          </p>

          {validating || !snapshot ? (
            <p
              aria-busy="true"
              data-testid="checkout-validating"
              className="mt-8 text-sm italic text-text-muted"
            >
              {t("validating")}
            </p>
          ) : (
            <>
              {/* Server-priced items — the snapshot is the pricing truth. */}
              <ul className="mt-8 divide-y divide-border-card">
                {snapshot.items.map((item) => (
                  <li
                    key={`${item.productId}-${item.unit}`}
                    className="flex flex-wrap items-baseline justify-between gap-2 py-4"
                  >
                    <div>
                      <p className="text-sm text-text-heading">{item.name}</p>
                      <p className="mt-1 text-xs text-text-muted">
                        {t("itemUnitPrice", {
                          quantity: String(item.quantity),
                          unit: item.unit,
                          price: formatPaise(item.priceInPaise),
                        })}
                      </p>
                    </div>
                    <p className="font-display text-base text-text-heading">
                      {formatPaise(item.priceInPaise * item.quantity)}
                    </p>
                  </li>
                ))}
              </ul>

              {/* Coupon (B8) — the applied code rides every re-validate;
                  the totals below are always the server's. */}
              <div
                data-testid="checkout-coupon"
                className="mt-6 border-y border-border-card py-4"
              >
                {appliedCoupon ? (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-text-secondary">
                      <span className="font-display tracking-[0.14em] text-gold">
                        {appliedCoupon}
                      </span>{" "}
                      · {t("couponApplied")}
                    </p>
                    <button
                      type="button"
                      data-testid="checkout-coupon-remove"
                      onClick={removeCoupon}
                      disabled={validating}
                      className="text-[11px] font-medium uppercase tracking-[0.18em] text-primary underline-offset-4 hover:underline disabled:opacity-50"
                    >
                      {t("couponRemove")}
                    </button>
                  </div>
                ) : (
                  <form
                    className="flex flex-wrap items-center gap-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      applyCoupon();
                    }}
                  >
                    <label
                      htmlFor="checkout-coupon-input"
                      className="text-[11px] font-medium uppercase tracking-[0.18em] text-text-secondary"
                    >
                      {t("couponLabel")}
                    </label>
                    <input
                      id="checkout-coupon-input"
                      data-testid="checkout-coupon-input"
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                      placeholder={t("couponPlaceholder")}
                      maxLength={40}
                      autoComplete="off"
                      spellCheck={false}
                      disabled={validating}
                      className="w-44 border border-border-input bg-bg-card px-3 py-2 text-sm uppercase tracking-[0.14em] text-text-heading placeholder:text-text-muted placeholder:normal-case placeholder:tracking-normal focus:border-gold focus:outline-none disabled:opacity-60"
                    />
                    <button
                      type="submit"
                      data-testid="checkout-coupon-apply"
                      disabled={!couponInput.trim() || validating}
                      className="border border-border-input px-4 py-2 text-[11px] font-medium uppercase tracking-[0.18em] text-text-secondary transition-colors hover:border-gold hover:text-primary disabled:opacity-50"
                    >
                      {t("couponApply")}
                    </button>
                  </form>
                )}
                {couponError ? (
                  <p
                    data-testid="checkout-coupon-error"
                    role="alert"
                    className="mt-2 text-xs italic leading-relaxed text-primary"
                  >
                    {couponError}
                  </p>
                ) : null}
              </div>

              <dl className="mt-6 space-y-2 text-sm">
                <div className="flex justify-between text-text-secondary">
                  <dt>{t("totalsItems")}</dt>
                  <dd>{formatPaise(snapshot.totals.itemsTotalInPaise)}</dd>
                </div>
                <div className="flex justify-between text-text-secondary">
                  <dt>{t("totalsDelivery")}</dt>
                  <dd>{formatPaise(snapshot.totals.deliveryFeeInPaise)}</dd>
                </div>
                {snapshot.totals.discountInPaise > 0 ? (
                  <div className="flex justify-between text-text-secondary">
                    <dt>{t("totalsDiscount")}</dt>
                    <dd>−{formatPaise(snapshot.totals.discountInPaise)}</dd>
                  </div>
                ) : null}
                <div className="flex justify-between border-t border-border-card pt-3 text-text-heading">
                  <dt className="font-display text-base">{t("totalsTotal")}</dt>
                  <dd
                    data-testid="checkout-total"
                    className="font-display text-base"
                  >
                    {formatPaise(snapshot.totals.totalInPaise)}
                  </dd>
                </div>
              </dl>
              <p className="mt-3 text-xs italic text-text-muted">{t("taxNote")}</p>

              {/* Payment rail (B12) — online via Razorpay, or cash at the
                  door. Radios keep the choice one glance wide. */}
              <fieldset
                data-testid="checkout-payment-method"
                disabled={payBusy}
                className="mt-8"
              >
                <legend className="text-[11px] font-medium uppercase tracking-[0.22em] text-primary">
                  {t("paymentMethodLabel")}
                </legend>
                <div className="mt-3 space-y-2">
                  <label
                    data-testid="checkout-payment-online"
                    className="flex cursor-pointer items-start gap-3 text-sm text-text-secondary"
                  >
                    <input
                      type="radio"
                      name="checkout-payment-method"
                      checked={paymentChoice === "online"}
                      onChange={() => setPaymentChoice("online")}
                      className="mt-1 accent-gold"
                    />
                    <span>
                      {t("payOnline")}
                      <span className="block text-xs italic text-text-muted">
                        {t("payOnlineNote")}
                      </span>
                    </span>
                  </label>
                  <label
                    data-testid="checkout-payment-upi"
                    className="flex cursor-pointer items-start gap-3 text-sm text-text-secondary"
                  >
                    <input
                      type="radio"
                      name="checkout-payment-method"
                      checked={paymentChoice === "upi"}
                      onChange={() => setPaymentChoice("upi")}
                      className="mt-1 accent-gold"
                    />
                    <span>
                      {t("payUpi")}
                      <span className="block text-xs italic text-text-muted">
                        {t("payUpiNote")}
                      </span>
                    </span>
                  </label>
                  <label
                    data-testid="checkout-payment-cod"
                    className="flex cursor-pointer items-start gap-3 text-sm text-text-secondary"
                  >
                    <input
                      type="radio"
                      name="checkout-payment-method"
                      checked={paymentChoice === "cod"}
                      onChange={() => setPaymentChoice("cod")}
                      className="mt-1 accent-gold"
                    />
                    <span>
                      {t("payCod")}
                      <span className="block text-xs italic text-text-muted">
                        {t("codNote")}
                      </span>
                    </span>
                  </label>
                </div>
              </fieldset>

              <div className="mt-8">
                <button
                  type="button"
                  data-testid="checkout-pay"
                  onClick={() => void pay()}
                  disabled={payBusy}
                  className="border-y border-gold/60 bg-bg-control px-8 py-3 font-display text-sm font-medium uppercase tracking-[0.18em] text-primary transition-colors hover:bg-bg-accent disabled:opacity-70"
                >
                  {payBusy
                    ? t("paying")
                    : t("payNow", {amount: formatPaise(snapshot.totals.totalInPaise)})}
                </button>
              </div>

              {validateError ? (
                <p
                  data-testid="checkout-validate-error"
                  aria-live="polite"
                  className="mt-5 text-sm italic leading-relaxed text-text-muted"
                >
                  {validateError}{" "}
                  <Link
                    href="/cart"
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    {t("backToCart")}
                  </Link>
                </p>
              ) : null}

              {payError ? (
                <div
                  data-testid="checkout-pay-error"
                  className="mt-6 rounded-2xl border border-border-card bg-bg-card p-5"
                >
                  <p className="text-sm leading-relaxed text-text-heading">
                    {t(`payErrors.${payError.reason}`)}
                  </p>
                  {payError.message ? (
                    <p className="mt-1 text-xs leading-relaxed text-text-muted">
                      {payError.message}
                    </p>
                  ) : null}
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      data-testid="checkout-retry"
                      onClick={() => void pay()}
                      disabled={payBusy}
                      className="rounded-full bg-primary px-5 py-2 text-xs font-semibold text-text-light transition-colors hover:bg-primary-hover disabled:opacity-70"
                    >
                      {t("retry")}
                    </button>
                    <a
                      href={waFallbackHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() =>
                        track("whatsapp_clicked", {source: "checkout-pay-failed"})
                      }
                      className="rounded-full border border-border-input px-5 py-2 text-xs font-semibold text-text-secondary transition-colors hover:border-primary hover:text-primary"
                    >
                      {t("whatsappFallback")}
                    </a>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </section>
      ) : null}
    </div>
  );
}

export default CheckoutFlow;
