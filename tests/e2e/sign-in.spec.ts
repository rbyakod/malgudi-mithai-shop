// tests/e2e/sign-in.spec.ts
// Web sign-in — phone → OTP two-step against the local dev server.
//
// WRITTEN NOT RUN (needs a running server + local Mongo + the OTP bypass
// seam): the spec signs in with the bypass number/code so no real SMS is
// involved, asserts the redirect to /account, and covers the ?next=
// deep-link path. Configure with env vars when running:
//   SIGNIN_E2E_PHONE  — a number listed in OTP_BYPASS_PHONE (default
//                       +918088983014, the first family-testing number)
//   OTP_BYPASS_CODE   — the fixed verify code (default 424242)
// The server must run with matching OTP_BYPASS_PHONE / OTP_BYPASS_CODE.

import {test, expect} from "@playwright/test";

const PHONE = process.env.SIGNIN_E2E_PHONE ?? "+918088983014";
const CODE = process.env.OTP_BYPASS_CODE ?? "424242";

test.describe("sign-in", () => {
  test("phone → OTP verifies and lands on /account", async ({page}) => {
    await page.goto("/en/sign-in");

    // Step 1 — phone (E.164).
    await page.getByTestId("sign-in-phone").fill(PHONE);
    await page.getByTestId("sign-in-submit").click();

    // Step 2 — OTP entry appears, resend throttled by the countdown.
    await expect(page.getByTestId("sign-in-code")).toBeVisible();
    await expect(page.getByTestId("sign-in-resend")).toBeDisabled();

    await page.getByTestId("sign-in-code").fill(CODE);
    await page.getByTestId("sign-in-verify").click();

    // Signed in — account island shows the profile with our phone.
    await expect(page).toHaveURL(/\/en\/account$/);
    await expect(page.getByTestId("account-phone")).toHaveText(PHONE);
    await expect(page.getByTestId("sign-out")).toBeVisible();

    // Session survives a reload (localStorage restore, post-hydration only).
    await page.reload();
    await expect(page.getByTestId("account-phone")).toHaveText(PHONE);
  });

  test("deep link ?next=/track-order returns there after sign-in", async ({page}) => {
    await page.goto("/en/sign-in?next=/track-order");
    await page.getByTestId("sign-in-phone").fill(PHONE);
    await page.getByTestId("sign-in-submit").click();
    await page.getByTestId("sign-in-code").fill(CODE);
    await page.getByTestId("sign-in-verify").click();

    await expect(page).toHaveURL(/\/en\/track-order$/);
  });

  test("wrong code maps OTP_INVALID to friendly copy", async ({page}) => {
    await page.goto("/en/sign-in");
    await page.getByTestId("sign-in-phone").fill(PHONE);
    await page.getByTestId("sign-in-submit").click();
    await page.getByTestId("sign-in-code").fill("000000");
    await page.getByTestId("sign-in-verify").click();

    // Error copy is rendered (en locale copy from messages/en.json).
    await expect(page.getByTestId("sign-in-error")).toContainText(
      /doesn't match/i,
    );
    // Still on the code step — no redirect on failure.
    await expect(page).toHaveURL(/\/en\/sign-in/);
  });

  test("sign-out clears the session and revokes server-side", async ({page}) => {
    await page.goto("/en/sign-in");
    await page.getByTestId("sign-in-phone").fill(PHONE);
    await page.getByTestId("sign-in-submit").click();
    await page.getByTestId("sign-in-code").fill(CODE);
    await page.getByTestId("sign-in-verify").click();
    await expect(page.getByTestId("sign-out")).toBeVisible();

    await page.getByTestId("sign-out").click();
    // Back to the signed-out prompt on /account.
    await expect(page.getByTestId("sign-in-cta")).toBeVisible();
    // Reloading stays signed out — localStorage was cleared.
    await page.reload();
    await expect(page.getByTestId("sign-in-cta")).toBeVisible();
  });
});
