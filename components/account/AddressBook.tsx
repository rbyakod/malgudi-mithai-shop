"use client";

// components/account/AddressBook.tsx
// Saved delivery addresses — list / create / delete / set-default over
// GET+POST /addresses and PATCH+DELETE /addresses/[id] (same endpoints the
// apps use). Each address carries a serviceability badge derived from its
// pincode via the shared lib/web/serviceability lookup (fresh tier /
// shelf-stable / outside delivery zones), checked once per distinct
// pincode on load.
//
// `variant="checkout"` renders the compact picker checkout embeds: one
// "Deliver here" action per card (selection via onSelect/selectedId, the
// selected card carries the gold frame), the add-address form stays, and
// the account-only actions (set-default / delete) are hidden.

import { useCallback, useEffect, useState } from "react";
import {useTranslations} from "next-intl";
import {apiFetch, ApiClientError} from "@/lib/web/apiClient";
import {useAuth} from "@/context/AuthContext";
import {
  checkServiceability,
  PINCODE_RE,
  type ServiceabilityResult,
} from "@/lib/web/serviceability";

export type Address = {
  id: string;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  pincode: string;
  tag?: "home" | "work" | "other" | null;
  isDefault?: boolean | null;
};

type NewAddress = {
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
  tag: "home" | "work" | "other";
  isDefault: boolean;
};

const EMPTY_FORM: NewAddress = {
  line1: "",
  line2: "",
  city: "",
  state: "",
  pincode: "",
  tag: "home",
  isDefault: false,
};

type Props = {
  variant?: "full" | "checkout";
  /** checkout only: id of the card rendered as selected. */
  selectedId?: string | null;
  /** checkout only: fired when the customer picks "Deliver here". */
  onSelect?: (address: Address) => void;
};

