import { describe, it, expect } from 'vitest';

// Pincode CSV import (#129): header detection, validation, dedup.

import { parsePincodeCsv, PINCODE_IMPORT_MAX_ROWS } from './pincodeImport';

const CSV = [
  'pincode,city,state,tier,slaDays,active',
  '110001,New Delhi,Delhi,fresh,1,true',
  '110002,New Delhi,Delhi,shelf,2,false',
  '201301,Noida,Uttar Pradesh,,,',
].join('\n');

describe('parsePincodeCsv', () => {
  it('parses rows and applies defaults for optional columns', () => {
    const { rows, errors } = parsePincodeCsv(CSV);
    expect(errors).toEqual([]);
    expect(rows).toEqual([
      { pincode: '110001', city: 'New Delhi', state: 'Delhi', tier: 'fresh', slaDays: 1, active: true },
      { pincode: '110002', city: 'New Delhi', state: 'Delhi', tier: 'shelf', slaDays: 2, active: false },
      // tier->shelf, slaDays->1, active->true defaults
      { pincode: '201301', city: 'Noida', state: 'Uttar Pradesh', tier: 'shelf', slaDays: 1, active: true },
    ]);
  });

  it('is tolerant of header case, spacing, and BOM/CRLF', () => {
    const csv = '﻿Pin Code,City,State,SLA days\r\n560001,Bengaluru,Karnataka,2\r\n';
    const { rows, errors } = parsePincodeCsv(csv);
    expect(errors).toEqual([]);
    expect(rows[0]).toEqual({
      pincode: '560001',
      city: 'Bengaluru',
      state: 'Karnataka',
      tier: 'shelf',
      slaDays: 2,
      active: true,
    });
  });

  it('rejects bad pincodes, missing city/state, bad tier, bad slaDays', () => {
    const csv = [
      'pincode,city,state,tier,slaDays',
      '1100,New Delhi,Delhi,fresh,1', // too short
      '11000X,New Delhi,Delhi,fresh,1', // non-digit
      '110003,,Delhi,fresh,1', // missing city
      '110004,New Delhi,,fresh,1', // missing state
      '110005,New Delhi,Delhi,express,1', // unknown tier
      '110006,New Delhi,Delhi,fresh,2.5', // non-integer sla
      '110007,New Delhi,Delhi,fresh,30', // sla > 14
    ].join('\n');
    const { rows, errors } = parsePincodeCsv(csv);
    expect(rows).toEqual([]);
    expect(errors.map((e) => e.line)).toEqual([2, 3, 4, 5, 6, 7, 8]);
    expect(errors[4].message).toContain('unknown tier "express"');
  });

  it('last row wins for duplicate pincodes and reports the count', () => {
    const csv = [
      'pincode,city,state,slaDays',
      '110001,New Delhi,Delhi,1',
      '110001,Old Delhi,Delhi,3',
    ].join('\n');
    const { rows, duplicates } = parsePincodeCsv(csv);
    expect(duplicates).toBe(1);
    expect(rows).toHaveLength(1);
    expect(rows[0].city).toBe('Old Delhi');
    expect(rows[0].slaDays).toBe(3);
  });

  it('errors on empty input, header-only, and missing pincode column', () => {
    expect(parsePincodeCsv('').errors[0].message).toContain('empty');
    expect(parsePincodeCsv('pincode,city,state').errors[0].message).toContain('at least one data row');
    expect(parsePincodeCsv('city,state\nNew Delhi,Delhi').errors[0].message).toContain(
      'no pincode column',
    );
  });

  it('stops at the row cap', () => {
    const lines = ['pincode,city,state'];
    for (let i = 0; i < PINCODE_IMPORT_MAX_ROWS + 5; i++) {
      lines.push(`${String(i).padStart(6, '0')},City,State`);
    }
    const { rows, errors } = parsePincodeCsv(lines.join('\n'));
    expect(rows).toHaveLength(PINCODE_IMPORT_MAX_ROWS);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('row limit');
  });
});
