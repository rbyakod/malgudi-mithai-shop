// lib/email/templates.test.ts
// Abandoned-cart email template (A6): brand styling, restore link,
// cart-line rendering + escaping.
import { describe, it, expect } from 'vitest';
import {
  abandonedCartEmailHtml,
  cartRestoreUrl,
  type AbandonedCartDraft,
} from './templates';

const draft: AbandonedCartDraft = {
  sessionId: 'sess-abc-123',
  items: [
    { name: 'Kaju Katli', quantity: 2 },
    { name: 'Mysore Pak', quantity: 1 },
  ],
};

describe('cartRestoreUrl', () => {
  it('points at the storefront cart with the draft id', () => {
    expect(cartRestoreUrl('sess-abc-123')).toBe(
      'https://mishran.pranavb.com/en/cart?draft=sess-abc-123',
    );
  });

  it('encodes session ids that carry reserved characters', () => {
    expect(cartRestoreUrl('a/b&c')).toBe(
      'https://mishran.pranavb.com/en/cart?draft=a%2Fb%26c',
    );
  });
});

describe('abandonedCartEmailHtml', () => {
  it('renders the restore link with the draft sessionId', () => {
    const html = abandonedCartEmailHtml(draft, []);
    expect(html).toContain('https://mishran.pranavb.com/en/cart?draft=sess-abc-123');
    expect(html).toContain('Restore your cart');
  });

  it('lists product lines with quantities from the draft items', () => {
    const html = abandonedCartEmailHtml(draft, []);
    expect(html).toContain('Kaju Katli');
    expect(html).toContain('Mysore Pak');
    expect(html).toContain('&times;&nbsp;2');
  });

  it('falls back to caller-provided productNames when items carry none', () => {
    const html = abandonedCartEmailHtml({ sessionId: 's1' }, ['Dry Fruit Ladoo']);
    expect(html).toContain('Dry Fruit Ladoo');
  });

  it('carries the brand: navy heading canvas + gold accent, serif stack', () => {
    const html = abandonedCartEmailHtml(draft, []);
    expect(html).toContain('#041e42'); // navy
    expect(html).toContain('#ffc220'); // gold
    expect(html).toContain("Georgia,'Times New Roman',serif");
  });

  it('escapes product names (email-safe)', () => {
    const html = abandonedCartEmailHtml(
      { sessionId: 's1', items: [{ name: '<script>alert(1)</script>', quantity: 1 }] },
      [],
    );
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
