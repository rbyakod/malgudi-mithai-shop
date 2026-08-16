// lib/email.ts
// Resend wrapper for transactional email. In dev (no RESEND_API_KEY) calls
// become no-ops with a warning, so local flows don't depend on a verified
// Resend domain or network access. In prod, errors from Resend (e.g. unverified
// sender domain) are logged but DO NOT bubble — the caller (lead creation,
// draft conversion, etc.) has already succeeded and the user should not be
// penalized for a notification failure.
//
// Body shape: lead notifications remain a JSON dump (ops-facing). The
// customer-facing abandoned-cart reminder moved to lib/email/templates.ts
// (inline-styled brand HTML) — conversion batch, Batch A.
import { Resend } from "resend";
import {
  abandonedCartEmailHtml,
  type AbandonedCartDraft,
} from "./email/templates";

/** Shape of a Lead record passed to sendLeadNotification. */
export interface LeadPayload {
  id?: string | number;
  type: string;
  contact: {
    name: string;
    email: string;
    phone?: string;
    company?: string;
    GSTIN?: string;
  };
  payload?: unknown;
  status?: string;
  source?: string;
  [key: string]: unknown;
}

const apiKey = process.env.RESEND_API_KEY;
export const resend = apiKey ? new Resend(apiKey) : null;

/**
 * Send a lead notification to ops. No-op if RESEND_API_KEY is unset.
 * Errors are logged but never thrown — notifications are best-effort.
 */
export async function sendLeadNotification(
  to: string,
  lead: LeadPayload,
): Promise<void> {
  if (!resend) {
    if (process.env.NODE_ENV !== "test") {
      console.warn("[email] RESEND_API_KEY missing; skipping send.");
    }
    return;
  }

  const { error } = await resend.emails.send({
    from: "Mishran Leads <leads@mishran.shop>",
    to,
    subject: `New ${lead.type} lead — ${lead.contact.name}`,
    html: `<pre>${JSON.stringify(lead, null, 2)}</pre>`,
  });

  if (error) {
    // Log and continue. Common cause in prod: sender domain not verified.
    console.error("[email] Resend send failed:", error);
  }
}

/**
 * Send the abandoned-cart reminder to the shopper. Same contract as
 * sendLeadNotification: no-op (with a warning) when RESEND_API_KEY is
 * unset, never throws. Returns true when a send was attempted, false when
 * skipped — the cron only stamps reminderSentAt on true, so a box without
 * the key never burns a draft's one-and-only reminder.
 */
export async function sendAbandonedCartReminder(
  to: string,
  draft: AbandonedCartDraft,
  productNames: string[],
): Promise<boolean> {
  if (!resend) {
    if (process.env.NODE_ENV !== "test") {
      console.warn("[email] RESEND_API_KEY missing; skipping send.");
    }
    return false;
  }

  const { error } = await resend.emails.send({
    from: "Mishran <hello@mishran.shop>",
    to,
    subject: "Your Mishran cart is still waiting",
    html: abandonedCartEmailHtml(draft, productNames),
  });

  if (error) {
    // Log and continue — recovery is best-effort; the cron still marks the
    // draft as reminded so a provider outage does not spam retries.
    console.error("[email] Resend send failed:", error);
    return true;
  }
  return true;
}
