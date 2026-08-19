// components/ledger/MerchEnquiry.tsx
// Merch PDP enquiry form (#124). Replaces the "Enquiries open soon"
// stub: both availability states funnel into this form, which posts to
// the same public POST /api/leads the wedding/corporate/gift forms use.
// Product identity rides in `payload` so ops can see which piece the
// enquiry is about without parsing the free-text message.

"use client";

import {useTranslations} from "next-intl";
import {LeadForm, type LeadSubmission} from "@/components/ledger/LeadForm";
import {FieldGroup, TextField, TextAreaField} from "@/components/ledger/LeadField";

type Props = {
  productId: string;
  productName: string;
  price?: string;
};

export function MerchEnquiry({productId, productName, price}: Props) {
  const t = useTranslations("Leads.merch");

  function buildSubmission(data: FormData): LeadSubmission {
    const get = (key: string) => (data.get(key) as string | null) ?? "";
    const quantity = Number.parseInt(get("quantity"), 10);
    return {
      type: "merch",
      source: "merch-pdp",
      contact: {
        name: get("name"),
        email: get("email"),
        phone: get("phone") || undefined,
      },
      payload: {
        product: productName,
        productId,
        ...(price ? {price} : {}),
        ...(Number.isFinite(quantity) ? {quantity} : {}),
        ...(get("message") ? {message: get("message")} : {}),
      },
    };
  }

  return (
    <LeadForm
      type="merch"
      source="merch-pdp"
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
          autoComplete="tel"
          placeholder="+91 "
        />
      </FieldGroup>
      <FieldGroup numeral="II" label={t("groupOrder")} hint={t("quantityHint")}>
        <TextField name="quantity" label={t("quantity")} type="number" min={1} />
        <TextAreaField name="message" label={t("message")} rows={4} />
      </FieldGroup>
    </LeadForm>
  );
}
