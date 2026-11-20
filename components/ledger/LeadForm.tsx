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
import {track} from "@/lib/analytics";

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
  type,
  source,
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
      track("lead_submitted", {type, source: source ?? `${type}-form`});
    },
  });

  // react-dom v19 useActionState — runs in the form's action prop.
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
        className="ms-panel ms-panel--line ms-stack mt-10"
      >
        <p className="ms-label ms-muted">
          {t("thankYouEyebrow")}
        </p>
        <h2 className="ms-headline ms-maroon">
          {t("thankYouTitle")}
        </h2>
        <p className="ms-body">
          {t("thankYouBody")}
        </p>
        <p className="ms-caption ms-muted">
          {t("reference", {id: leadId})}
        </p>
      </aside>
    );
  }

  return (
    <form
      action={formAction}
      className="ms-lead-form"
    >
      {(eyebrow || title || intro) && (
        <header className="ms-head">
          {eyebrow && (
            <p className="ms-label">
              {eyebrow}
            </p>
          )}
          {title && (
            <h2 className="ms-headline">
              {title}
            </h2>
          )}
          {intro && (
            <p className="ms-lead">
              {intro}
            </p>
          )}
        </header>
      )}

      {children}

      {mutation.isError && (
        <p role="alert" className="ms-error">
          {t("errorGeneric")}
        </p>
      )}

      <button
        type="submit"
        disabled={mutation.isPending}
        className="ms-btn ms-btn-primary"
      >
        {mutation.isPending ? t("submitting") : (submitLabel ?? t("submit"))}
      </button>
    </form>
  );
}
