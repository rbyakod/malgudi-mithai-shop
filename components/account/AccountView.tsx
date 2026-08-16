"use client";

// components/account/AccountView.tsx
// Client island for /account — the signed-in home. Renders the profile
// block + sign-out, then the address book and recent orders. Signed-out
// customers see the sign-in prompt with a deep link back to /account.
//
// `ready` comes from AuthContext's post-hydration restore pass: while false
// we render a quiet placeholder instead of flashing the signed-out prompt
// at returning customers.

import {useTranslations} from "next-intl";
import {useAuth} from "@/context/AuthContext";
import {SignInPrompt} from "@/components/account/SignInPrompt";
import {AddressBook} from "@/components/account/AddressBook";
import {OrdersList} from "@/components/account/OrdersList";

export function AccountView() {
  const t = useTranslations("Account");
  const {session, ready, signOut} = useAuth();

  if (!ready) {
    return (
      <p aria-busy="true" className="mt-10 text-sm italic text-text-muted">
        {t("loading")}
      </p>
    );
  }

  if (!session) {
    return (
      <div className="mt-10">
        <SignInPrompt next="/account" />
      </div>
    );
  }

  const {customer} = session;

  return (
    <div className="mt-10 space-y-14">
      {/* Profile */}
      <section
        aria-labelledby="account-profile-heading"
        className="rounded-2xl border border-border-card bg-bg-card p-6"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2
              id="account-profile-heading"
              className="text-[11px] font-medium uppercase tracking-[0.22em] text-gold"
            >
              {t("profileEyebrow")}
            </h2>
            <p
              data-testid="account-name"
              className="mt-3 font-display text-2xl text-text-heading"
            >
              {customer.name ?? t("noName")}
            </p>
            <p data-testid="account-phone" className="mt-1 text-sm text-text-secondary">
              {customer.phone}
            </p>
            {customer.email ? (
              <p className="mt-0.5 text-sm text-text-muted">{customer.email}</p>
            ) : null}
          </div>
          <button
            type="button"
            data-testid="sign-out"
            onClick={() => void signOut()}
            className="border border-border-input bg-bg-control px-4 py-2 text-[11px] font-medium uppercase tracking-[0.18em] text-text-secondary transition-colors hover:border-primary hover:text-primary"
          >
            {t("signOut")}
          </button>
        </div>
      </section>

      {/* Addresses */}
      <AddressBook />

      {/* Recent orders */}
      <OrdersList />
    </div>
  );
}

export default AccountView;
