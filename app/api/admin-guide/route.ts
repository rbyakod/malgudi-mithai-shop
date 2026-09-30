// app/api/admin-guide/route.ts
// Bridge from the shop admin's "Ask the admin guide" panel to the agent service's explain-only Admin Guide.
// Only a signed-in Payload admin whose role is allowed (ADMIN_GUIDE_ROLES, default "admin") can ask; the shared
// token stays on the server. The guide can explain settings; it cannot change anything.
import { NextRequest, NextResponse } from "next/server";
import { getPayloadAdminUser } from "../../../lib/api/adminAuth";
import { cleanGuideRequest, guideConfig, guideRoles, mayUseGuide } from "../../../lib/admin-guide";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // The widget sends this header; a plain cross-site form post cannot.
  if (req.headers.get("x-requested-with") !== "admin-guide") {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }
  const user = await getPayloadAdminUser(req);
  if (!user) return NextResponse.json({ error: "Sign in to the admin first." }, { status: 401 });
  if (!mayUseGuide(user, guideRoles())) {
    return NextResponse.json({ error: "The admin guide is not enabled for your role yet." }, { status: 403 });
  }
  const cfg = guideConfig();
  if (!cfg) return NextResponse.json({ error: "The admin guide is not set up on this server." }, { status: 503 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = null;
  }
  const clean = cleanGuideRequest(body);
  if (!clean) return NextResponse.json({ error: "Write a question of 1 to 2000 characters." }, { status: 400 });

  try {
    const upstream = await fetch(`${cfg.url}/guide/chat`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${cfg.token}`,
        "x-guide-user": `admin:${user.id}`,
      },
      body: JSON.stringify(clean),
      signal: AbortSignal.timeout(60_000),
    });
    const data = (await upstream.json().catch(() => ({ error: "The guide sent an unreadable answer." }))) as Record<string, unknown>;
    return NextResponse.json(upstream.ok ? { text: data.text } : { error: data.error ?? "The guide could not answer." }, { status: upstream.status });
  } catch {
    return NextResponse.json({ error: "The guide is not reachable right now." }, { status: 502 });
  }
}
