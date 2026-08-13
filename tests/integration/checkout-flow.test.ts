// @vitest-environment node
//
// jose v6 uses a webapi build whose SignJWT payload-encoding trips in the
// global jsdom env; this file exercises real RS256 issuance, so force node.
//
// tests/integration/checkout-flow.test.ts
// Full mobile checkout flow integration — Task 6.2.
//
// WHY THIS SHAPE: the per-route *.route.test.ts siblings mock BOTH payload
// AND the container, so they prove each handler in isolation but never that
// the handlers compose. This file closes that gap: it runs the REAL route
// handler functions (no supertest, no dev server, no Mongo) across all six
// checkout endpoints against ONE shared in-memory Payload store, with REAL
// service instances wired through the container —
//   - real JwtService (RS256 issue→verify round-trip with a test keypair),
//   - real argon2id OTP hash→verify (the code is captured by wrapping
//     FakeOtpService.send, since the route hashes the code before storing it),
//   - real FakePaymentService (createOrder + verifySignature),
//   - real ORDER_TRANSITIONS state machine (pending_payment→confirmed),
//   - real idempotency caching,
//   - real OrderEventEmitter push/SMS fan-out.
// Only the persistence boundary (Payload) is faked. That makes it a true
// composition test of the request layer without an external Mongo dependency
// (which is not reliably running in every dev/CI environment).
//
// Path depth: tests/integration/ = 2 dirs under repo root → `../../` to root.
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { generateKeyPairSync } from "node:crypto";

// vi.hoisted: these holders are created before vi.mock factories evaluate, so
// the factories can close over them. Mutable holders let us assign REAL service
// instances in beforeAll (after imports resolve) and have the mocked container
// return them via getters.
const ctx = vi.hoisted(() => ({
  jwt: undefined as unknown,
  otp: undefined as unknown,
  pay: undefined as unknown,
  // The route argon2-hashes the OTP code before persisting it and never
  // returns it; FakeOtpService.send discards the code. We wrap send to capture
  // the real code so the verify step can replay it.
  capturedCode: "" as string,
  pushSent: [] as Array<unknown>,
  smsSent: [] as Array<unknown>,
  stores: {
    otpRequests: new Map<string, Record<string, unknown>>(),
    customers: new Map<string, Record<string, unknown>>(),
    serviceablePincodes: new Map<string, Record<string, unknown>>(),
    // mithai-products is the only kebab-case collection slug in the flow;
    // every other collection is camelCase. The key must match the route's slug.
    "mithai-products": new Map<string, Record<string, unknown>>(),
    snapshots: new Map<string, Record<string, unknown>>(),
    orders: new Map<string, Record<string, unknown>>(),
    payments: new Map<string, Record<string, unknown>>(),
    idempotencyKeys: new Map<string, Record<string, unknown>>(),
    devices: new Map<string, Record<string, unknown>>(),
  } as Record<string, Map<string, Record<string, unknown>>>,
}));

// --- minimal in-memory Payload backed by ctx.stores ----------------------
function matchWhere(doc: Record<string, unknown>, where: unknown): boolean {
  if (!where || typeof where !== "object") return true;
  for (const field of Object.keys(where as Record<string, unknown>)) {
    const cond = (where as Record<string, unknown>)[field];
    if (field === "and") {
      if (!Array.isArray(cond) || !cond.every((c) => matchWhere(doc, c))) return false;
      continue;
    }
    if (field === "or") {
      if (!Array.isArray(cond) || !cond.some((c) => matchWhere(doc, c))) return false;
      continue;
    }
    if (!cond || typeof cond !== "object" || !("equals" in (cond as Record<string, unknown>))) {
      return false;
    }
    if (doc[field] !== (cond as { equals: unknown }).equals) return false;
  }
  return true;
}

let idSeq = 0;
const nextId = (collection: string) => `${collection}-${++idSeq}`;

