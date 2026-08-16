// lib/web/apiClient.ts
// Typed fetch client for the web storefront's calls into the mobile API
// surface (/api/mobile/v1) — the same endpoints the iOS/Android apps use.
// Plain fetch (no TanStack provider) so islands can call it from event
// handlers and effects without a query cache.
//
// Responsibilities:
//   - `X-Client-Source: web` on every call (the API rejects unknown sources).
//   - Bearer access token when a session exists.
//   - `Idempotency-Key` header support for payment POSTs (create-order).
//   - Unwraps the `{data}` success envelope and typed errors from
//     `{error: {code, message, fieldErrors, traceId}}` (lib/api/response.ts).
//   - SINGLE-FLIGHT refresh: the server rotates refresh tokens and revokes
//     the old jti (auth/refresh/route.ts), so two parallel 401s each firing
//     their own refresh would self-destruct — the second refresh would use a
//     revoked token and sign the customer out. One module-level in-flight
//     promise is shared by every concurrent 401; on success each caller
//     retries its request exactly once.
//   - Refresh failure (revoked/expired) → `onSessionExpired()` so
//     AuthContext can clear the session; callers see ApiClientError.

export const API_BASE = "/api/mobile/v1";

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fieldErrors?: Record<string, string>;
  readonly traceId?: string;

  constructor(
    message: string,
    opts: {
      status: number;
      code: string;
      fieldErrors?: Record<string, string>;
      traceId?: string;
    },
  ) {
    super(message);
    this.name = "ApiClientError";
    this.status = opts.status;
    this.code = opts.code;
    this.fieldErrors = opts.fieldErrors;
    this.traceId = opts.traceId;
  }
}

/**
 * Bridge between the module-level client and the React session state.
 * AuthContext binds an implementation on mount; `getAccessToken` /
 * `getRefreshToken` read live values (no stale closure risk), and the two
 * callbacks let the client persist rotated tokens / force sign-out.
 */
export type AuthBindings = {
  getAccessToken(): string | null;
  getRefreshToken(): string | null;
  onTokensRotated(accessToken: string, refreshToken: string): void;
  onSessionExpired(): void;
};

let bindings: AuthBindings | null = null;

export function bindAuth(b: AuthBindings | null): void {
  bindings = b;
}

// ---- Single-flight refresh -------------------------------------------------

let refreshInFlight: Promise<{accessToken: string; refreshToken: string}> | null =
  null;

async function performRefresh(): Promise<{
  accessToken: string;
  refreshToken: string;
  }> {
  const refreshToken = bindings?.getRefreshToken() ?? null;
  if (!refreshToken) {
    throw new ApiClientError("No session to refresh.", {
      status: 401,
      code: "TOKEN_EXPIRED",
    });
  }
  // The refresh route reads the refresh token from the Authorization header
  // (body-JSON bearer only — there are no auth cookies anywhere).
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Client-Source": "web",
        Authorization: `Bearer ${refreshToken}`,
      },
    });
  } catch {
    throw new ApiClientError("Network error while refreshing session.", {
      status: 0,
      code: "NETWORK",
    });
  }
  if (!res.ok) {
    const body = (await safeErrorBody(res)) as {
      error?: {code?: string; message?: string; traceId?: string};
    };
    throw new ApiClientError(
      body.error?.message ?? "Session expired — please sign in again.",
      {
        status: res.status,
        code: body.error?.code ?? "TOKEN_REVOKED",
        traceId: body.error?.traceId,
      },
    );
  }
  const body = (await res.json()) as {
    data?: {accessToken?: string; refreshToken?: string};
  };
  const data = body.data;
  if (!data?.accessToken || !data.refreshToken) {
    throw new ApiClientError("Malformed refresh response.", {
      status: 500,
      code: "INTERNAL",
    });
  }
  return {accessToken: data.accessToken, refreshToken: data.refreshToken};
}

/** One refresh at a time, shared by every concurrent 401. */
function singleFlightRefresh(): Promise<{
  accessToken: string;
  refreshToken: string;
}> {
  if (!refreshInFlight) {
    refreshInFlight = performRefresh().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

// ---- Main entry ------------------------------------------------------------

export type ApiRequestInit = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  /** Sets the `Idempotency-Key` header (payment POSTs). */
  idempotencyKey?: string;
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

async function safeErrorBody(
  res: Response,
): Promise<{error?: {code?: string; message?: string; fieldErrors?: Record<string, string>; traceId?: string}} | null> {
  try {
    return (await res.json()) as {
      error?: {
        code?: string;
        message?: string;
        fieldErrors?: Record<string, string>;
        traceId?: string;
      };
    };
  } catch {
    return null;
  }
}

function toApiClientError(
  status: number,
  body: Awaited<ReturnType<typeof safeErrorBody>>,
): ApiClientError {
  const err = body?.error;
  return new ApiClientError(err?.message ?? `Request failed (${status}).`, {
    status,
    code: err?.code ?? "INTERNAL",
    fieldErrors: err?.fieldErrors,
    traceId: err?.traceId,
  });
}

async function runFetch(
  path: string,
  init: ApiRequestInit,
  accessToken: string | null,
): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    method: init.method ?? "GET",
    signal: init.signal,
    headers: {
      "X-Client-Source": "web",
      ...(accessToken ? {Authorization: `Bearer ${accessToken}`} : {}),
      ...(init.idempotencyKey ? {"Idempotency-Key": init.idempotencyKey} : {}),
      ...(init.body !== undefined
        ? {"Content-Type": "application/json"}
        : {}),
      ...init.headers,
    },
    ...(init.body !== undefined ? {body: JSON.stringify(init.body)} : {}),
  });
}

/**
 * Fetch a mobile-API endpoint and return the unwrapped `data` payload.
 *
 * On a 401 `TOKEN_EXPIRED` the client refreshes once (single-flight, shared
 * with any concurrent caller) and retries the original request exactly once.
 */
export async function apiFetch<T = unknown>(
  path: string,
  init: ApiRequestInit = {},
): Promise<T> {
  let accessToken = bindings?.getAccessToken() ?? null;
  let res = await runFetch(path, init, accessToken);

  if (res.status === 401) {
    const body = await safeErrorBody(res);
    const code = body?.error?.code;
    if (code !== "TOKEN_EXPIRED") {
      throw toApiClientError(res.status, body);
    }
    // Access token expired (or invalid). One shared refresh, then one retry.
    let rotated: {accessToken: string; refreshToken: string};
    try {
      rotated = await singleFlightRefresh();
    } catch (err) {
      // Refresh failed — revoked/rotated elsewhere or expired. Sign out.
      bindings?.onSessionExpired();
      if (err instanceof ApiClientError) throw err;
      throw new ApiClientError("Session expired — please sign in again.", {
        status: 401,
        code: "TOKEN_EXPIRED",
      });
    }
    bindings?.onTokensRotated(rotated.accessToken, rotated.refreshToken);
    accessToken = rotated.accessToken;
    res = await runFetch(path, init, accessToken);
    if (res.status === 401) {
      // Rotated token still rejected — the session is unusable. Sign out.
      const retryBody = await safeErrorBody(res);
      bindings?.onSessionExpired();
      throw toApiClientError(res.status, retryBody);
    }
  }

  if (!res.ok) {
    throw toApiClientError(res.status, await safeErrorBody(res));
  }
  if (res.status === 204) return undefined as T;
  const body = (await res.json()) as {data?: T};
  return body.data as T;
}
