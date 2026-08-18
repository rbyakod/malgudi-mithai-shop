// app/staff/orders-board/page.tsx
// Ops orders console route — Task 5.4, upgraded in known-gaps B13.
//
// Mounted at /staff/orders-board (NOT /admin/* to avoid colliding with
// Payload's admin shell catch-all, which owns /admin). Staff auth is
// enforced server-side by every route the console calls (the /api/staff
// feed, the hardened admin status route, collect-cash); the page itself
// renders a sign-in hint when those return 401.
import { OrdersBoard } from "@/components/admin/OrdersBoard";

export default function Page() {
  return <OrdersBoard />;
}

export const dynamic = "force-dynamic";
