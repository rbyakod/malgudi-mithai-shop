// app/staff/orders-board/page.tsx
// Ops orders board route — Task 5.4.
//
// Mounted at /staff/orders-board (NOT /admin/* to avoid colliding with
// Payload's admin shell catch-all, which owns /admin). Staff auth is enforced
// by the admin status route the board calls; harden this page with middleware
// when the staff session lands.
import { OrdersBoard } from "@/components/admin/OrdersBoard";

export default function Page() {
  return <OrdersBoard />;
}

export const dynamic = "force-dynamic";