export function AddressBook({variant = "full", selectedId, onSelect}: Props) {
  const t = useTranslations("Addresses");
  const tCheckout = useTranslations("Checkout");
  const {session, ready} = useAuth();

  const [addresses, setAddresses] = useState<Address[] | null>(null);
  const [badges, setBadges] = useState<Record<string, ServiceabilityResult>>({});
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<NewAddress>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const data = await apiFetch<{items: Address[]}>("/addresses");
      setAddresses(data.items ?? []);
    } catch (err) {
      setAddresses([]);
      if (err instanceof ApiClientError) setError(t("loadError"));
    }
  }, [t]);

  // Load once when signed in (after the hydration restore pass).
  useEffect(() => {
    if (!ready || !session) return;
    void reload();
  }, [ready, session, reload]);

  // Serviceability badge per distinct pincode.
  useEffect(() => {
    if (!addresses) return;
    const pincodes = [...new Set(addresses.map((a) => a.pincode))];
    let cancelled = false;
    for (const pincode of pincodes) {
      if (badges[pincode]) continue;
      void checkServiceability(pincode).then((result) => {
        if (cancelled) return;
        setBadges((prev) => ({...prev, [pincode]: result}));
      });
    }
    return () => {
      cancelled = true;
    };
    // badges intentionally excluded — we only enqueue missing pincodes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addresses]);

  function badgeFor(pincode: string): string | null {
    const result = badges[pincode];
    if (!result) return null;
    if (result.kind === "ok" && result.tier === "fresh") return t("badgeFresh");
    if (result.kind === "ok") return t("badgeShelf");
    if (result.kind === "notServiceable") return t("badgeOutside");
    return null;
  }

  async function createAddress() {
    if (
      !form.line1.trim() ||
      !form.city.trim() ||
      !form.state.trim() ||
      !PINCODE_RE.test(form.pincode)
    ) {
      setError(t("formInvalid"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/addresses", {
        method: "POST",
        body: {
          line1: form.line1.trim(),
          ...(form.line2.trim() ? {line2: form.line2.trim()} : {}),
          city: form.city.trim(),
          state: form.state.trim(),
          pincode: form.pincode,
          tag: form.tag,
          ...(form.isDefault ? {isDefault: true} : {}),
        },
      });
      setForm(EMPTY_FORM);
      setShowForm(false);
      await reload();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.fieldErrors ? t("formInvalid") : t("saveError"));
      } else {
        setError(t("saveError"));
      }
    } finally {
      setBusy(false);
    }
  }

  async function setDefault(id: string) {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/addresses/${id}`, {
        method: "PATCH",
        body: {isDefault: true},
      });
      await reload();
    } catch {
      setError(t("saveError"));
    } finally {
      setBusy(false);
    }
  }

  async function removeAddress(id: string) {
    if (!window.confirm(t("confirmDelete"))) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/addresses/${id}`, {method: "DELETE"});
      await reload();
    } catch {
      setError(t("saveError"));
    } finally {
      setBusy(false);
    }
  }

  function tagLabel(tag: Address["tag"]): string {
    if (tag === "home") return t("tagHome");
    if (tag === "work") return t("tagWork");
    return t("tagOther");
  }

  return (
    <section aria-labelledby="address-book-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border-card pb-4">
        <h2
          id="address-book-heading"
          className="text-[11px] font-medium uppercase tracking-[0.22em] text-gold"
        >
          {t("heading")}
        </h2>
        <button
          type="button"
          data-testid="address-add-toggle"
          onClick={() => setShowForm((v) => !v)}
          className="text-[11px] font-medium uppercase tracking-[0.18em] text-primary underline-offset-4 hover:underline"
        >
          {showForm ? t("cancel") : t("add")}
        </button>
      </div>

      {showForm ? (
        <form
          data-testid="address-form"
          onSubmit={(e) => {
            e.preventDefault();
            void createAddress();
          }}
          noValidate
          className="mt-6 grid gap-4 rounded-2xl border border-border-card bg-bg-card p-6 sm:grid-cols-2"
        >
          <label className="block sm:col-span-2">
            <span className="text-[10px] font-medium uppercase tracking-[0.22em] text-primary/80">
              {t("fieldLine1")}
            </span>
            <input
              data-testid="address-line1"
              value={form.line1}
              onChange={(e) => setForm((f) => ({...f, line1: e.target.value}))}
              className="mt-2 w-full border-b border-gold/60 bg-transparent px-1 py-1.5 font-display text-base text-text-heading focus:border-gold focus:outline-none"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-[10px] font-medium uppercase tracking-[0.22em] text-primary/80">
              {t("fieldLine2")}
            </span>
            <input
              value={form.line2}
              onChange={(e) => setForm((f) => ({...f, line2: e.target.value}))}
              className="mt-2 w-full border-b border-gold/60 bg-transparent px-1 py-1.5 font-display text-base text-text-heading focus:border-gold focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-[10px] font-medium uppercase tracking-[0.22em] text-primary/80">
              {t("fieldCity")}
            </span>
            <input
              value={form.city}
              onChange={(e) => setForm((f) => ({...f, city: e.target.value}))}
              className="mt-2 w-full border-b border-gold/60 bg-transparent px-1 py-1.5 font-display text-base text-text-heading focus:border-gold focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-[10px] font-medium uppercase tracking-[0.22em] text-primary/80">
              {t("fieldState")}
            </span>
            <input
              value={form.state}
              onChange={(e) => setForm((f) => ({...f, state: e.target.value}))}
              className="mt-2 w-full border-b border-gold/60 bg-transparent px-1 py-1.5 font-display text-base text-text-heading focus:border-gold focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-[10px] font-medium uppercase tracking-[0.22em] text-primary/80">
              {t("fieldPincode")}
            </span>
            <input
              data-testid="address-pincode"
              inputMode="numeric"
              maxLength={6}
              value={form.pincode}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  pincode: e.target.value.replace(/\D/g, "").slice(0, 6),
                }))
              }
              className="mt-2 w-full border-b border-gold/60 bg-transparent px-1 py-1.5 font-display text-base text-text-heading focus:border-gold focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-[10px] font-medium uppercase tracking-[0.22em] text-primary/80">
              {t("fieldTag")}
            </span>
            <select
              value={form.tag}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  tag: e.target.value as NewAddress["tag"],
                }))
              }
              className="mt-2 w-full border-b border-border-input bg-bg-control px-1 py-1.5 font-display text-base text-text-heading focus:border-primary focus:outline-none"
            >
              <option value="home">{t("tagHome")}</option>
              <option value="work">{t("tagWork")}</option>
              <option value="other">{t("tagOther")}</option>
            </select>
          </label>
          <label className="flex items-center gap-2 sm:col-span-2">
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={(e) => setForm((f) => ({...f, isDefault: e.target.checked}))}
              className="h-4 w-4 accent-[#0053E2]"
            />
            <span className="text-xs text-text-secondary">{t("fieldDefault")}</span>
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              data-testid="address-save"
              disabled={busy}
              className="border-y border-gold/60 bg-bg-control px-6 py-3 font-display text-sm font-medium uppercase tracking-[0.18em] text-primary transition-colors hover:bg-bg-accent disabled:opacity-70"
            >
              {busy ? t("saving") : t("save")}
            </button>
          </div>
        </form>
      ) : null}

      {error ? (
        <p aria-live="polite" className="mt-4 text-sm italic text-text-muted">
          {error}
        </p>
      ) : null}

      {addresses === null ? (
        <p aria-busy="true" className="mt-6 text-sm italic text-text-muted">
          {t("loading")}
        </p>
      ) : addresses.length === 0 ? (
        <p className="mt-6 text-sm italic leading-relaxed text-text-muted">
          {t("empty")}
        </p>
      ) : (
        <ul className="mt-6 space-y-4">
          {addresses.map((address) => {
            const badge = badgeFor(address.pincode);
            const isSelected = variant === "checkout" && address.id === selectedId;
            return (
              <li
                key={address.id}
                data-testid="address-card"
                className={`rounded-2xl border bg-bg-card p-5 transition-colors ${
                  isSelected
                    ? "border-gold"
                    : "border-border-card"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="flex flex-wrap items-center gap-2 text-[10px] font-medium uppercase tracking-[0.22em] text-primary/80">
                      {address.tag ? <span>{tagLabel(address.tag)}</span> : null}
                      {address.isDefault ? (
                        <span className="rounded-full bg-gold px-2 py-0.5 text-[9px] font-semibold tracking-[0.18em] text-text-on-gold">
                          {t("defaultBadge")}
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-text-heading">
                      {address.line1}
                      {address.line2 ? `, ${address.line2}` : ""}
                    </p>
                    <p className="text-sm text-text-secondary">
                      {address.city}, {address.state} — {address.pincode}
                    </p>
                    {badge ? (
                      <p
                        data-testid="address-serviceability"
                        className="mt-2 text-xs italic text-text-muted"
                      >
                        {badge}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-4">
                    {variant === "checkout" ? (
                      <button
                        type="button"
                        data-testid="address-deliver-here"
                        aria-pressed={isSelected}
                        onClick={() => onSelect?.(address)}
                        className={`border-y px-4 py-2 font-display text-[11px] font-medium uppercase tracking-[0.18em] transition-colors ${
                          isSelected
                            ? "border-gold bg-gold text-text-on-gold"
                            : "border-gold/60 bg-bg-control text-primary hover:bg-bg-accent"
                        }`}
                      >
                        {isSelected
                          ? tCheckout("deliveringHere")
                          : tCheckout("deliverHere")}
                      </button>
                    ) : (
                      <>
                        {!address.isDefault ? (
                          <button
                            type="button"
                            onClick={() => void setDefault(address.id)}
                            disabled={busy}
                            className="text-[10px] font-medium uppercase tracking-[0.18em] text-primary underline-offset-4 hover:underline disabled:opacity-60"
                          >
                            {t("setDefault")}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          aria-label={t("deleteAria", {line1: address.line1})}
                          onClick={() => void removeAddress(address.id)}
                          disabled={busy}
                          className="text-[10px] font-medium uppercase tracking-[0.18em] text-text-muted underline-offset-4 hover:text-primary hover:underline disabled:opacity-60"
                        >
                          {t("delete")}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default AddressBook;
