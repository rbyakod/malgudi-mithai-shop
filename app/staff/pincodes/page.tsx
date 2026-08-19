// app/staff/pincodes/page.tsx
// Delivery-area CSV import — admin roadmap Wave 2 (#129). Mounted at
// /staff/pincodes (avoids Payload's /admin catch-all); the import API route
// is the security boundary.
import { PincodesImport } from "@/components/admin/PincodesImport";

export default function Page() {
  return <PincodesImport />;
}

export const dynamic = "force-dynamic";
