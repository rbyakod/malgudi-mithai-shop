// context/QueryProvider.tsx
// Client-side QueryClientProvider for TanStack Query v5.
// Mounted once in app/layout.tsx so every client component (lead forms,
// future cart mutations, etc.) can call useMutation / useQuery without
// re-instantiating a QueryClient per route.

"use client";

import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {useState, type ReactNode} from "react";

export function QueryProvider({children}: {children: ReactNode}) {
  // useState so the client is stable across renders per browser session.
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {staleTime: 60_000, retry: 1},
        },
      }),
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
