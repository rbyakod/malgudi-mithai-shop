import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Path depth: app/api/cron/abandoned-carts/ = 4 dirs -> 4 ../ to root.

// Abandoned-cart cron (A6): same bearer-secret auth as reconcile-payments,
// one reminder per draft ever, summary-counts-only response.

// Mirrors sendAbandonedCartReminder(to, draft, productNames) so mock.calls
// destructures with real types.
interface ReminderDraft {
  sessionId: string;
  items?: Array<{ name?: string; quantity?: number }>;
}

const { stores, updates, sendReminder } = vi.hoisted(() => ({
  stores: { 'cart-drafts': new Map<string, Record<string, unknown>>() },
  updates: [] as Array<Record<string, unknown>>,
  sendReminder: vi.fn(
    async (to: string, draft: ReminderDraft, productNames: string[]) => {
      void to;
      void draft;
      void productNames;
      return true;
    },
  ),
}));

// Mini where-matcher: equals / exists / less_than / greater_than over
// and-combined clauses (ISO date strings compare correctly as strings).
function matches(doc: Record<string, unknown>, where: unknown): boolean {
  if (!where || typeof where !== 'object') return true;
  const clauses = (where as { and?: unknown[] }).and ?? [where];
  return clauses.every((clause) =>
    Object.entries(clause as Record<string, unknown>).every(([field, cond]) => {
      const c = cond as {
        equals?: unknown;
        exists?: boolean;
        less_than?: string;
        greater_than?: string;
      };
      if ('equals' in c) return doc[field] === c.equals;
      if ('exists' in c) return c.exists ? doc[field] !== undefined : doc[field] === undefined;
      if ('less_than' in c) return String(doc[field] ?? '') < String(c.less_than);
      if ('greater_than' in c) return String(doc[field] ?? '') > String(c.greater_than);
      return true;
    }),
  );
}

vi.mock('payload', () => ({
  getPayload: vi.fn(async () => ({
    find: vi.fn(async ({ where }: { where?: unknown }) => {
      const all = Array.from(stores['cart-drafts'].values());
      return { docs: all.filter((d) => matches(d, where)), totalDocs: all.length };
    }),
    update: vi.fn(
      async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
        updates.push({ id, data });
        const doc = stores['cart-drafts'].get(id);
        if (doc) Object.assign(doc, data);
        return doc;
      },
    ),
  })),
}));

vi.mock('../../../../payload.config', () => ({ default: {} }));

vi.mock('../../../../lib/email', () => ({
  sendAbandonedCartReminder: sendReminder,
}));

import { GET } from './route';

const HOUR = 3_600_000;

function seedDraft(over: Record<string, unknown> = {}) {
  const id = `cd-${stores['cart-drafts'].size + 1}`;
  const doc: Record<string, unknown> = {
    id,
    sessionId: `sess-${id}`,
    email: 'shopper@example.com',
    items: [{ name: 'Kaju Katli', quantity: 2 }],
    status: 'active',
    marketingConsent: true,
    lastActivityAt: new Date(Date.now() - 2 * HOUR).toISOString(),
    expiresAt: new Date(Date.now() + 20 * 86_400_000).toISOString(),
    ...over,
  };
  stores['cart-drafts'].set(id, doc);
  return doc;
}

function cronReq(secret = 'cron-secret-1'): Request {
  return new Request('http://localhost/api/cron/abandoned-carts', {
    headers: { authorization: `Bearer ${secret}` },
  });
}

describe('GET /api/cron/abandoned-carts', () => {
  beforeEach(() => {
    stores['cart-drafts'].clear();
    updates.length = 0;
    sendReminder.mockReset();
    sendReminder.mockResolvedValue(true);
    process.env.CRON_SECRET = 'cron-secret-1';
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it('returns 401 with a wrong or missing bearer', async () => {
    const wrong = await GET(cronReq('nope'));
    expect(wrong.status).toBe(401);

    const none = await GET(new Request('http://localhost/api/cron/abandoned-carts'));
    expect(none.status).toBe(401);
  });

  it('returns 500 when CRON_SECRET is not configured', async () => {
    delete process.env.CRON_SECRET;
    const res = await GET(new Request('http://localhost/api/cron/abandoned-carts'));
    expect(res.status).toBe(500);
  });

  it('sends one reminder per eligible draft and stamps reminderSentAt', async () => {
    seedDraft();
    const res = await GET(cronReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: 'ok', considered: 1, sent: 1, stamped: 1, failed: 0 });

    expect(sendReminder).toHaveBeenCalledTimes(1);
    const [to, draft, names] = sendReminder.mock.calls[0]!;
    expect(to).toBe('shopper@example.com');
    expect(draft.sessionId).toBe('sess-cd-1');
    expect(names).toEqual(['Kaju Katli']);
    expect(updates[0]).toMatchObject({ id: 'cd-1', data: { reminderSentAt: expect.any(String) } });
  });

  it('never re-reminds: a stamped draft is excluded from the next run', async () => {
    seedDraft();
    await GET(cronReq());
    sendReminder.mockClear();

    const second = await GET(cronReq());
    const body = await second.json();
    expect(body.considered).toBe(0);
    expect(sendReminder).not.toHaveBeenCalled();
  });

  it('skips drafts the where-layer cannot select: recent activity, no consent, converted, expired', async () => {
    seedDraft({ id: 'cd-x1', sessionId: 's-recent', lastActivityAt: new Date(Date.now() - 10 * 60_000).toISOString() });
    seedDraft({ id: 'cd-x2', sessionId: 's-noconsent', marketingConsent: false });
    seedDraft({ id: 'cd-x3', sessionId: 's-converted', status: 'converted' });
    seedDraft({ id: 'cd-x4', sessionId: 's-expired', expiresAt: new Date(Date.now() - 1000).toISOString() });

    const res = await GET(cronReq());
    const body = await res.json();
    expect(body.considered).toBe(0);
    expect(sendReminder).not.toHaveBeenCalled();
  });

  it('does not burn the one reminder when RESEND is unconfigured (send returns false)', async () => {
    seedDraft();
    sendReminder.mockResolvedValue(false);
    const res = await GET(cronReq());
    const body = await res.json();
    expect(body.sent).toBe(0);
    expect(body.stamped).toBe(0);
    expect(updates).toHaveLength(0);
  });

  it('skips drafts without an email (code-level guard) without failing the run', async () => {
    seedDraft({ id: 'cd-x1', sessionId: 's-noemail', email: null });
    const res = await GET(cronReq());
    const body = await res.json();
    expect(body).toEqual({ status: 'ok', considered: 1, sent: 0, stamped: 0, failed: 0 });
  });

  it('continues past a failing draft and reports it as failed', async () => {
    seedDraft({ id: 'cd-1', sessionId: 's-bad' });
    seedDraft({ id: 'cd-2', sessionId: 's-good' });
    sendReminder.mockImplementation(async (_to: string, d: { sessionId: string }) => {
      if (d.sessionId === 's-bad') throw new Error('resend exploded');
      return true;
    });

    const res = await GET(cronReq());
    const body = await res.json();
    expect(body.sent).toBe(1);
    expect(body.failed).toBe(1);
    expect(body.stamped).toBe(1);
  });

  it('response carries counts only — no emails or session ids', async () => {
    seedDraft();
    const res = await GET(cronReq());
    const text = await res.text();
    expect(text).not.toContain('shopper@example.com');
    expect(text).not.toContain('sess-');
  });
});
