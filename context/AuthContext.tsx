"use client";

// context/AuthContext.tsx
// Customer auth session for the web storefront — the web counterpart of the
// apps' token stores. Tokens are body-JSON bearer only (no cookies), so the
// session lives in React state + localStorage, exactly like the cart.
//
// Hydration discipline — copied verbatim from CartContext: always init
// empty, restore in a post-hydration effect, never read localStorage during
// render. Server and first client render both see `session = null`,
// `ready = false`; `ready` flips once after mount so account islands can
// distinguish "not restored yet" from "signed out" without flashing the
// signed-out state.
//
// The provider also binds lib/web/apiClient's auth bridge: the client reads
// live tokens for Bearer headers, persists rotated refresh pairs (the server
// revokes the old jti on every refresh), and forces sign-out when a refresh
// fails (revoked/expired).

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from "react";
import {
  API_BASE,
  bindAuth,
} from "@/lib/web/apiClient";

export type AuthCustomer = {
  id: string;
  phone: string;
  name: string | null;
  email: string | null;
  locale: string;
};

export type AuthSession = {
  accessToken: string;
  refreshToken: string;
  customer: AuthCustomer;
};

type AuthContextType = {
  session: AuthSession | null;
  /** False until the post-hydration localStorage restore has run. */
  ready: boolean;
  signIn: (session: AuthSession) => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = "mishran-auth-v1";

function isSession(value: unknown): value is AuthSession {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<AuthSession> & {customer?: Partial<AuthCustomer>};
  return (
    typeof v.accessToken === "string" &&
    v.accessToken.length > 0 &&
    typeof v.refreshToken === "string" &&
    v.refreshToken.length > 0 &&
    !!v.customer &&
    typeof v.customer.id === "string" &&
    typeof v.customer.phone === "string"
  );
}

export function AuthProvider({children}: {children: ReactNode}) {
  // Always init signed-out — NEVER read localStorage in the initializer.
  const [session, setSession] = useState<AuthSession | null>(null);
  const [ready, setReady] = useState(false);
  // Live mirror of the session for the apiClient bridge — event handlers and
  // fetch callbacks read the ref so they never close over stale tokens.
  const sessionRef = useRef<AuthSession | null>(null);

  // After mount, load any saved session from localStorage.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        if (isSession(parsed)) {
          // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot load of persisted state after hydration; safe because server and first client render both see null
          setSession(parsed);
        } else {
          window.localStorage.removeItem(STORAGE_KEY);
        }
      }
    } catch {
      // ignore malformed storage
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot readiness flag after the restore pass
    setReady(true);
  }, []);

  // Keep the ref current (after commit, before any user-triggered fetch).
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  // Persist (or clear) whenever the session changes — after the restore pass.
  useEffect(() => {
    if (!ready) return;
    try {
      if (session) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // ignore quota errors
    }
  }, [session, ready]);

  // Bridge the apiClient: Bearer source of truth + rotation callbacks.
  useEffect(() => {
    bindAuth({
      getAccessToken: () => sessionRef.current?.accessToken ?? null,
      getRefreshToken: () => sessionRef.current?.refreshToken ?? null,
      onTokensRotated: (accessToken, refreshToken) => {
        setSession((prev) =>
          prev ? {...prev, accessToken, refreshToken} : prev,
        );
      },
      onSessionExpired: () => {
        setSession(null);
      },
    });
    return () => bindAuth(null);
  }, []);

  const signIn = useCallback((next: AuthSession) => {
    setSession(next);
  }, []);

  // Best-effort server logout (revokes the refresh jti). The local session
  // is cleared immediately regardless of the network outcome — a failed
  // logout call must never keep a signed-out customer "signed in" locally.
  const signOut = useCallback(async () => {
    const current = sessionRef.current;
    setSession(null);
    if (!current) return;
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Client-Source": "web",
          // The logout route verifies the REFRESH token (it revokes its jti).
          Authorization: `Bearer ${current.refreshToken}`,
        },
      });
    } catch {
      // best-effort — local state is already cleared
    }
  }, []);

  const value: AuthContextType = useMemo(
    () => ({session, ready, signIn, signOut}),
    [session, ready, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