vi.mock("payload", () => ({
  getPayload: vi.fn(async () => ({
    findByID: vi.fn(async ({ collection, id }: { collection: string; id: string }) => {
      const col = ctx.stores[collection];
      return col ? (col.get(id) ?? null) : null;
    }),
    find: vi.fn(
      async ({
        collection,
        where,
        limit,
      }: {
        collection: string;
        where?: unknown;
        limit?: number;
      }) => {
        const col = ctx.stores[collection];
        const all = col ? Array.from(col.values()) : [];
        const docs = (where ? all.filter((d) => matchWhere(d, where)) : all).slice(
          0,
          limit ?? all.length,
        );
        return { docs, totalDocs: docs.length };
      },
    ),
    create: vi.fn(
      async ({
        collection,
        data,
      }: {
        collection: string;
        data: Record<string, unknown>;
      }) => {
        // idempotencyKeys are keyed by their own `key` field, not a counter.
        const id = collection === "idempotencyKeys" ? (data.key as string) : nextId(collection);
        const doc = { id, createdAt: new Date().toISOString(), ...data };
        if (!ctx.stores[collection]) ctx.stores[collection] = new Map();
        ctx.stores[collection].set(id, doc);
        return doc;
      },
    ),
    update: vi.fn(
      async ({
        collection,
        id,
        data,
      }: {
        collection: string;
        id: string;
        data: Record<string, unknown>;
      }) => {
        const col = ctx.stores[collection];
        const prev = col?.get(id);
        if (!prev) throw new Error(`${collection} ${id} missing`);
        const merged = { ...prev, ...data, updatedAt: new Date().toISOString() };
        col.set(id, merged);
        return merged;
      },
    ),
  })),
}));

vi.mock("../../payload.config", () => ({ default: {} }));

// Getter-based container: returns the REAL instances assigned in beforeAll.
vi.mock("../../lib/container", () => ({
  container: {
    get jwtService() {
      return ctx.jwt;
    },
    get otpService() {
      return ctx.otp;
    },
    get paymentService() {
      return ctx.pay;
    },
    rateLimiter: { check: vi.fn().mockResolvedValue(undefined) },
    pushService: {
      sendToTokens: vi.fn(async (opts: unknown) => {
        ctx.pushSent.push(opts);
        return { successCount: 1, failureCount: 0 };
      }),
    },
    smsService: {
      send: vi.fn(async (opts: unknown) => {
        ctx.smsSent.push(opts);
        return { messageId: "sms-fake-1" };
      }),
    },
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      child: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
    },
  },
}));

// otp/send imports the logger directly (not via container); stub it so the
// real Pino wrapper never has to construct in the test env.
vi.mock("../../lib/observability/Logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
  },
}));

import { POST as sendOtp } from "../../app/api/mobile/v1/auth/otp/send/route";
import { POST as verifyOtp } from "../../app/api/mobile/v1/auth/otp/verify/route";
import { POST as validateCart } from "../../app/api/mobile/v1/cart/validate/route";
import { POST as createOrder } from "../../app/api/mobile/v1/payments/razorpay/create-order/route";
import { POST as verifyPayment } from "../../app/api/mobile/v1/payments/razorpay/verify/route";
import { GET as listOrders } from "../../app/api/mobile/v1/orders/route";
import { GET as getOrder } from "../../app/api/mobile/v1/orders/[id]/route";
import { JwtService } from "../../lib/auth/JwtService";
import { FakeOtpService } from "../../lib/auth/impl/FakeOtpService";
import { FakePaymentService } from "../../lib/commerce/impl/FakePaymentService";

const PHONE = "+919999999999";
const PRODUCT_ID = "prod-kaju";

function req(
  method: string,
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
): Request {
  const init: RequestInit = {
    method,
    headers: { "content-type": "application/json", ...headers },
  };
  if (body !== null && body !== undefined) {
    init.body = typeof body === "string" ? body : JSON.stringify(body);
  }
  return new Request(`http://localhost/api/mobile/v1${path}`, init);
}

function resetStores() {
  for (const m of Object.values(ctx.stores)) m.clear();
  idSeq = 0;
  ctx.capturedCode = "";
  ctx.pushSent.length = 0;
  ctx.smsSent.length = 0;
}

