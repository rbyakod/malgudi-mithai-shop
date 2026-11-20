// components/ledger/LeadField.tsx
// Presentational primitives for the lead forms. Shared so the wedding
// and corporate configurators stay visually consistent and the E2E
// `getByLabel(/name/i)` selectors always hit a real <label>/<input> pair.
//
// Styled as the Mishran Design System's Field: Mono capital labels above a
// square, nutmeg-ruled input at 18px; each group a numbered step under a hairline.

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
    <fieldset className="ms-lead-group">
      <legend className="ms-lead-legend">
        <span className="ms-step-n">{numeral}</span>
        <span className="ms-label">{label}</span>
        {hint && <span className="ms-hint">{hint}</span>}
      </legend>
      <div className="ms-form-grid">{children}</div>
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
    <label className="ms-fieldset">
      <span className="ms-field-label">
        {label}
        {required && <span className="ms-maroon" aria-hidden="true"> *</span>}
      </span>
      <input
        name={name}
        type={type}
        required={required}
        autoComplete={autoComplete}
        placeholder={placeholder}
        pattern={pattern}
        min={min}
        className="ms-input"
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
    <label className="ms-fieldset ms-field-wide">
      <span className="ms-field-label">
        {label}
        {required && <span className="ms-maroon" aria-hidden="true"> *</span>}
      </span>
      <textarea
        name={name}
        required={required}
        rows={rows}
        className="ms-input ms-textarea"
      />
    </label>
  );
}
