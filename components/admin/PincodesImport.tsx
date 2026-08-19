"use client";
// components/admin/PincodesImport.tsx
// Delivery-area CSV import — admin roadmap Wave 2 (#129). Mounted at
// /staff/pincodes (avoids Payload's /admin catch-all).
//
// Ops pastes or uploads a CSV of serviceable pincodes; "Validate" runs a
// dry-run through /api/staff/pincodes/import (parse + existence check, no
// writes) and "Import" performs the upsert-by-pincode. The header pattern
// matches the other staff consoles (orders board, payment reconciliation).
import { useRef, useState } from "react";
import Link from "next/link";

interface ImportResult {
  dryRun: boolean;
  rows: number;
  created: number;
  updated: number;
  duplicates: number;
  errors: { line: number; message: string }[];
}

export function PincodesImport() {
  const [csv, setCsv] = useState("");
  const [busy, setBusy] = useState<"validate" | "import" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function run(dryRun: boolean) {
    if (!csv.trim() || busy) return;
    setBusy(dryRun ? "validate" : "import");
    setError(null);
    try {
      const res = await fetch("/api/staff/pincodes/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ csv, dryRun }),
      });
      if (res.status === 401) {
        setError(
          "Staff sign-in required. Sign in at the admin panel and reload this page.",
        );
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message ?? `import failed: ${res.status}`);
      }
      setResult((await res.json()).data as ImportResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "import failed");
    } finally {
      setBusy(null);
    }
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    void file.text().then(setCsv);
    e.target.value = ""; // allow re-picking the same file after an edit
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-stone-200 px-6 py-4">
        <div>
          <h1 className="text-xl font-semibold text-stone-900">Delivery areas</h1>
          <p className="text-sm text-stone-500">
            Bulk import serviceable pincodes from CSV — upsert by pincode.
          </p>
        </div>
        <Link
          href="/admin/collections/serviceablePincodes"
          className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-50"
        >
          View collection
        </Link>
      </header>

      <div className="grid gap-6 p-6 lg:grid-cols-2">
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-stone-700">1. Paste or upload CSV</h2>
          <textarea
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            placeholder={"pincode,city,state,tier,slaDays,active\n110001,New Delhi,Delhi,fresh,1,true"}
            className="h-48 w-full rounded-md border border-stone-300 p-2 font-mono text-xs"
            aria-label="Pincode CSV"
          />
          <div className="flex items-center gap-3">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv,text/plain"
              onChange={onFile}
              className="text-sm text-stone-600"
              aria-label="Upload CSV file"
            />
            <p className="text-xs text-stone-400">
              Required columns: pincode, city, state. Optional: tier (fresh|shelf,
              default shelf), slaDays (0–14, default 1), active (default true). Max
              2,000 rows.
            </p>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-stone-700">2. Validate, then import</h2>
          <div className="flex gap-2">
            <button
              onClick={() => void run(true)}
              disabled={!csv.trim() || busy !== null}
              className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-40"
            >
              {busy === "validate" ? "Validating…" : "Validate only"}
            </button>
            <button
              onClick={() => void run(false)}
              disabled={!csv.trim() || busy !== null}
              className="rounded-md bg-stone-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-40"
            >
              {busy === "import" ? "Importing…" : "Import"}
            </button>
          </div>
          {error && (
            <div className="rounded-md bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</div>
          )}
          {result && (
            <div className="space-y-2 rounded-xl ring-1 ring-stone-200">
              <div className="flex gap-4 border-b border-stone-100 px-4 py-3 text-sm">
                <Result label={result.dryRun ? "Would create" : "Created"} value={result.created} />
                <Result label={result.dryRun ? "Would update" : "Updated"} value={result.updated} />
                <Result label="Duplicates in file" value={result.duplicates} />
                <Result label="Errors" value={result.errors.length} />
              </div>
              {result.errors.length > 0 && (
                <ul className="max-h-40 space-y-1 overflow-y-auto px-4 py-2 text-xs text-stone-600">
                  {result.errors.slice(0, 50).map((e, i) => (
                    <li key={i}>
                      <span className="font-mono text-stone-400">line {e.line}</span>{" "}
                      {e.message}
                    </li>
                  ))}
                  {result.errors.length > 50 && (
                    <li className="text-stone-400">
                      … {result.errors.length - 50} more errors not shown
                    </li>
                  )}
                </ul>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Result({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-lg font-semibold text-stone-900">{value}</div>
      <div className="text-xs text-stone-500">{label}</div>
    </div>
  );
}
