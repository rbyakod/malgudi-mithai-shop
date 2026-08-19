// Thin fetch wrappers for dashboard widgets.
// All endpoints are Payload REST routes auto-authed by the admin session cookie.

const API_BASE = "/api";

export type LeadStatus =
  | "new"
  | "contacted"
  | "qualified"
  | "won"
  | "lost";

export type LeadRow = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  status?: LeadStatus;
  createdAt: string;
};

export type MithaiFreshnessGroups = {
  "made-daily": MithaiRow[];
  "made-to-order": MithaiRow[];
  "batch-frozen": MithaiRow[];
};

export type MithaiRow = {
  id: string;
  name: string;
  slug?: string;
  freshnessStatus?: "made-daily" | "made-to-order" | "batch-frozen";
  family?: string;
};

export type StoryRow = {
  id: string;
  title?: string;
  name?: string;
  pillar?: string;
  updatedAt: string;
};

export type CatalogCounts = {
  "mithai-products": number | null;
  "qsr-menu-items": number | null;
  "snack-products": number | null;
  "merch-products": number | null;
  "gift-boxes": number | null;
};

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "same-origin",
    headers: {Accept: "application/json"},
  });
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText} on ${path}`);
  }
  return res.json() as Promise<T>;
}

async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "PATCH",
    credentials: "same-origin",
    headers: {Accept: "application/json", "Content-Type": "application/json"},
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText} on ${path}`);
  }
  return res.json() as Promise<T>;
}

type LeadDoc = {
  id: string;
  contact?: {name?: string; email?: string; phone?: string};
  status: LeadStatus;
  createdAt: string;
};

type LeadsResponse = {
  docs: LeadDoc[];
  totalDocs: number;
};

export async function fetchRecentLeads(limit = 5): Promise<LeadRow[]> {
  const data = await apiGet<LeadsResponse>(
    `/leads?limit=${limit}&sort=-createdAt&depth=0`
  );
  return data.docs.map((doc): LeadRow => ({
    id: doc.id,
    name: doc.contact?.name ?? "",
    email: doc.contact?.email,
    phone: doc.contact?.phone,
    status: doc.status,
    createdAt: doc.createdAt,
  }));
}

export async function updateLeadStatus(id: string, status: LeadStatus): Promise<void> {
  await apiPatch(`/leads/${id}`, {status});
}

type MithaiResponse = {
  docs: MithaiRow[];
};

export async function fetchMithaiByFreshness(): Promise<MithaiFreshnessGroups> {
  // Fetch up to 20 published mithai, group client-side by freshnessStatus.
  // Single query keeps payload light; server-side grouping requires custom
  // endpoint which is out of scope for this admin-only view.
  const data = await apiGet<MithaiResponse>(
    `/mithai-products?limit=20&depth=0&sort=-updatedAt&where[_status][equals]=published`
  );
  const groups: MithaiFreshnessGroups = {
    "made-daily": [],
    "made-to-order": [],
    "batch-frozen": [],
  };
  for (const row of data.docs) {
    const key = row.freshnessStatus;
    if (key && key in groups) groups[key].push(row);
  }
  return groups;
}

type StoriesResponse = {
  docs: StoryRow[];
};

export async function fetchPendingStories(
  limit = 5
): Promise<StoryRow[]> {
  const data = await apiGet<StoriesResponse>(
    `/stories?limit=${limit}&sort=-updatedAt&depth=0&where[_status][equals]=draft&draft=true`
  );
  return data.docs;
}

type CountResponse = {totalDocs: number};

export async function fetchCatalogCounts(): Promise<CatalogCounts> {
  const collections = [
    "mithai-products",
    "qsr-menu-items",
    "snack-products",
    "merch-products",
    "gift-boxes",
  ] as const;

  const entries = await Promise.all(
    collections.map(async coll => {
      try {
        const data = await apiGet<CountResponse>(`/${coll}?limit=0&depth=0`);
        return [coll, data.totalDocs] as const;
      } catch {
        return [coll, null] as const;
      }
    })
  );

  return Object.fromEntries(entries) as CatalogCounts;
}

export type OrdersPulse = {
  toFulfill: number | null;
  codPending: number | null;
  paidTodayPaise: number | null;
  paidLast7dPaise: number | null;
};

type OrderTotalDoc = {
  createdAt: string;
  totals?: {totalInPaise?: number};
};

// Audit §07: ops KPI strip. Each metric is an independent query wrapped in
// its own catch so one failing endpoint degrades to null ("—" in the UI)
// instead of killing the whole row.
export async function fetchOrdersPulse(): Promise<OrdersPulse> {
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [toFulfill, codPending, paidDocs] = await Promise.all([
    apiGet<CountResponse>(
      `/orders?limit=1&depth=0` +
        `&where[and][0][status][in]=confirmed,packed,dispatched,out_for_delivery`
    )
      .then(data => data.totalDocs)
      .catch(() => null),
    apiGet<CountResponse>(
      `/orders?limit=1&depth=0` +
        `&where[and][0][paymentMethod][equals]=cod` +
        `&where[and][1][paymentStatus][equals]=pending`
    )
      .then(data => data.totalDocs)
      .catch(() => null),
    // Paid revenue is summed client-side — Payload has no server-side
    // aggregation endpoint. Limited to the 200 most recent paid orders in
    // the 7-day window, selecting only createdAt + the total. Exact at
    // current volumes; revisit if weekly paid orders approach 200.
    apiGet<{docs: OrderTotalDoc[]}>(
      `/orders?limit=200&depth=0&sort=-createdAt` +
        `&select[createdAt]=true&select[totals][totalInPaise]=true` +
        `&where[and][0][paymentStatus][equals]=paid` +
        `&where[and][1][createdAt][greater_than]=${encodeURIComponent(sevenDaysAgo.toISOString())}`
    )
      .then(data => data.docs)
      .catch(() => null as OrderTotalDoc[] | null),
  ]);

  let paidTodayPaise = 0;
  let paidLast7dPaise = 0;
  if (paidDocs) {
    for (const doc of paidDocs) {
      const paise = doc.totals?.totalInPaise ?? 0;
      paidLast7dPaise += paise;
      if (new Date(doc.createdAt) >= startOfToday) paidTodayPaise += paise;
    }
  }

  return {
    toFulfill,
    codPending,
    paidTodayPaise: paidDocs ? paidTodayPaise : null,
    paidLast7dPaise: paidDocs ? paidLast7dPaise : null,
  };
}

export async function fetchPendingReviewCount(): Promise<number | null> {
  try {
    const data = await apiGet<CountResponse>(
      `/reviews?limit=1&depth=0&where[status][equals]=pending`
    );
    return data.totalDocs;
  } catch {
    return null;
  }
}
