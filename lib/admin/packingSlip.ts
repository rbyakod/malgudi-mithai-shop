// lib/admin/packingSlip.ts
// Pure projection from a populated Orders doc to the packing-slip DTO the
// staff console prints (admin roadmap #126). The route fetches at depth 1
// so customerId and deliveryAddressId arrive populated; this module stays
// fetch-free so the mapping is unit-testable (same split as ordersBoard).

export interface PackingSlipLine {
  name: string;
  packLabel: string | null;
  quantity: number;
  unit: string;
  lineTotalInPaise: number;
}

export interface PackingSlipAddress {
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  pincode: string;
}

export interface PackingSlipData {
  id: string;
  shortId: string;
  placedAt: string | null;
  customerName: string | null;
  phone: string | null;
  address: PackingSlipAddress | null;
  lines: PackingSlipLine[];
  itemsTotalInPaise: number | null;
  deliveryFeeInPaise: number | null;
  discountInPaise: number | null;
  totalInPaise: number | null;
  slotDate: string | null;
  slotWindow: string | null;
  paymentMethod: "cod" | "razorpay";
  paymentStatus: string | null;
  couponCode: string | null;
  status: string | null;
}

type Loose = Record<string, unknown>;

const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);
const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

export function toPackingSlip(doc: Loose): PackingSlipData {
  const customer = doc.customerId as Loose | string | undefined;
  const address = doc.deliveryAddressId as Loose | string | undefined;
  const totals = (doc.totals ?? {}) as Loose;
  const slot = (doc.slot ?? {}) as Loose;
  const items = Array.isArray(doc.items) ? (doc.items as Loose[]) : [];
  const id = String(doc.id ?? "");

  return {
    id,
    shortId: id.slice(-6),
    placedAt: str(doc.createdAt),
    customerName:
      customer && typeof customer === "object" ? str(customer.name) : null,
    phone: customer && typeof customer === "object" ? str(customer.phone) : null,
    address:
      address && typeof address === "object"
        ? {
            line1: str(address.line1) ?? "",
            line2: str(address.line2),
            city: str(address.city) ?? "",
            state: str(address.state) ?? "",
            pincode: str(address.pincode) ?? "",
          }
        : null,
    lines: items.map((it) => ({
      name: str(it.name) ?? "Item",
      packLabel: str(it.packLabel),
      quantity: num(it.quantity) ?? 1,
      unit: str(it.unit) ?? "",
      lineTotalInPaise: (num(it.priceInPaise) ?? 0) * (num(it.quantity) ?? 1),
    })),
    itemsTotalInPaise: num(totals.itemsTotalInPaise),
    deliveryFeeInPaise: num(totals.deliveryFeeInPaise),
    discountInPaise: num(totals.discountInPaise),
    totalInPaise: num(totals.totalInPaise),
    slotDate: str(slot.date),
    slotWindow: str(slot.window),
    paymentMethod: doc.paymentMethod === "cod" ? "cod" : "razorpay",
    paymentStatus: str(doc.paymentStatus),
    couponCode: str(doc.couponCode),
    status: str(doc.status),
  };
}

// ₹ with Indian digit grouping, paise-aware decimals — matches RupeeCell.
export function slipRupees(paise: number | null | undefined): string {
  if (paise == null) return "—";
  const rupees = paise / 100;
  const hasPaise = Math.round(paise) % 100 !== 0;
  const formatted = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: hasPaise ? 2 : 0,
    maximumFractionDigits: hasPaise ? 2 : 0,
  }).format(rupees);
  return `₹${formatted}`;
}
