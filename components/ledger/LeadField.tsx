// components/ledger/LeadField.tsx
// Presentational primitives for the lead forms. Shared so the wedding
// and corporate configurators stay visually consistent and the E2E
// `getByLabel(/name/i)` selectors always hit a real <label>/<input> pair.
//
// Fieldset style is editorial — hairline divider above each group, label
// set in caps tracking, asymmetric grid on sm+.

"use client";

import {type ReactNode} from "react";

// Group wrapper that introduces a numbered section divider above a cluster
// of fields. Avoids the stock "card-stack of identical inputs" look.
export function FieldGroup({
  numeral,
  label,
  hint,
  children,
}: {
  numeral: string;
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="border-t border-border-card pt-6">
      <legend className="flex w-full items-baseline gap-3">
        <span className="font-display text-xl font-light text-gold">
          {numeral}
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-text-secondary">
          {label}
        </span>
        {hint && (
          <span className="ml-auto text-[11px] italic text-text-muted">
            {hint}
          </span>
        )}
      </legend>
      <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
        {children}
      </div>
    </fieldset>
  );
}

// Single label + input pair. The label wraps the input so screen readers
// associate them and Playwright's `getByLabel` finds them.
export function TextField({
  name,
  label,
  type = "text",
  required = false,
  autoComplete,
  placeholder,
  pattern,
  min,
}: {
  name: string;
  label: string;
  type?: "text" | "email" | "tel" | "date" | "number";
  required?: boolean;
  autoComplete?: string;
  placeholder?: string;
  pattern?: string;
  min?: number | string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.16em] text-text-secondary">
        {label}
        {required && <span className="ml-0.5 text-primary">*</span>}
      </span>
      <input
        name={name}
        type={type}
        required={required}
        autoComplete={autoComplete}
        placeholder={placeholder}
        pattern={pattern}
        min={min}
        className="w-full rounded-xl border border-border-input bg-bg-control px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-breadcrumb/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
      />
    </label>
  );
}

// Full-width textarea for free-form notes.
export function TextAreaField({
  name,
  label,
  required = false,
  rows = 4,
}: {
  name: string;
  label: string;
  required?: boolean;
  rows?: number;
}) {
  return (
    <label className="block sm:col-span-2">
      <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.16em] text-text-secondary">
        {label}
        {required && <span className="ml-0.5 text-primary">*</span>}
      </span>
      <textarea
        name={name}
        required={required}
        rows={rows}
        className="w-full resize-y rounded-xl border border-border-input bg-bg-control px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-breadcrumb/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
      />
    </label>
  );
}
