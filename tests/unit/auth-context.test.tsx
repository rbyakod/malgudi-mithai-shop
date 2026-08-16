// tests/unit/auth-context.test.tsx
// Unit tests for context/AuthContext — the web session store. The critical
// assertions mirror CartContext's hydration discipline: the very first
// render (server and first client paint) must see `session = null`,
// `ready = false` even when localStorage already holds a session, and the
// restore happens only in a post-hydration effect.

import {describe, it, expect, vi, beforeEach, afterEach} from "vitest";
import {render, screen, fireEvent, act, waitFor} from "@testing-library/react";
import {
  AuthProvider,
  useAuth,
  type AuthSession,
} from "@/context/AuthContext";

const STORAGE_KEY = "mishran-auth-v1";

const SESSION: AuthSession = {
  accessToken: "access-1",
  refreshToken: "refresh-1",
  customer: {
    id: "cus_1",
    phone: "+919876543210",
    name: "Asha Rao",
    email: null,
    locale: "en",
  },
};

// Every render pass records the frame it saw — lets us assert on the FIRST
// client render (pre-effect), not just the settled post-effect state.
const frames: Array<{ready: boolean; signedIn: boolean}> = [];

function Probe() {
  const {session, ready, signIn, signOut} = useAuth();
  frames.push({ready, signedIn: session !== null});
  return (
    <div>
      <p data-testid="probe">
        {!ready ? "loading" : session ? session.customer.name : "signed-out"}
      </p>
      <p data-testid="phone">{session?.customer.phone ?? ""}</p>
      <button data-testid="sign-in" onClick={() => signIn(SESSION)}>
        sign in
      </button>
      <button data-testid="sign-out" onClick={() => void signOut()}>
        sign out
      </button>
    </div>
  );
}

beforeEach(() => {
  frames.length = 0;
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe("AuthProvider hydration discipline", () => {
  it("first render sees session=null even with a saved session in localStorage", () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(SESSION));
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    // The pre-effect frame must be the empty one — this is what the server
    // also renders, so hydration can never mismatch.
    expect(frames[0]).toEqual({ready: false, signedIn: false});
    // Post-hydration effect restores the session.
    expect(frames[frames.length - 1]).toEqual({ready: true, signedIn: true});
    expect(screen.getByTestId("probe").textContent).toBe("Asha Rao");
  });

  it("renders signed-out when storage is empty", () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    expect(frames[frames.length - 1]).toEqual({ready: true, signedIn: false});
    expect(screen.getByTestId("probe").textContent).toBe("signed-out");
  });

  it("discards malformed storage and stays signed out", () => {
    window.localStorage.setItem(STORAGE_KEY, "{not json");
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    expect(screen.getByTestId("probe").textContent).toBe("signed-out");
  });

  it("rejects a structurally invalid saved session (no tokens)", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({customer: SESSION.customer}),
    );
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    expect(screen.getByTestId("probe").textContent).toBe("signed-out");
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});

describe("AuthProvider sign-in / sign-out", () => {
  it("signIn persists the session to localStorage", () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    fireEvent.click(screen.getByTestId("sign-in"));
    expect(screen.getByTestId("probe").textContent).toBe("Asha Rao");
    const raw = window.localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw as string)).toEqual(SESSION);
  });

  it("signOut clears local state immediately and best-effort revokes the refresh token", async () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(SESSION));
    const calls: Array<{url: string; init: RequestInit}> = [];
    const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      calls.push({url: String(url), init: init ?? {}});
      return new Response(JSON.stringify({data: {ok: true}}), {status: 200});
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => {
      expect(screen.getByTestId("probe").textContent).toBe("Asha Rao");
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("sign-out"));
    });

    // Local state + storage cleared…
    expect(screen.getByTestId("probe").textContent).toBe("signed-out");
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    // …and exactly one best-effort logout call carrying the REFRESH token.
    const logout = calls.find((c) => c.url.endsWith("/auth/logout"));
    expect(logout).toBeDefined();
    expect(logout?.init.method).toBe("POST");
    const headers = logout?.init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer refresh-1");
    expect(headers["X-Client-Source"]).toBe("web");
  });

  it("signOut stays local-clear even when the logout call fails", async () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(SESSION));
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => {
      expect(screen.getByTestId("probe").textContent).toBe("Asha Rao");
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId("sign-out"));
    });
    expect(screen.getByTestId("probe").textContent).toBe("signed-out");
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("signOut with no session makes no logout call", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", {status: 200}));
    vi.stubGlobal("fetch", fetchMock);
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await act(async () => {
      fireEvent.click(screen.getByTestId("sign-out"));
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
