// lib/addresses/defaultInvariant.ts
// Shared helper enforcing the "at most one default address per customer"
// invariant — Task 5.3 (Mishran Mobile Apps v1).
//
// Both the addresses create route and the [id] PATCH route call this before
// flipping isDefault to true, so the invariant holds regardless of entry
// point. `exceptId` lets the PATCH path preserve the row currently being
// promoted (no clear-then-set churn).
import type { Payload } from 'payload';

export async function clearDefaultAddress(
  payload: Payload,
  customerId: string,
  exceptId?: string,
): Promise<void> {
  const prior = await payload.find({
    collection: 'addresses',
    where: { and: [{ customerId: { equals: customerId } }, { isDefault: { equals: true } }] },
    limit: 1,
  });
  const doc = prior.docs[0] as { id: string } | undefined;
  if (doc && doc.id !== exceptId) {
    await payload.update({ collection: 'addresses', id: doc.id, data: { isDefault: false } });
  }
}
