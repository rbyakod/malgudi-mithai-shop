// tests/load/checkout-flow.k6.ts — Task 12.6 (Mishran Mobile Apps v1).
//
// Sustained checkout-flow load test for the mobile v1 API:
//   browse → serviceability → cart validate → create order
//
// Target from the plan: 1000 RPS sustained for 5 minutes, p95 < 500ms per
// route. Run against STAGING only (it authenticates a seeded test phone and
// drives order creation):
//
//   K6_BASE_URL=https://staging.mishran.app \
//   K6_TEST_PHONE=+919000000001 \
//   K6_TEST_OTP=123456 \
//   k6 run tests/load/checkout-flow.k6.ts
//
// Staging prerequisites (same ones the Maestro CI job needs):
//   - A seeded load-test phone whose OTP the staging SMS provider discards to
//     a fixed value (MSG91 test mode / stub template). Without a deterministic
//     OTP the setup() auth cannot proceed — fail fast with a clear error.
//   - Razorpay TEST keys. /payments/razorpay/verify is deliberately EXCLUDED
//     from sustained load: a valid signature requires a real Razorpay payment,
//     which cannot be minted at 1000 RPS from outside. Verify-path latency is
//     covered by the backend integration suite instead; create-order (the
//     expensive DB+Razorpay-order leg) is exercised here.
//   - MongoDB self-hosted single-node replica (production shape).
//
// Traffic shape: a checkout journey is read-heavy with a thin write tail, so
// the 1000 RPS budget is split per-iteration rather than per-endpoint — each
// VU iteration issues 1 catalog list + 1 detail + 1 serviceability check +
// 1 cart validate, and creates an order on a fraction of iterations
// (ORDER_RATE) so the orders collection grows at a realistic pace instead of
// every iteration writing an order row.
// Per-route Trends carry the p95<500ms thresholds; k6 fails the run if any
// route breaches.

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';
import { fail } from 'k6';

// ---- Config -----------------------------------------------------------------

const BASE_URL = __ENV.K6_BASE_URL || 'http://localhost:3000';
const TEST_PHONE = __ENV.K6_TEST_PHONE || fail('K6_TEST_PHONE is required');
const TEST_OTP = __ENV.K6_TEST_OTP || fail('K6_TEST_OTP is required (staging fixed OTP)');
const API = `${BASE_URL}/api/mobile/v1`;

/** Share of iterations that complete the write leg (order creation). */
const ORDER_RATE = parseFloat(__ENV.K6_ORDER_RATE || '0.2');

// ---- Per-route metrics (thresholds live in options) -------------------------

const catalogListDuration = new Trend('catalog_list_duration', true);
const catalogDetailDuration = new Trend('catalog_detail_duration', true);
const serviceableDuration = new Trend('serviceable_duration', true);
const cartValidateDuration = new Trend('cart_validate_duration', true);
const createOrderDuration = new Trend('create_order_duration', true);
const authDuration = new Trend('auth_duration', true);
const orderErrors = new Rate('order_errors');

// ---- Load profile: 1000 RPS sustained 5 min ----------------------------------

export const options = {
  scenarios: {
    checkout_flow: {
      executor: 'constant-arrival-rate',
      rate: 1000, // iterations/s = the sustained RPS target
      timeUnit: '1s',
      duration: '5m',
      preAllocatedVUs: 200,
      maxVUs: 1000,
    },
  },
  thresholds: {
    // Plan budget: p95 < 500ms per route. Split across the journey's legs.
    catalog_list_duration: ['p(95)<500'],
    catalog_detail_duration: ['p(95)<500'],
    serviceable_duration: ['p(95)<500'],
    cart_validate_duration: ['p(95)<500'],
    create_order_duration: ['p(95)<500'],
    auth_duration: ['p(95)<500'],
    // A checkout journey that errors is a lost order: keep the floor tight.
    order_errors: ['rate<0.01'],
    http_req_failed: ['rate<0.01'],
  },
};

// ---- Setup: authenticate the seeded phone once per k6 instance --------------

interface SetupData {
  accessToken: string;
  productSlug: string;
  productId: string;
  pincode: string;
  addressId: string;
}

