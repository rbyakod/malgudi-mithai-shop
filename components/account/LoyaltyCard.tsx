"use client";

// components/account/LoyaltyCard.tsx
// Loyalty state island at the top of /account (retention batch): a quiet
// Silver/Gold chip once earned, otherwise the progress line ("N delivered ·
// M more for Silver") + one-line benefits copy. Deliberately NO wallet-pass
// UI on web (iOS-only for now).
//
// GET /account/loyalty → {deliveredCount, tier, silverAtDelivered,
// goldAtDelivered} through the same apiFetch the other account islands
// use. Hides itself entirely on 401/404/anything unexpected — the account
// page must not degrade because loyalty state isn't reachable.

import {useEffect, useState} from "react";
import {useTranslations} from "next-intl";
import {apiFetch} from "@/lib/web/apiClient";
import {useAuth} from "@/context/AuthContext";

type LoyaltyState = {
  deliveredCount: number;
  tier: "silver" | "gold" | null;
  silverAtDelivered: number;
  goldAtDelivered: number;
};

export function LoyaltyCard() {
  const t = useTranslations("Account.loyalty");
  const {session, ready} = useAuth();
  const [state, setState] = useState<LoyaltyState | null>(null);

  useEffect(() => {
    if (!ready || !session) return;
    let cancelled = false;
    void apiFetch<LoyaltyState>("/account/loyalty")
      .then((data) => {
        if (
          !cancelled &&
          data &&
          typeof data.deliveredCount === "number" &&
          typeof data.silverAtDelivered === "number" &&
          typeof data.goldAtDelivered === "number"
        ) {
          setState(data);
        }
      })
      .catch(() => {
        // 401/404 → the card simply never appears; other errors equally
        // quiet (loyalty is a bonus, never a blocker).
      });
    return () => {
      cancelled = true;
    };
  }, [ready, session]);

  if (!state) return null;

  const {deliveredCount, tier, silverAtDelivered, goldAtDelivered} = state;
  const moreToSilver = Math.max(0, silverAtDelivered - deliveredCount);

  return (
    <section
      data-testid="loyalty-card"
      aria-labelledby="loyalty-heading"
      className="rounded-2xl border border-border-card bg-bg-card p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2
            id="loyalty-heading"
            className="text-[11px] font-medium uppercase tracking-[0.22em] text-gold"
          >
            {t("eyebrow")}
          </h2>
          {tier ? (
            <p
              data-testid="loyalty-tier"
              className="mt-3 inline-block border border-gold/50 bg-gold/10 px-4 py-1.5 font-display text-lg text-gold"
            >
              {tier === "gold" ? t("tierGold") : t("tierSilver")}
            </p>
          ) : (
            <p
              data-testid="loyalty-progress"
              className="mt-3 font-display text-2xl text-text-heading"
            >
              {t("progress", {
                delivered: String(deliveredCount),
                more: String(moreToSilver),
              })}
            </p>
          )}
          <p className="mt-2 max-w-md text-xs leading-relaxed text-text-muted">
            {tier === "gold"
              ? t("benefitGold")
              : tier === "silver"
                ? t("benefitSilver")
                : t("benefitNone", {gold: String(goldAtDelivered)})}
          </p>
        </div>
        <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-text-muted">
          {t("deliveredLabel", {count: String(deliveredCount)})}
        </p>
      </div>
    </section>
  );
}

export default LoyaltyCard;
