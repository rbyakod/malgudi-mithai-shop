// components/ledger/WeddingConfigurator.tsx
// Wedding / bulk-gifting lead form. Composes LeadForm with the fields a
// couple (or their planner) actually needs to share: event date, city,
// guest count, mithai preferences, packaging vibe, plus a notes box.
//
// The fields are arranged as three numbered fieldsets so the page reads
// top-to-bottom like a planner's intake sheet rather than a flat
// register form.

"use client";

import {LeadForm, type LeadSubmission} from "@/components/ledger/LeadForm";
import {FieldGroup, TextField, TextAreaField} from "@/components/ledger/LeadField";
import {useTranslations} from "next-intl";

export function WeddingConfigurator() {
  const t = useTranslations("Leads.weddings");

  function buildSubmission(data: FormData): LeadSubmission {
    const get = (k: string) => (data.get(k) as string | null) ?? "";
    return {
      type: "wedding",
      source: "wedding-form",
      contact: {
        name: get("name"),
        email: get("email"),
        phone: get("phone") || undefined,
      },
      payload: {
        eventDate: get("eventDate") || undefined,
        city: get("city") || undefined,
        guests: get("guests") ? Number(get("guests")) : undefined,
        budget: get("budget") || undefined,
        mithaiPreferences: get("mithaiPreferences") || undefined,
        packaging: get("packaging") || undefined,
        message: get("message") || undefined,
      },
    };
  }

  return (
    <LeadForm
      type="wedding"
      source="/weddings"
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

      <FieldGroup numeral="II" label={t("groupEvent")}>
        <TextField name="eventDate" label={t("date")} type="date" />
        <TextField name="city" label={t("city")} autoComplete="address-level2" />
        <TextField name="guests" label={t("guests")} type="number" min={1} />
        <TextField name="budget" label={t("budget")} placeholder="₹ / head or total" />
      </FieldGroup>

      <FieldGroup numeral="III" label={t("groupPreferences")} hint={t("preferencesHint")}>
        <TextField name="mithaiPreferences" label={t("mithaiPreferences")} placeholder="Kaju katli, motichoor laddoo…" />
        <TextField name="packaging" label={t("packaging")} placeholder="Gift boxes / trays / bulk" />
        <TextAreaField name="message" label={t("message")} rows={4} />
      </FieldGroup>
    </LeadForm>
  );
}