export function setup(): SetupData {
  const sendRes = http.post(
    `${API}/auth/otp/send`,
    JSON.stringify({ phone: TEST_PHONE }),
    { headers: { 'Content-Type': 'application/json' }, tags: { name: 'otp_send' } },
  );
  check(sendRes, { 'otp send ok': (r) => r.status === 200 }) ||
    fail(`otp/send failed (${sendRes.status}): ${sendRes.body}`);

  const verifyRes = http.post(
    `${API}/auth/otp/verify`,
    JSON.stringify({ requestId: JSON.parse(sendRes.body).data.requestId, code: TEST_OTP }),
    { headers: { 'Content-Type': 'application/json' }, tags: { name: 'otp_verify' } },
  );
  const body = verifyRes.json();
  check(verifyRes, { 'otp verify ok': (r) => r.status === 200 && body?.data?.accessToken }) ||
    fail(`otp/verify failed (${verifyRes.status}): ${verifyRes.body}`);

  const accessToken: string = body.data.accessToken;

  // Pick a real product + a serviceable pincode for the journey.
  const catalog = http.get(`${API}/catalog/products?page=1&pageSize=50`, {
    headers: authHeaders(accessToken),
    tags: { name: 'setup_catalog' },
  });
  const items = catalog.json()?.data?.items ?? [];
  items.length > 0 || fail('catalog returned no items — seed staging first');
  const product = items[0];

  const pincode = __ENV.K6_PINCODE || '110001'; // Delhi NCR = fresh tier

  // Create the delivery address once — create-order needs its id and the
  // journey would otherwise spend its RPS budget on address writes.
  const address = http.post(
    `${API}/addresses`,
    JSON.stringify({
      line1: 'Load Test Row 1',
      city: 'New Delhi',
      state: 'Delhi',
      pincode,
      tag: 'other',
    }),
    { headers: authHeaders(accessToken), tags: { name: 'setup_address' } },
  );
  const addressId = address.json()?.data?.id ?? address.json()?.id;
  addressId || fail(`address create failed (${address.status}): ${address.body}`);

  return {
    accessToken,
    productSlug: product.slug,
    productId: product.id,
    pincode,
    addressId,
  };
}

function authHeaders(token: string): Record<string, string> {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

/** UUID v4 — the Idempotency-Key every mutating call must carry. */
function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ---- The journey -------------------------------------------------------------

export default function (data: SetupData) {
  const headers = authHeaders(data.accessToken);

  // 1. Catalog list (the app's landing read).
  const list = http.get(`${API}/catalog/products?page=1&pageSize=24`, {
    headers,
    tags: { name: 'catalog_list' },
  });
  catalogListDuration.add(list.timings.duration, { route: 'catalog_list' });
  orderErrors.add(list.status !== 200);

  // 2. Product detail.
  const detail = http.get(`${API}/catalog/products/${data.productSlug}`, {
    headers,
    tags: { name: 'catalog_detail' },
  });
  catalogDetailDuration.add(detail.timings.duration, { route: 'catalog_detail' });
  orderErrors.add(detail.status !== 200);

  // 3. Serviceability check (checkout address step).
  const serviceable = http.get(`${API}/catalog/serviceable?pincode=${data.pincode}`, {
    headers,
    tags: { name: 'serviceable' },
  });
  serviceableDuration.add(serviceable.timings.duration, { route: 'serviceable' });
  orderErrors.add(serviceable.status !== 200);

  // 4. Cart validate (the pre-payment consistency gate) — persists a
  // tamper-evident snapshot server-side and hands back its snapshotId.
  const validate = http.post(
    `${API}/cart/validate`,
    JSON.stringify({
      items: [{ productId: data.productId, quantity: 1 }],
      pincode: data.pincode,
    }),
    { headers: { ...headers, 'Idempotency-Key': uuidv4() }, tags: { name: 'cart_validate' } },
  );
  cartValidateDuration.add(validate.timings.duration, { route: 'cart_validate' });
  orderErrors.add(validate.status !== 200 && validate.status !== 409);

  // 5. Order creation on a slice of iterations — the write tail. Re-reads the
  // persisted snapshot + mints a Razorpay order, so this is the expensive leg.
  const snapshotId = validate.status === 200 ? validate.json()?.data?.snapshotId : null;
  if (Math.random() < ORDER_RATE && snapshotId) {
    const create = http.post(
      `${API}/payments/razorpay/create-order`,
      JSON.stringify({ snapshotId, deliveryAddressId: data.addressId }),
      {
        headers: {
          ...headers,
          'Idempotency-Key': uuidv4(),
          'X-Client-Source': 'mobile-android',
        },
        tags: { name: 'create_order' },
      },
    );
    createOrderDuration.add(create.timings.duration, { route: 'create_order' });
    orderErrors.add(create.status !== 200 && create.status !== 201);
  }

  sleep(0.1); // small think-time keeps per-VU pacing realistic
}

// ---- Bottleneck notes (fill after the first staging run) ---------------------
//
// Documented expectations to validate on the first real run:
//   - catalog list/detail are ETag-cacheable — a Redis-less deployment should
//     still hold p95 via Mongo indexed reads + Next route handlers.
//   - cart/validate does stock + pincode tier lookups per call — watch Mongo
//     read amplification here first.
//   - create-order opens a Razorpay REST call inline — its p95 will be dominated
//     by the Razorpay round-trip; if it breaches 500ms, move order creation to
//     accept-then-confirm (already the pending_payment shape) and measure again.
//   - Single-node Mongo replica: watch for connection-pool saturation at
//     1000 RPS (the default pool is small); scale maxPoolSize before sharding.
