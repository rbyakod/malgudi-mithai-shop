// lib/email/templates.ts
// Inline-styled HTML for transactional email — conversion batch, Batch A
// (A6). Kept free of imports so it stays trivially testable/renderable;
// every style is inline (email clients strip <style> blocks).
//
// Brand: Malgudi Blue v2 (DESIGN.md) — navy canvas #041e42, gold accent
// #ffc220, display-serif headings. Georgia carries the display-serif feel
// with a plain-serif fallback (webfonts are unreliable in email clients).

/** One cart line as stored on a CartDrafts.items JSON field. */
export interface AbandonedCartLine {
  name?: string | null;
  quantity?: number | null;
}

export interface AbandonedCartDraft {
  sessionId: string;
  items?: AbandonedCartLine[] | null;
}

/** Base URL for the storefront cart (locale segment included). */
export const CART_RESTORE_URL_BASE = "https://mishran.pranavb.com/en/cart";

export function cartRestoreUrl(sessionId: string): string {
  return `${CART_RESTORE_URL_BASE}?draft=${encodeURIComponent(sessionId)}`;
}

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Abandoned-cart reminder email. `productNames` is the caller-resolved
 * display list (fallback when draft.items carry no usable names); the
 * template prefers per-line name + quantity from the draft when present.
 */
export function abandonedCartEmailHtml(
  draft: AbandonedCartDraft,
  productNames: string[],
): string {
  const lines: Array<{ label: string; quantity: number | null }> = [];
  for (const item of draft.items ?? []) {
    const label = typeof item?.name === "string" && item.name.trim() ? item.name.trim() : null;
    if (label) {
      lines.push({
        label,
        quantity: typeof item.quantity === "number" && item.quantity > 0 ? item.quantity : null,
      });
    }
  }
  if (lines.length === 0) {
    for (const name of productNames) lines.push({ label: name, quantity: null });
  }

  const rows = lines
    .map(
      (line) => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid rgba(4,30,66,0.12);font-family:Georgia,'Times New Roman',serif;font-size:15px;color:#041e42;">
            ${esc(line.label)}${line.quantity ? ` <span style="color:rgba(4,30,66,0.55);">&times;&nbsp;${line.quantity}</span>` : ""}
          </td>
        </tr>`,
    )
    .join("");

  return `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#f5f2ea;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f2ea;padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid rgba(4,30,66,0.08);">
            <tr>
              <td style="background:#041e42;padding:28px 32px;text-align:center;">
                <div style="font-family:Georgia,'Times New Roman',serif;font-size:13px;letter-spacing:0.28em;text-transform:uppercase;color:#ffc220;padding-bottom:8px;">Mishran</div>
                <h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:26px;line-height:1.25;color:#ffffff;font-weight:400;">Your cart is still waiting</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 32px 8px;">
                <p style="margin:0 0 6px;font-family:Georgia,'Times New Roman',serif;font-size:16px;color:#041e42;">A little nudge — the sweets you picked are saved:</p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows || '<tr><td style="padding:10px 0;font-family:Georgia,serif;font-size:15px;color:rgba(4,30,66,0.6);">Your saved selections</td></tr>'}</table>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:28px 32px 36px;">
                <a href="${cartRestoreUrl(draft.sessionId)}" style="display:inline-block;background:#041e42;color:#ffc220;font-family:Georgia,'Times New Roman',serif;font-size:15px;letter-spacing:0.12em;text-transform:uppercase;text-decoration:none;padding:14px 34px;border-radius:6px;border:1px solid #ffc220;">Restore your cart</a>
                <p style="margin:22px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:12px;line-height:1.6;color:rgba(4,30,66,0.55);">
                  One tap brings your cart back exactly as you left it.<br />
                  You asked us to keep an eye on it — reply anytime to stop these notes.
                </p>
              </td>
            </tr>
            <tr>
              <td style="background:#041e42;padding:16px 32px;text-align:center;">
                <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:rgba(255,255,255,0.6);">Mishran &middot; Sweets made slowly</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