function seedCatalog() {
  ctx.stores.serviceablePincodes.set("pin-110001", {
    id: "pin-110001",
    pincode: "110001",
    active: true,
    tier: "fresh",
  });
  ctx.stores["mithai-products"].set(PRODUCT_ID, {
    id: PRODUCT_ID,
    slug: "kaju-katli",
    name: "Kaju Katli",
    freshnessStatus: "made-to-order",
  });
}

// Bootstrap the authenticated prefix of the flow: send OTP, capture the code,
// verify it, validate a cart. Returns the auth headers + snapshotId.
async function bootstrap() {
  const rSend = await sendOtp(req("POST", "/auth/otp/send", { phone: PHONE }) as never);
  expect(rSend.status).toBe(200);
  const requestId = ((await rSend.json()) as { data: { requestId: string } }).data.requestId;

  const rVerify = await verifyOtp(
    req("POST", "/auth/otp/verify", { requestId, code: ctx.capturedCode }) as never,
  );
  expect(rVerify.status).toBe(200);
  const vBody = (await rVerify.json()) as {
    data: { accessToken: string; customer: { id: string } };
  };
  const auth = { authorization: `Bearer ${vBody.data.accessToken}` };

  const rCart = await validateCart(
    req(
      "POST",
      "/cart/validate",
      { items: [{ productId: PRODUCT_ID, quantity: 2 }], pincode: "110001" },
      auth,
    ) as never,
  );
  expect(rCart.status).toBe(200);
  const snapshotId = ((await rCart.json()) as { data: { snapshotId: string } }).data.snapshotId;
  return { auth, snapshotId, customerId: vBody.data.customer.id };
}

