"use client";

import {FormEvent, useMemo, useState} from "react";
import {track} from "@/lib/analytics";
import {toWaDigits} from "@/lib/whatsapp";

type Props = {
  whatsapp: string;
};

type SubmitState =
  | {kind: "idle"}
  | {kind: "submitting"}
  | {kind: "success"; leadId: string}
  | {kind: "error"; message: string};

const OCCASIONS = ["Diwali", "Wedding", "Corporate", "Birthday", "Housewarming", "Other"];
const BOX_SIZES = ["4-piece", "8-piece", "16-piece", "Custom"];
const BUDGETS = ["Under ₹1,000", "₹1,000-₹2,500", "₹2,500-₹5,000", "₹5,000+"];

export function GiftBuilder({whatsapp}: Props) {
  const [state, setState] = useState<SubmitState>({kind: "idle"});
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    occasion: OCCASIONS[0],
    boxSize: BOX_SIZES[1],
    budget: BUDGETS[1],
    city: "",
    date: "",
    dietary: "",
    message: "",
  });

  const waHref = useMemo(() => {
    const digits = toWaDigits(whatsapp);
    if (!digits) return "#";
    const text = [
      "Hi Mishran, I would like a gift box quote.",
      `Occasion: ${form.occasion}`,
      `Box: ${form.boxSize}`,
      `Budget: ${form.budget}`,
      form.city ? `City: ${form.city}` : "",
      form.date ? `Date: ${form.date}` : "",
      form.dietary ? `Dietary: ${form.dietary}` : "",
      form.message ? `Message: ${form.message}` : "",
    ].filter(Boolean).join("\n");
    return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
  }, [form, whatsapp]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({kind: "submitting"});
    track("gift_builder_started", {occasion: form.occasion, boxSize: form.boxSize});
    const response = await fetch("/api/leads", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({
        type: "gift-builder-draft",
        contact: {
          name: form.name,
          email: form.email,
          phone: form.phone,
        },
        payload: {
          occasion: form.occasion,
          boxSize: form.boxSize,
          budget: form.budget,
          city: form.city,
          date: form.date,
          dietary: form.dietary,
          message: form.message,
        },
        source: "build-a-gift",
      }),
    });
    if (!response.ok) {
      setState({kind: "error", message: "Could not submit. Try WhatsApp instead."});
      return;
    }
    const data = (await response.json()) as {leadId?: string};
    track("gift_builder_completed", {leadId: data.leadId ?? "unknown"});
    setState({kind: "success", leadId: data.leadId ?? ""});
  }

  const set = (key: keyof typeof form, value: string) =>
    setForm((current) => ({...current, [key]: value}));

  return (
    <section className="mx-auto w-full max-w-5xl px-4 pb-20 pt-10 sm:px-6 sm:pt-14 lg:px-8">
      <header className="grid gap-6 border-b border-border-card pb-10 lg:grid-cols-[0.45fr_0.55fr] lg:items-end">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-gold">
            Mishran gifts
          </p>
          <h1 className="mt-3 font-display text-4xl font-light leading-tight tracking-tight text-text-heading sm:text-5xl">
            Build a gift
          </h1>
        </div>
        <p className="max-w-md text-sm leading-relaxed text-text-muted">
          Choose the occasion, box, budget, and delivery details. We will confirm the assortment and quote before packing.
        </p>
      </header>

      <div className="mt-10 grid gap-8 lg:grid-cols-[0.38fr_0.62fr]">
        <aside className="space-y-4">
          {[
            ["Fast quote", "We respond with options before the box is packed."],
            ["Dietary aware", "Mark nut-free, sugar-free, Jain, or custom notes."],
            ["Message card", "Add a short note and we will include it with the gift."],
          ].map(([title, body]) => (
            <div key={title} className="rounded-2xl border border-border-card bg-bg-card p-5">
              <h2 className="text-sm font-semibold text-text-heading">{title}</h2>
              <p className="mt-2 text-xs leading-relaxed text-text-muted">{body}</p>
            </div>
          ))}
        </aside>

        <form onSubmit={submit} className="grid gap-4 rounded-2xl border border-border-card bg-bg-card p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" value={form.name} onChange={(v) => set("name", v)} required />
            <Field label="Email" type="email" value={form.email} onChange={(v) => set("email", v)} required />
            <Field label="Phone" value={form.phone} onChange={(v) => set("phone", v)} />
            <Field label="Delivery city" value={form.city} onChange={(v) => set("city", v)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Select label="Occasion" value={form.occasion} options={OCCASIONS} onChange={(v) => set("occasion", v)} />
            <Select label="Box size" value={form.boxSize} options={BOX_SIZES} onChange={(v) => set("boxSize", v)} />
            <Select label="Budget" value={form.budget} options={BUDGETS} onChange={(v) => set("budget", v)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Needed by" type="date" value={form.date} onChange={(v) => set("date", v)} />
            <Field label="Dietary notes" value={form.dietary} onChange={(v) => set("dietary", v)} />
          </div>
          <label className="grid gap-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-text-muted">
            Message card
            <textarea
              value={form.message}
              onChange={(event) => set("message", event.target.value)}
              rows={4}
              className="rounded-2xl border border-border-input bg-bg-control px-4 py-3 text-sm font-normal normal-case tracking-normal text-text-heading outline-none transition-colors placeholder:text-text-muted focus:border-primary"
            />
          </label>
          {state.kind === "error" ? (
            <p className="rounded-2xl border border-border-card bg-bg-accent p-4 text-sm text-text-heading">
              {state.message}
            </p>
          ) : null}
          {state.kind === "success" ? (
            <p className="rounded-2xl border border-border-card bg-bg-accent p-4 text-sm text-text-heading">
              Quote request received. Reference {state.leadId}.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={state.kind === "submitting"}
              className="rounded-full bg-primary px-5 py-3 text-sm font-semibold text-text-light transition-colors hover:bg-primary-hover disabled:opacity-60"
            >
              {state.kind === "submitting" ? "Sending..." : "Request quote"}
            </button>
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => track("whatsapp_clicked", {source: "gift-builder"})}
              className="rounded-full border border-border-input px-5 py-3 text-sm font-semibold text-text-secondary transition-colors hover:border-primary hover:text-primary"
            >
              Quote on WhatsApp
            </a>
          </div>
        </form>
      </div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="grid gap-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-text-muted">
      {label}
      <input
        type={type}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 rounded-full border border-border-input bg-bg-control px-4 text-sm font-normal normal-case tracking-normal text-text-heading outline-none transition-colors placeholder:text-text-muted focus:border-primary"
      />
    </label>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-text-muted">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 rounded-full border border-border-input bg-bg-control px-4 text-sm font-normal normal-case tracking-normal text-text-heading outline-none transition-colors focus:border-primary"
      >
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

export default GiftBuilder;
