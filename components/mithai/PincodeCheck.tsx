"use client";

// components/mithai/PincodeCheck.tsx
// Delivery-pincode checker for the mithai PDP buy module — the web face of
// the serviceability API the mobile apps already use
// (GET /api/mobile/v1/catalog/serviceable?pincode=NNNNNN → {data} envelope).
//
// Checks are one-shot: the last result is persisted to localStorage
// ("mithran-pincode-v1") and restored on the next PDP visit without
// refetching — the SLA data is static, so repeat API calls would be noise.
// Restored post-hydration only (same pattern as CartContext) to keep SSR
// and first client render identical.

import {useEffect, useRef, useState} from "react";
import {useTranslations} from "next-intl";
import {checkServiceability, PINCODE_RE} from "@/lib/web/serviceability";

const STORAGE_KEY = "mithran-pincode-v1";

type SavedResult = {
  pincode: string;
  tier: "fresh" | "shelf";
  city: string;
  slaDays: number;
};

type State =
  | {kind: "idle"}
  | {kind: "checking"}
  | {kind: "ok"; result: SavedResult}
  | {kind: "notServiceable"; pincode: string}
  | {kind: "invalid"}
  | {kind: "error"};

export function PincodeCheck() {
  const t = useTranslations("Pdp.mithai.pincode");
  const [pincode, setPincode] = useState("");
  const [state, setState] = useState<State>({kind: "idle"});
  const abortRef = useRef<AbortController | null>(null);

  // Restore the last checked pincode after hydration (no refetch — static SLA).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as SavedResult;
      if (parsed && PINCODE_RE.test(parsed.pincode) && parsed.city) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot restore of persisted state, same pattern as CartContext
        setPincode(parsed.pincode);
        setState({kind: "ok", result: parsed});
      }
    } catch {
      // ignore malformed storage
    }
  }, []);

  async function check() {
    abortRef.current?.abort();
    if (!PINCODE_RE.test(pincode)) {
      setState({kind: "invalid"});
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setState({kind: "checking"});
    // The fetch + response interpretation lives in lib/web/serviceability —
    // shared with the account address book and checkout.
    try {
      const result = await checkServiceability(pincode, controller.signal);
      if (result.kind === "ok") {
        const saved = {
          pincode: result.pincode,
          tier: result.tier,
          city: result.city,
          slaDays: result.slaDays,
        };
        try {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
        } catch {
          // ignore quota errors
        }
        setState({kind: "ok", result: saved});
      } else if (result.kind === "notServiceable") {
        setState({kind: "notServiceable", pincode});
      } else if (result.kind === "invalid") {
        setState({kind: "invalid"});
      } else {
        setState({kind: "error"});
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setState({kind: "error"});
    }
  }

  const resultAnnouncement =
    state.kind === "ok"
      ? t("deliverTo", {
          pincode: state.result.pincode,
          city: state.result.city,
          tier: t(state.result.tier === "fresh" ? "tierFresh" : "tierShelf"),
          days: String(state.result.slaDays),
        })
      : state.kind === "notServiceable"
        ? t("notServiceable", {pincode: state.pincode})
        : state.kind === "invalid"
          ? t("invalid")
          : state.kind === "error"
            ? t("errorRetry")
            : "";

  return (
    <div className="ms-stack ms-stack--tight">
      <p className="ms-field-label">{t("label")}</p>

      {state.kind === "ok" || state.kind === "notServiceable" ? (
        <div className="ms-row ms-row--between">
          <p
            data-testid="pincode-result"
            aria-live="polite"
            className={
              state.kind === "ok"
                ? "ms-body"
                : "ms-body ms-muted"
            }
          >
            {resultAnnouncement}
          </p>
          <button
            type="button"
            onClick={() => setState({kind: "idle"})}
            className="ms-btn ms-btn-secondary"
          >
            {t("change")}
          </button>
        </div>
      ) : (
        <div className="ms-stack ms-stack--tight">
          <div className="ms-row ms-row--tight">
            <input
              data-testid="pincode-input"
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={pincode}
              onChange={(e) => {
                setPincode(e.target.value.replace(/\D/g, ""));
                if (state.kind !== "idle") setState({kind: "idle"});
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") check();
              }}
              aria-label={t("label")}
              placeholder={t("placeholder")}
              className="ms-input ms-input--pincode"
            />
            <button
              type="button"
              data-testid="pincode-check-button"
              onClick={check}
              disabled={state.kind === "checking"}
              className="ms-btn ms-btn-secondary"
            >
              {state.kind === "checking" ? t("checking") : t("check")}
            </button>
          </div>
          <p aria-live="polite" className="ms-hint">
            {state.kind === "invalid" || state.kind === "error"
              ? resultAnnouncement
              : t("fallbackPromise")}
          </p>
        </div>
      )}
    </div>
  );
}

export default PincodeCheck;
