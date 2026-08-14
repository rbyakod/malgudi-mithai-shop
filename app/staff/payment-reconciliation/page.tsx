// app/staff/payment-reconciliation/page.tsx
// Payment reconciliation route — Task 5.5. Mounted at /staff/payment-reconciliation
// (avoids Payload's /admin catch-all).
import { PaymentReconciliation } from "@/components/admin/PaymentReconciliation";

export default function Page() {
  return <PaymentReconciliation />;
}

export const dynamic = "force-dynamic";
