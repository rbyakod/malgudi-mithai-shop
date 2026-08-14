// app/api/mobile/v1/account/loyalty-pass/route.ts
// Apple Wallet loyalty-pass generation — Task 19.1.
//
// GET generates (or refreshes) the customer's loyalty pass and returns a
// signed .pkpass URL the iOS client redeems via PKAddPassesViewController.
//
// Eligibility (spec §19): Silver at ≥2 delivered orders, Gold at ≥5. Below 2
// the route 404s — the customer has not qualified. The pass serial is stable
// per customer, so a WalletPasses row is upserted on first generation and
// reused thereafter; only the (24h-expiring) signed URL is regenerated.
//
// The actual .pkpass signing + upload lives in container.walletPassService
// (NodePassbookWalletService in prod, gated to FakeWalletService without Apple
// certs — Task 18.5). This route orchestrates eligibility + persistence; it
// never handles cert/crypto details directly.
//
// Path depth: app/api/mobile/v1/account/loyalty-pass/ = 6 dirs -> 6 `../`.
import { NextRequest } from 'next/server';
import { getPayload } from 'payload';
import config from '../../../../../../payload.config';
import { container } from '../../../../../../lib/container';
import { requireCustomer } from '../../../../../../lib/api/authMiddleware';
import { jsonResponse, errorResponse } from '../../../../../../lib/api/response';
import { ApiError, ErrorCode } from '../../../../../../lib/api/errors';
import { tierForDeliveredCount, loyaltySerialNumber } from '../../../../../../lib/loyalty/eligibility';

export async function GET(req: NextRequest) {
  const traceId = req.headers.get('X-Request-Id') ?? crypto.randomUUID();
  try {
    const { customerId } = await requireCustomer(req);
    const payload = await getPayload({ config });

    // --- Count delivered orders for tier resolution ----------------------
    const delivered = await payload.find({
      collection: 'orders',
      where: {
        and: [{ customerId: { equals: customerId } }, { status: { equals: 'delivered' } }],
      },
      limit: 0,
    });
    const deliveredCount = delivered.totalDocs ?? 0;
    const tier = tierForDeliveredCount(deliveredCount);
    if (!tier) {
      throw new ApiError(
        ErrorCode.NOT_FOUND,
        'Not eligible for a loyalty pass — requires at least 2 delivered orders',
      );
    }

    // --- Existing pass row (idempotent) ----------------------------------
    const serialNumber = loyaltySerialNumber(customerId);
    const existing = await payload.find({
      collection: 'walletPasses',
      where: { and: [{ customerId: { equals: customerId } }, { active: { equals: true } }] },
      limit: 1,
    });
    const existingRow = existing.docs[0] as { id: string } | undefined;

    // --- Customer name for the pass face --------------------------------
    const customer = (await payload.findByID({
      collection: 'customers',
      id: customerId,
    })) as { name?: string | null } | null;

    // --- Generate signed URL via the wallet adapter ---------------------
    const stored = await container.walletPassService.createSignedPassUrl({
      serialNumber,
      tier,
      holderName: customer?.name ?? undefined,
      balanceLabel: String(deliveredCount),
    });

    // --- Upsert the WalletPasses row ------------------------------------
    if (existingRow) {
      await payload.update({
        collection: 'walletPasses',
        id: existingRow.id,
        data: { tier }, // reflect tier upgrades (silver -> gold)
      });
    } else {
      await payload.create({
        collection: 'walletPasses',
        data: { customerId, serialNumber, tier, active: true },
      });
    }

    return jsonResponse(
      { url: stored.url, serialNumber, tier },
      { headers: { 'X-Request-Id': traceId } },
    );
  } catch (err) {
    return errorResponse(err, traceId);
  }
}
