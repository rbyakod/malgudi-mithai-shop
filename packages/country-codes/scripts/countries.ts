import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Shared loader + validator for countries.json. Both codegen scripts and the
// tests import this so a bad row fails everything identically.

export interface CountryRow {
  iso2: string;
  name: string;
  dialCode: string;
}

const ISO2_RE = /^[A-Z]{2}$/;
const DIAL_RE = /^[1-9]\d{0,3}$/;
// Latin letters incl. diacritics (À-Ö, Ø-ö, ø-ÿ skips × and ÷), spaces,
// hyphens, apostrophes, periods, parens, commas — everything a short country
// name needs, nothing that needs string escaping beyond the codegen `esc()`.
const NAME_RE = /^[A-Za-zÀ-ÖØ-öø-ÿ' .(),-]{2,60}$/;

/** Lowercased, accent-folded name — the collation used for the A–Z ordering. */
export function foldName(name: string): string {
  // NFD splits é -> e + combining acute (U+0300..U+036F); drop the marks.
  return Array.from(name.normalize('NFD'))
    .filter((ch) => {
      const cp = ch.codePointAt(0) ?? 0;
      return cp < 0x0300 || cp > 0x036f;
    })
    .join('')
    .toLowerCase();
}

export function loadCountries(): CountryRow[] {
  const raw = JSON.parse(readFileSync(join(process.cwd(), 'countries.json'), 'utf8'));
  if (!Array.isArray(raw)) throw new Error('countries.json: expected a top-level array');
  if (raw.length < 200) {
    throw new Error(`countries.json: expected ≥200 rows, got ${raw.length}`);
  }

  const seen = new Set<string>();
  raw.forEach((r: unknown, i: number) => {
    if (typeof r !== 'object' || r === null || Array.isArray(r)) {
      throw new Error(`countries.json row ${i}: expected an object, got ${JSON.stringify(r)}`);
    }
    const { iso2, name, dialCode } = r as Record<string, unknown>;
    if (typeof iso2 !== 'string' || !ISO2_RE.test(iso2)) {
      throw new Error(`countries.json row ${i}: iso2 must be 2 uppercase letters, got ${JSON.stringify(iso2)}`);
    }
    if (typeof name !== 'string' || !NAME_RE.test(name)) {
      throw new Error(`countries.json row ${i}: bad name ${JSON.stringify(name)}`);
    }
    if (typeof dialCode !== 'string' || !DIAL_RE.test(dialCode)) {
      throw new Error(`countries.json row ${i}: dialCode must be digits without + (1-4), got ${JSON.stringify(dialCode)}`);
    }
    if (seen.has(iso2)) throw new Error(`countries.json: duplicate iso2 ${iso2}`);
    seen.add(iso2);
  });

  // Contract the generated tables rely on: India is row 0 (the +91 default),
  // everything after is A–Z by folded name — that order IS the picker order.
  const [first, ...rest] = raw as CountryRow[];
  if (first.iso2 !== 'IN' || first.dialCode !== '91') {
    throw new Error('countries.json: row 0 must be India/91 (the app default)');
  }
  const sorted = [...rest].sort((a, b) =>
    foldName(a.name) < foldName(b.name) ? -1 : foldName(a.name) > foldName(b.name) ? 1 : 0,
  );
  rest.forEach((r, i) => {
    if (r !== sorted[i]) {
      throw new Error(
        `countries.json: rows after 0 must be A–Z by name; "${r.name}" at ${i + 1} is out of order`,
      );
    }
  });

  return raw as CountryRow[];
}
