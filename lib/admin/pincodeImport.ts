// lib/admin/pincodeImport.ts
// Pincode CSV import (#129) — pure parse/validate for bulk-upserting
// serviceable delivery areas. Kept free of React/fetch so it is
// unit-testable in isolation (same pattern as lib/admin/reconcile.ts).
//
// Expected CSV header (case/spacing-insensitive):
//   pincode,city,state,tier,slaDays,active
// Only pincode, city, state are required columns. tier defaults to "shelf",
// slaDays to 1, active to true. Upsert key is the 6-digit pincode; when the
// same pincode appears twice the LAST row wins (reported as a duplicate).

import { splitCsvLine } from './reconcile';

export type PincodeTier = 'fresh' | 'shelf';

export interface PincodeUpsert {
  pincode: string;
  city: string;
  state: string;
  tier: PincodeTier;
  slaDays: number;
  active: boolean;
}

export interface PincodeRowError {
  line: number;
  message: string;
}

export interface PincodeParseResult {
  rows: PincodeUpsert[];
  errors: PincodeRowError[];
  duplicates: number;
}

export const PINCODE_IMPORT_MAX_ROWS = 2000;

const COLUMNS = {
  pincode: ['pincode', 'pin', 'pin code', 'pin_code'],
  city: ['city'],
  state: ['state'],
  tier: ['tier'],
  slaDays: ['sladays', 'sla', 'sla_days', 'sla days', 'days'],
  active: ['active', 'enabled'],
} as const;

function pickColumn(headers: string[], aliases: readonly string[]): number {
  const norm = headers.map((h) => h.trim().toLowerCase().replace(/\s+/g, ''));
  for (const alias of aliases) {
    const idx = norm.indexOf(alias.replace(/\s+/g, ''));
    if (idx >= 0) return idx;
  }
  return -1;
}

function parseTier(raw: string, line: number, errors: PincodeRowError[]): PincodeTier | null {
  const v = raw.trim().toLowerCase();
  if (!v) return 'shelf';
  if (v === 'fresh' || v === 'perishable') return 'fresh';
  if (v === 'shelf' || v === 'shelf-stable' || v === 'stable') return 'shelf';
  errors.push({ line, message: `unknown tier "${raw.trim()}" (use fresh or shelf)` });
  return null;
}

function parseSlaDays(raw: string, line: number, errors: PincodeRowError[]): number | null {
  const v = raw.trim();
  if (!v) return 1;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n > 14) {
    errors.push({ line, message: `slaDays "${v}" must be a whole number 0–14` });
    return null;
  }
  return n;
}

function parseActive(raw: string): boolean {
  const v = raw.trim().toLowerCase();
  if (['false', 'no', '0', 'inactive'].includes(v)) return false;
  return true; // default + any truthy spelling
}

export function parsePincodeCsv(csv: string): PincodeParseResult {
  const rows: PincodeUpsert[] = [];
  const errors: PincodeRowError[] = [];
  let duplicates = 0;

  const text = csv.replace(/^﻿/, '').trim();
  if (!text) return { rows, errors: [{ line: 1, message: 'CSV is empty' }], duplicates };

  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return { rows, errors: [{ line: 1, message: 'need a header row plus at least one data row' }], duplicates };
  }

  const headers = splitCsvLine(lines[0]);
  const col = {
    pincode: pickColumn(headers, COLUMNS.pincode),
    city: pickColumn(headers, COLUMNS.city),
    state: pickColumn(headers, COLUMNS.state),
    tier: pickColumn(headers, COLUMNS.tier),
    slaDays: pickColumn(headers, COLUMNS.slaDays),
    active: pickColumn(headers, COLUMNS.active),
  };
  if (col.pincode === -1) {
    return {
      rows,
      errors: [{ line: 1, message: 'no pincode column found in the header' }],
      duplicates,
    };
  }

  const byPincode = new Map<string, PincodeUpsert>();
  for (let i = 1; i < lines.length; i++) {
    const line = i + 1; // 1-based, counts the header
    if (byPincode.size >= PINCODE_IMPORT_MAX_ROWS) {
      errors.push({
        line,
        message: `row limit reached (${PINCODE_IMPORT_MAX_ROWS}) — split larger files`,
      });
      break;
    }
    const cells = splitCsvLine(lines[i]);
    const cell = (idx: number) => (idx >= 0 ? (cells[idx] ?? '').trim() : '');

    const pincode = cell(col.pincode);
    const city = cell(col.city);
    const state = cell(col.state);

    if (!/^\d{6}$/.test(pincode)) {
      errors.push({ line, message: `pincode "${pincode}" must be exactly 6 digits` });
      continue;
    }
    if (!city || !state) {
      errors.push({ line, message: 'city and state are required' });
      continue;
    }

    const tier = parseTier(cell(col.tier), line, errors);
    const slaDays = parseSlaDays(cell(col.slaDays), line, errors);
    if (tier === null || slaDays === null) continue;

    if (byPincode.has(pincode)) duplicates += 1;
    byPincode.set(pincode, {
      pincode,
      city,
      state,
      tier,
      slaDays,
      active: parseActive(cell(col.active)),
    });
  }

  rows.push(...byPincode.values());
  return { rows, errors, duplicates };
}
