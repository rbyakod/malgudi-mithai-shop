// components/ledger/CorporateConfigurator.tsx
// Corporate / bulk-gifting lead form. Same LeadForm backbone as the
// wedding configurator; differs in the fieldset vocabulary — company
// profile, GSTIN, quantity, deadline, branding requirements — because
// the buyer here is HR/admin/marketing, not a couple planning a wedding.

"use client";

import {LeadForm, type LeadSubmission} from "@/components/ledger/LeadForm";
import {FieldGroup, TextField, TextAreaField} from "@/components/ledger/LeadField";
import {useTranslations} from "next-intl";

export function CorporateConfigurator() {
  const t = useTranslations("Leads.corporate");

  function buildSubmission(data: FormData): LeadSubmission {
    const get = (k: string) => (data.get(k) as string | null) ?? "";
    return {
      type: "corporate",
      source: "corporate-form",
      contact: {
        name: get("name"),
        email: get("email"),
        phone: get("phone") || undefined,
        company: get("company") || undefined,
        GSTIN: get("gst") || undefined,
      },
      payload: {
        quantity: get("quantity") ? Number(get("quantity")) : undefined,
        deadline: get("deadline") || undefined,
        branding: get("branding") || undefined,
        occasion: get("occasion") || undefined,
        message: get("message") || undefined,
      },
    };
  }

  return (
    <LeadForm
      type="corporate"
      source="/corporate"
      buildSubmission={buildSubmission}
      eyebrow={t("eyebrow")}
      title={t("formTitle")}
      intro={t("formIntro")}
      submitLabel={t("submit")}
    >
      <FieldGroup numeral="I" label={t("groupContact")}>
        <TextField name="name" label={t("name")} required autoComplete="name" />
        <TextField
          name="email"
          label={t("email")}
          type="email"
          required
          autoComplete="email"
        />
        <TextField
          name="phone"
          label={t("phone")}
          type="tel"
          required
          autoComplete="tel"
          placeholder="+91…"
          pattern="[+0-9][0-9 ]{6,18}"
        />
      </FieldGroup>

      <FieldGroup numeral="II" label={t("groupCompany")}>
        <TextField name="company" label={t("company")} autoComplete="organization" />
        <TextField
          name="gst"
          label={t("gst")}
          placeholder="29ABCDE1234F1Z5"
          pattern="[0-9A-Z]{15}"
        />
      </FieldGroup>

      <FieldGroup numeral="III" label={t("groupOrder")} hint={t("orderHint")}>
        <TextField name="quantity" label={t("quantity")} type="number" min={1} />
        <TextField name="deadline" label={t("deadline")} type="date" />
        <TextField name="occasion" label={t("occasion")} placeholder="Diwali / new hire / launch" />
        <TextField name="branding" label={t("branding")} placeholder="Logo sticker / custom box" />
        <TextAreaField name="message" label={t("message")} rows={4} />
      </FieldGroup>
    </LeadForm>
  );
}
