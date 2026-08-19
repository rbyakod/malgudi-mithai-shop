import { describe, it, expect, vi, beforeEach } from 'vitest';

// Path depth: app/api/staff/pincodes/import/ = 5 dirs -> 5 `../`.

// Pincode CSV import (#129): staff gate, dry-run preview, upsert split.
// The mocked payload's find/create/update spies drive the counts.

const { adminUser, find, create, update } = vi.hoisted(() => ({
  adminUser: vi.fn(),
  find: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
}));

vi.mock('payload', () => ({
  getPayload: vi.fn(async () => ({ find, create, update })),
}));

vi.mock('../../../../../payload.config', () => ({ default: {} }));

// lib/api/response -> Logger -> lib/config parses env at import; stub it.
vi.mock('../../../../../lib/config', () => ({ config: {} }));

vi.mock('../../../../../lib/api/adminAuth', () => ({
  getPayloadAdminUser: adminUser,
}));

import { POST } from './route';

function call(body: unknown) {
  return POST(
    new Request('http://localhost/api/staff/pincodes/import', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }) as Parameters<typeof POST>[0],
  );
}

const CSV = [
  'pincode,city,state,tier,slaDays',
  '110001,New Delhi,Delhi,fresh,1',
  '560001,Bengaluru,Karnataka,shelf,2',
].join('\n');

beforeEach(() => {
  vi.clearAllMocks();
  adminUser.mockResolvedValue({ id: 'user-1', role: 'admin' });
  create.mockImplementation(async ({ data }) => ({ id: 'new-1', ...data }));
  update.mockImplementation(async ({ id, data }) => ({ id, ...data }));
});

describe('POST /api/staff/pincodes/import', () => {
  it('401s without a staff session', async () => {
    adminUser.mockResolvedValue(null);
    const res = await call({ csv: CSV });
    expect(res.status).toBe(401);
    expect(find).not.toHaveBeenCalled();
  });

  it('422s a malformed body', async () => {
    const res = await call({ nope: true });
    expect(res.status).toBe(422);
  });

  it('dryRun reports would-create/would-update without writing', async () => {
    // 110001 already exists; 560001 is new.
    find.mockResolvedValue({ docs: [{ id: 'p-1', pincode: '110001' }] });
    const res = await call({ csv: CSV, dryRun: true });
    expect(res.status).toBe(200);
    const body = (await res.json()).data;
    expect(body).toMatchObject({ dryRun: true, rows: 2, created: 1, updated: 1, duplicates: 0 });
    expect(create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('upserts: updates existing pincode, creates the new one', async () => {
    find.mockResolvedValue({ docs: [{ id: 'p-1', pincode: '110001' }] });
    const res = await call({ csv: CSV });
    expect(res.status).toBe(200);
    const body = (await res.json()).data;
    expect(body).toMatchObject({ dryRun: false, rows: 2, created: 1, updated: 1 });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'serviceablePincodes',
        id: 'p-1',
        data: expect.objectContaining({ pincode: '110001', city: 'New Delhi' }),
      }),
    );
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'serviceablePincodes',
        data: expect.objectContaining({ pincode: '560001', tier: 'shelf' }),
      }),
    );
  });

  it('surfaces row errors and skips writes when nothing parses', async () => {
    find.mockResolvedValue({ docs: [] });
    const res = await call({ csv: 'city,state\nNew Delhi,Delhi' });
    expect(res.status).toBe(200);
    const body = (await res.json()).data;
    expect(body.rows).toBe(0);
    expect(body.errors[0].message).toContain('no pincode column');
    expect(create).not.toHaveBeenCalled();
  });
});
