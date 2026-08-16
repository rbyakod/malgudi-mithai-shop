"use client";

// components/auth/SignInForm.tsx
// Phone (E.164) → OTP two-step sign-in, the web counterpart of the apps'
// auth screens. Talks to the same /auth/otp endpoints through the shared
// apiClient (X-Client-Source: web). On success the session is written to
// AuthContext (which persists it) and the customer is routed to `next`
// (deep-link support, e.g. /sign-in?next=/checkout) or /account.
//
// Error codes map to translated copy: OTP_INVALID / OTP_EXPIRED /
// RATE_LIMITED / OTP_PROVIDER_DOWN / VALIDATION (field errors) with a
// generic fallback. Resend is throttled by a 30-second countdown that
// restarts on every successful send (the server also rate-limits per phone:
// 5/hour, 10/day).

import {useEffect, useRef, useState} from "react";
import {useTranslations} from "next-intl";
import {useRouter} from "@/i18n/navigation";
import {apiFetch, ApiClientError} from "@/lib/web/apiClient";
import {useAuth, type AuthSession} from "@/context/AuthContext";

const PHONE_RE = /^\+[1-9]\d{6,14}$/;
const CODE_RE = /^[0-9]{6}$/;
const RESEND_SECONDS = 30;

type Step = "phone" | "code";

type SendResponse = {requestId: string; expiresAt: string};

// Only same-app paths may be used as the post-sign-in redirect — never an
// absolute/protocol-relative URL.
function safeNext(raw: string | null): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  return raw;
}

export function SignInForm() {
  const t = useTranslations("SignIn");
  const router = useRouter();
  const {signIn} = useAuth();

  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("+91");
  const [code, setCode] = useState("");
  const [requestId, setRequestId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const codeInputRef = useRef<HTMLInputElement>(null);

  // Resend countdown — one timeout per tick (re-arms each second while > 0).
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = window.setTimeout(() => {
      setCountdown((c) => Math.max(0, c - 1));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [countdown]);

  // Focus the OTP field when the second step opens.
  useEffect(() => {
    if (step === "code") codeInputRef.current?.focus();
  }, [step]);

  function messageForError(err: unknown): string {
    if (err instanceof ApiClientError) {
      switch (err.code) {
        case "OTP_INVALID":
          return t("errors.otpInvalid");
        case "OTP_EXPIRED":
          return t("errors.otpExpired");
        case "RATE_LIMITED":
          return t("errors.rateLimited");
        case "OTP_PROVIDER_DOWN":
          return t("errors.providerDown");
        case "VALIDATION":
          return err.fieldErrors?.phone ?? err.fieldErrors?.code ?? t("errors.invalidPhone");
        default:
          return t("errors.generic");
      }
    }
    return t("errors.generic");
  }

  async function sendOtp() {
    const trimmed = phone.trim();
    if (!PHONE_RE.test(trimmed)) {
      setError(t("errors.invalidPhone"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const data = await apiFetch<SendResponse>("/auth/otp/send", {
        method: "POST",
        body: {phone: trimmed},
      });
      setRequestId(data.requestId);
      setCode("");
      setStep("code");
      setCountdown(RESEND_SECONDS);
    } catch (err) {
      setError(messageForError(err));
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp() {
    if (!requestId || !CODE_RE.test(code)) {
      setError(t("errors.invalidCode"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const session = await apiFetch<AuthSession>("/auth/otp/verify", {
        method: "POST",
        body: {requestId, code},
      });
      signIn(session);
      const params = new URLSearchParams(window.location.search);
      const next = safeNext(params.get("next"));
      router.replace(next ?? "/account");
    } catch (err) {
      setError(messageForError(err));
    } finally {
      setBusy(false);
    }
  }

  async function changePhone() {
    setStep("phone");
    setCode("");
    setRequestId(null);
    setError(null);
    setCountdown(0);
  }

  return (
    <div className="rounded-2xl border border-border-card bg-bg-card p-6 sm:p-8">
      {step === "phone" ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void sendOtp();
          }}
          noValidate
        >
          <label
            htmlFor="sign-in-phone"
            className="text-[10px] font-medium uppercase tracking-[0.22em] text-primary/80"
          >
            {t("phoneLabel")}
          </label>
          <input
            id="sign-in-phone"
            data-testid="sign-in-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              if (error) setError(null);
            }}
            aria-invalid={error ? "true" : "false"}
            aria-describedby={error ? "sign-in-error" : "sign-in-phone-hint"}
            placeholder="+919876543210"
            className="mt-3 w-full border-b border-gold/60 bg-transparent px-1 py-2 font-display text-lg text-text-heading placeholder:text-text-muted/60 focus:border-gold focus:outline-none"
          />
          <p
            id="sign-in-phone-hint"
            className="mt-2 text-xs leading-relaxed text-text-muted"
          >
            {t("phoneHint")}
          </p>
          <button
            type="submit"
            data-testid="sign-in-submit"
            disabled={busy}
            className="mt-6 inline-flex w-full items-center justify-center border-y border-gold/60 bg-bg-control px-6 py-3 font-display text-sm font-medium uppercase tracking-[0.18em] text-primary transition-colors hover:bg-bg-accent disabled:opacity-70"
          >
            {busy ? t("sending") : t("sendCode")}
          </button>
        </form>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void verifyOtp();
          }}
          noValidate
        >
          <label
            htmlFor="sign-in-code"
            className="text-[10px] font-medium uppercase tracking-[0.22em] text-primary/80"
          >
            {t("codeLabel")}
          </label>
          <p className="mt-2 text-sm leading-relaxed text-text-muted">
            {t("codeSentTo", {phone})}{" "}
            <button
              type="button"
              onClick={() => void changePhone()}
              className="text-primary underline-offset-4 hover:underline"
            >
              {t("changePhone")}
            </button>
          </p>
          <input
            id="sign-in-code"
            ref={codeInputRef}
            data-testid="sign-in-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => {
              setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
              if (error) setError(null);
            }}
            aria-invalid={error ? "true" : "false"}
            aria-describedby="sign-in-error"
            placeholder="––––––"
            className="mt-4 w-full border-b border-gold/60 bg-transparent px-1 py-2 text-center font-display text-2xl tracking-[0.4em] text-text-heading placeholder:text-text-muted/60 focus:border-gold focus:outline-none"
          />
          <button
            type="submit"
            data-testid="sign-in-verify"
            disabled={busy || code.length !== 6}
            className="mt-6 inline-flex w-full items-center justify-center border-y border-gold/60 bg-bg-control px-6 py-3 font-display text-sm font-medium uppercase tracking-[0.18em] text-primary transition-colors hover:bg-bg-accent disabled:opacity-70"
          >
            {busy ? t("verifying") : t("verify")}
          </button>
          <div className="mt-4 text-center">
            <button
              type="button"
              data-testid="sign-in-resend"
              onClick={() => void sendOtp()}
              disabled={busy || countdown > 0}
              className="text-[11px] font-medium uppercase tracking-[0.18em] text-primary underline-offset-4 hover:underline disabled:opacity-60"
            >
              {countdown > 0 ? t("resendIn", {seconds: String(countdown)}) : t("resend")}
            </button>
          </div>
        </form>
      )}

      {error ? (
        <p
          id="sign-in-error"
          data-testid="sign-in-error"
          aria-live="polite"
          className="mt-4 text-sm italic leading-relaxed text-text-muted"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

export default SignInForm;
