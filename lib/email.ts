// lib/email.ts
// Resend wrapper for transactional email. In dev (no RESEND_API_KEY) calls
// become no-ops with a warning, so local flows don't depend on a verified
// Resend domain or network access. In prod, errors from Resend (e.g. unverified
// sender domain) are logged but DO NOT bubble — the caller (lead creation,
// draft conversion, etc.) has already succeeded and the user should not be
// penalized for a notification failure.
//
// Body shape: currently a JSON dump of the lead record. When the body grows
// beyond that (HTML template, branding, CTA links), extract to
// `lib/email/templates.ts` — deferred for now (YAGNI).
import { Resend } from "resend";

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