describe("full checkout flow (integration)", () => {
  beforeAll(() => {
    // One RS256 keypair for the whole suite; JwtService is decoupled from
    // Payload (revocation is an injectable callback we leave unset).
    const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    ctx.jwt = new JwtService({
      privateKey: privateKey.export({ type: "pkcs8", format: "pem" }) as string,
      publicKey: publicKey.export({ type: "spki", format: "pem" }) as string,
      accessTtlSeconds: 900,
      refreshTtlSeconds: 2592000,
    });
  });

  beforeEach(() => {
    resetStores();
    seedCatalog();
    // Fresh fake services per test so instance-level overrides (e.g.
    // verifySignatureResult) never leak across cases.
    const otp = new FakeOtpService();
    vi.spyOn(otp, "send").mockImplementation(async (_phone, code) => {
      ctx.capturedCode = code;
      return { messageId: "fake-msg-1" };
    });
    ctx.otp = otp;
    ctx.pay = new FakePaymentService();
  });

  it("logs in → validates cart → creates order → verifies payment → confirms", async () => {
    const { auth, snapshotId, customerId } = await bootstrap();

    // create-order (idempotent)
    const rCreate = await createOrder(
      req(
        "POST",
        "/payments/razorpay/create-order",
        { snapshotId, deliveryAddressId: "addr-1" },
        { ...auth, "Idempotency-Key": "idem-create-1", "X-Client-Source": "mobile-ios" },
      ) as never,
    );
    expect(rCreate.status).toBe(200);
    const createBody = (await rCreate.json()) as {
      data: { orderId: string; razorpayOrderId: string; amountInPaise: number };
    };
    const { orderId, razorpayOrderId } = createBody.data;
    expect(razorpayOrderId).toMatch(/^order_fake_/);
    // order exists in pending_payment before payment is verified
    const pendingOrder = ctx.stores.orders.get(orderId);
    expect(pendingOrder?.status).toBe("pending_payment");
    expect(pendingOrder?.paymentStatus).toBe("pending");
    // a payments row was created in 'created' state
    const pendingPay = Array.from(ctx.stores.payments.values())[0];
    expect(pendingPay?.status).toBe("created");
    expect(pendingPay?.providerOrderId).toBe(razorpayOrderId);

    // verify payment → transitions pending_payment → confirmed
    const rVerify = await verifyPayment(
      req(
        "POST",
        "/payments/razorpay/verify",
        { orderId, razorpayPaymentId: "pay_fake_1", signature: "sig-anything" },
        { ...auth, "Idempotency-Key": "idem-verify-1" },
      ) as never,
    );
    expect(rVerify.status).toBe(200);
    const verifyBody = (await rVerify.json()) as { data: { order: { status: string; paymentStatus: string } } };
    expect(verifyBody.data.order.status).toBe("confirmed");
    expect(verifyBody.data.order.paymentStatus).toBe("paid");

    // state-machine + payment-row side effects persisted
    expect(ctx.stores.orders.get(orderId)?.status).toBe("confirmed");
    expect(ctx.stores.payments.get(Array.from(ctx.stores.payments.keys())[0]!)?.status).toBe(
      "captured",
    );

    // emitOrderEvent fan-out: 'confirmed' is SMS-enabled; no devices registered
    // so push is skipped (no tokens), SMS fires once to the customer's phone.
    expect(ctx.smsSent).toHaveLength(1);
    expect((ctx.smsSent[0] as { phone: string }).phone).toBe(PHONE);
    expect(ctx.pushSent).toHaveLength(0);

    // GET /orders list + GET /orders/:id read back the confirmed order
    const rList = await listOrders(req("GET", "/orders", null, auth) as never);
    expect(rList.status).toBe(200);
    const listBody = (await rList.json()) as { data: { items: { id: string }[]; total: number } };
    expect(listBody.data.total).toBe(1);
    expect(listBody.data.items[0]?.id).toBe(orderId);

    const rGet = await getOrder(
      req("GET", `/orders/${orderId}`, null, auth) as never,
      { params: Promise.resolve({ id: orderId }) },
    );
    expect(rGet.status).toBe(200);
    const fetched = ((await rGet.json()) as { data: { status: string; customerId: string } }).data;
    expect(fetched.status).toBe("confirmed");
    expect(fetched.customerId).toBe(customerId);
  });

  it("idempotent replay of create-order returns cached response and creates no duplicate order", async () => {
    const { auth, snapshotId } = await bootstrap();
    const headers = { ...auth, "Idempotency-Key": "idem-replay-1", "X-Client-Source": "mobile-ios" };
    const body = JSON.stringify({ snapshotId, deliveryAddressId: "addr-1" });

    const r1 = await createOrder(req("POST", "/payments/razorpay/create-order", body, headers) as never);
    expect(r1.status).toBe(200);
    const b1 = await r1.json();

    const r2 = await createOrder(req("POST", "/payments/razorpay/create-order", body, headers) as never);
    expect(r2.status).toBe(200);
    const b2 = await r2.json();

    // Cached response is byte-identical, and exactly ONE order was persisted.
    expect(b2).toEqual(b1);
    expect(ctx.stores.orders.size).toBe(1);
    expect(ctx.stores.payments.size).toBe(1);
  });

  it("payment signature failure leaves the order in pending_payment (402 PAYMENT_FAILED)", async () => {
    const { auth, snapshotId } = await bootstrap();
    // Flip the fake to reject the signature — fail-closed.
    (ctx.pay as FakePaymentService).verifySignatureResult = false;

    const rCreate = await createOrder(
      req(
        "POST",
        "/payments/razorpay/create-order",
        { snapshotId, deliveryAddressId: "addr-1" },
        { ...auth, "Idempotency-Key": "idem-create-sig", "X-Client-Source": "mobile-android" },
      ) as never,
    );
    const { orderId } = ((await rCreate.json()) as { data: { orderId: string } }).data;

    const rVerify = await verifyPayment(
      req(
        "POST",
        "/payments/razorpay/verify",
        { orderId, razorpayPaymentId: "pay_fake_1", signature: "bad" },
        { ...auth, "Idempotency-Key": "idem-verify-sig" },
      ) as never,
    );
    expect(rVerify.status).toBe(402);
    expect(((await rVerify.json()) as { error: { code: string } }).error.code).toBe("PAYMENT_FAILED");
    // Order + payment untouched by the failed verify.
    expect(ctx.stores.orders.get(orderId)?.status).toBe("pending_payment");
    expect(Array.from(ctx.stores.payments.values())[0]?.status).toBe("created");
    // No fan-out on a failed transition.
    expect(ctx.smsSent).toHaveLength(0);
  });
});
