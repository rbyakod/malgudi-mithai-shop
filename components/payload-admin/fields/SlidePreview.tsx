"use client";

// Home Hero (#127): per-slide thumbnail preview inside the admin global.
//
// A ui field rendered inside each slides[] row. The slide's `product` value
// lives at the sibling form path, so this component reads it via useField,
// fetches the product doc (module-level cache keyed by product — reordering
// rows re-renders neighbors without refetching), and renders the same 48px
// thumb treatment the product list views use (MediaThumb for bare media IDs).
import Image from "next/image";
import { useEffect, useState } from "react";
import { useField } from "@payloadcms/ui/forms/useField";
import MediaThumb from "../cells/MediaThumb";
import {
  pickImage,
  type ProductCellBehavior,
} from "../cells/ProductNameCell";
import {
  giftBoxBehavior,
  merchBehavior,
  mithaiBehavior,
  qsrBehavior,
  snackBehavior,
} from "../cells/product-cell-behaviors";

const BEHAVIORS: Record<string, { behavior: ProductCellBehavior; label: string }> = {
  "mithai-products": { behavior: mithaiBehavior, label: "Mithai" },
  "qsr-menu-items": { behavior: qsrBehavior, label: "QSR" },
  "snack-products": { behavior: snackBehavior, label: "Snacks" },
  "merch-products": { behavior: merchBehavior, label: "Merch" },
  "gift-boxes": { behavior: giftBoxBehavior, label: "Gift box" },
};

type Resolved = { name: string; mediaId?: string; url?: string; alt?: string };

const productKey = (relationTo: string, id: string) => `${relationTo}/${id}`;

// Resolved product summaries + in-flight fetches, shared across every row.
const productCache = new Map<string, Resolved | null>();
const inFlight = new Map<string, Promise<void>>();

function resolveProduct(relationTo: string, id: string): Promise<void> {
  const k = productKey(relationTo, id);
  if (productCache.has(k)) return Promise.resolve();
  const pending = inFlight.get(k);
  if (pending) return pending;
  const fetchIt = (async () => {
    try {
      const res = await fetch(`/api/${relationTo}/${id}?depth=0`, {
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error(String(res.status));
      const doc = (await res.json()) as Record<string, unknown>;
      const entry = BEHAVIORS[relationTo];
      const image =
        entry ? pickImage(doc as { id: string }, entry.behavior.image) : null;
      productCache.set(k, {
        name: typeof doc.name === "string" ? doc.name : id,
        mediaId: image && "mediaId" in image ? image.mediaId : undefined,
        url: image && "url" in image ? image.url : undefined,
        alt: image?.alt,
      });
    } catch {
      productCache.set(k, null); // deleted/hidden product: keep placeholder
    } finally {
      inFlight.delete(k);
    }
  })();
  inFlight.set(k, fetchIt);
  return fetchIt;
}

export function SlidePreview({ path }: { path?: string }) {
  // This ui field lives at `slides.<i>.slidePreview`; product is the sibling.
  const productPath = path
    ? `${path.slice(0, path.lastIndexOf("."))}.product`
    : "product";
  const { value } = useField<
    string | { relationTo: string; value: string } | undefined
  >({ path: productPath });

  const relationTo =
    value && typeof value === "object" ? value.relationTo : undefined;
  const id =
    value && typeof value === "object" ? String(value.value) : value || undefined;

  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  useEffect(() => {
    if (!relationTo || !id) return;
    let alive = true;
    void resolveProduct(relationTo, id).then(() => {
      if (alive) setLoadedFor(productKey(relationTo, id));
    });
    return () => {
      alive = false;
    };
  }, [relationTo, id]);

  if (!relationTo || !id) {
    return (
      <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--t-text-muted)" }}>
        Pick a product to see its slide preview.
      </p>
    );
  }

  const k = productKey(relationTo, id);
  const resolved = productCache.get(k);
  const ready = loadedFor === k && resolved !== undefined;
  const label = BEHAVIORS[relationTo]?.label ?? relationTo;

  let thumb: React.ReactNode = (
    <div
      className="mishran-cell-fallback"
      style={{
        width: 48,
        height: 48,
        borderRadius: "6px",
        background: "var(--t-bg-control)",
      }}
    />
  );
  if (ready && resolved?.mediaId) {
    thumb = <MediaThumb id={resolved.mediaId} alt={resolved.alt ?? resolved.name} />;
  } else if (ready && resolved?.url) {
    thumb = (
      <Image
        src={resolved.url}
        alt={resolved.alt ?? resolved.name}
        width={48}
        height={48}
        style={{ objectFit: "cover", borderRadius: "6px", border: "1px solid var(--t-border)" }}
      />
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
      {thumb}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.125rem" }}>
        <span style={{ fontWeight: 500, color: "var(--t-text)" }}>
          {ready && resolved ? resolved.name : "Loading product…"}
        </span>
        <span style={{ fontSize: "0.75rem", color: "var(--t-text-muted)" }}>
          {label} · hero slide
        </span>
      </div>
    </div>
  );
}

export default SlidePreview;
