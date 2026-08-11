// components/ledger/LeadForm.tsx
// Generic lead capture form. Composed by WeddingConfigurator and
// CorporateConfigurator, which supply vertical-specific fields as children
// and a `type` literal ("wedding" | "corporate" | ...) plus a callback to
// assemble the payload JSON from the form's raw FormData.
//
// Flow:
//   1. Native form submit → useFormAction collects FormData.
//   2. buildPayload(FormData) → {@type LeadSubmission} shape for /api/leads.
//   3. TanStack useMutation POSTs. On success: Sonner toast + local
//      `submitted` state swaps the form for a thank-you panel. On error:
//      message written into an aria-live region.
//
// Editorial design — kept distinct from a stock 2-column "form with
// sidebar" template: single column inside a hairline-ruled card, eyebrow
// label, display-serif title, asymmetric 2-col grid for contact fields,
// full-width submit. No AI-slop purple gradients.

"use client";

import {useActionState} from "react";
import {useMutation} from "@tanstack/react-query";
import {toast} from "sonner";
import {useTranslations} from "next-intl";
import {type ReactNode, useState} from "react";

export type LeadContactField = "name" | "email" | "phone";

export type LeadSubmission = {
  type: string;
  contact: {
    name: string;
    email: string;
    phone?: string;
    company?: string;
    GSTIN?: string;
  };
  payload: Record<string, unknown>;
  source?: string;
};

type Props = {
  // Lead type literal — must match an option in collections/Leads.ts
  // (wedding / corporate / merch / gift-builder-draft / wholesale / general).
  type: string;
  // Source tag — defaults to "{type}-form" for analytics.
  source?: string;
  // Turn the raw FormData into the API body. The contact fields
  // (name/email/phone) are read here too so the configurator stays in
  // control of all field names.
  buildSubmission: (data: FormData) => LeadSubmission;
  // Optional eyebrow / hero rendered above the form fields.
  eyebrow?: string;
  title?: string;
  intro?: string;
  // Vertical-specific inputs (date, city, guests, GSTIN, ...).
  children?: ReactNode;
  // Submit button label override.
  submitLabel?: string;
};

async function postLead(body: LeadSubmission): Promise<{leadId: string; message: string}> {
  const res = await fetch("/api/leads", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Lead POST failed: ${res.status}`);
  }
  return (await res.json()) as {leadId: string; message: string};
}

export function LeadForm({
  buildSubmission,
  eyebrow,
  title,
  intro,
  children,
  submitLabel,
}: Props) {
  const t = useTranslations("Leads.common");
  const [leadId, setLeadId] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: postLead,
    onSuccess: (data) => {
      setLeadId(data.leadId);
      toast.success(t("toastSuccess"));
    },
  });

  // react-dom v19 useFormState — runs in the form's action prop.
  // We ignore the returned state (server-action style) and just kick off
  // the mutation. Errors land in mutation.error which we surface below.
  async function action(_prev: null, formData: FormData) {
    try {
      const submission = buildSubmission(formData);
      await mutation.mutateAsync(submission);
    } catch {
      // mutation.error carries the message; nothing to do here.
    }
    return null;
  }

  const [, formAction] = useActionState(action, null);

  if (leadId) {
    return (
      <aside
        aria-live="polite"
        className="mt-10 border-t border-border-card bg-bg-card/60 px-6 py-10 text-center"
      >
        <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-gold">
          {t("thankYouEyebrow")}
        </p>
        <h2 className="mt-3 font-display text-3xl font-light leading-tight text-text-heading sm:text-4xl">
          {t("thankYouTitle")}
        </h2>
        <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-text-muted">
          {t("thankYouBody")}
        </p>
        <p className="mt-6 text-xs text-text-muted">
          {t("reference", {id: leadId})}
        </p>
      </aside>
    );
  }

  return (
    <form
      action={formAction}
      className="mt-10 space-y-8 border-t border-border-card pt-10"
    >
      {(eyebrow || title || intro) && (
        <header className="space-y-3">
          {eyebrow && (
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-gold">
              {eyebrow}
            </p>
          )}
          {title && (
            <h2 className="font-display text-3xl font-light leading-tight text-text-heading sm:text-4xl">
              {title}
            </h2>
          )}
          {intro && (
            <p className="max-w-xl text-sm leading-relaxed text-text-muted">
              {intro}
            </p>
          )}
        </header>
      )}

      {children}

      {mutation.isError && (
        <p role="alert" className="text-sm text-primary">
          {t("errorGeneric")}
        </p>
      )}

      <button
        type="submit"
        disabled={mutation.isPending}
        className="inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3 text-sm font-semibold text-text-light shadow-md transition hover:bg-primary-hover hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
      >
        {mutation.isPending ? t("submitting") : (submitLabel ?? t("submit"))}
      </button>
    </form>
  );
}
