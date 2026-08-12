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

type LeadsResponse = {
  docs: LeadRow[];
  totalDocs: number;
};

export async function fetchRecentLeads(limit = 5): Promise<LeadRow[]> {
  const data = await apiGet<LeadsResponse>(
    `/leads?limit=${limit}&sort=-createdAt&depth=0`
  );
  return data.docs;
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
