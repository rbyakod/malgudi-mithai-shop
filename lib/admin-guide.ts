// lib/admin-guide.ts
// Helpers for the Admin Guide: an explain-only assistant inside this shop's admin (/admin). The browser widget
// (served by the agent service) posts to /api/admin-guide; that route checks the person is a signed-in admin,
// then forwards the question to the agent service with a shared token. The token never reaches the browser.
//
// Env (server only):
//   AGENT_SERVICE_URL   the agent service's admin API, e.g. http://127.0.0.1:3082/api/team-admin
//   AGENT_GUIDE_TOKEN   shared secret, at least 32 characters (same value on the agent service)
//   ADMIN_GUIDE_ROLES   comma-separated user roles that may ask; default "admin" (the owner). Add
//                       "editor,ops" later to let shop staff use it.

export interface GuideConfig {
  url: string;
  token: string;
}

export interface GuideRequest {
  message: string;
  history: { role: "user" | "assistant"; content: string }[];
  page: string;
}

export function guideRoles(raw: string | undefined = process.env.ADMIN_GUIDE_ROLES): string[] {
  const roles = (raw ?? "admin")
    .split(",")
    .map((r) => r.trim())
    .filter(Boolean);
  return roles.length ? roles : ["admin"];
}

export function mayUseGuide(
  user: { role?: string } | undefined,
  roles: string[] = guideRoles(),
): boolean {
  return Boolean(user && user.role && roles.includes(user.role));
}

export function guideConfig(env: Record<string, string | undefined> = process.env): GuideConfig | null {
  const url = (env.AGENT_SERVICE_URL ?? "").trim().replace(/\/$/, "");
  const token = env.AGENT_GUIDE_TOKEN ?? "";
  if (!url || token.length < 32) return null;
  return { url, token };
}

/** Keeps only what the guide needs, capped, so nothing else from the browser is forwarded. */
export function cleanGuideRequest(body: unknown): GuideRequest | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const message = typeof b.message === "string" ? b.message.trim() : "";
  if (!message || message.length > 2000) return null;
  const history: GuideRequest["history"] = [];
  if (Array.isArray(b.history)) {
    for (const m of b.history.slice(-8)) {
      if (!m || typeof m !== "object") continue;
      const { role, content } = m as { role?: unknown; content?: unknown };
      if ((role === "user" || role === "assistant") && typeof content === "string" && content.trim()) {
        history.push({ role, content: content.trim().slice(0, 1500) });
      }
    }
  }
  const page = typeof b.page === "string" ? b.page.replace(/[\u0000-\u001f]/g, " ").slice(0, 200) : "";
  return { message, history, page };
}
