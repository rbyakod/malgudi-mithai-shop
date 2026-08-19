// NOTE: This module must NOT have "use client". The factory is invoked at
// server module-evaluation time from collection configs (see
// product-cell-behaviors.ts). Putting "use client" here marks every export
// as client-only and throws "Attempted to call makeProductNameCell() from
// the server" at /admin request time. The returned component renders
// next/image which establishes its own client boundary.
import Image from "next/image";
import type {DefaultCellComponentProps} from "payload";
import MediaThumb from "./MediaThumb";

type MetaItem = {
  label: string;
  tone?: "default" | "muted" | "primary" | "gold" | "success" | "danger";
};

type Badge = MetaItem;

type ImageSpec =
  | {kind: "array"; field: string; imageKey: string}
  | {kind: "single"; field: string};

export type ProductCellBehavior = {
  image: ImageSpec;
  meta: (row: Record<string, unknown>) => MetaItem[];
  badges?: (row: Record<string, unknown>) => Badge[];
};

type Row = Record<string, unknown> & {id: string; name?: string};

type MediaDoc = {url?: string; alt?: string; filename?: string};

// The admin list view fetches rows with depth=0, so relation values arrive
// as bare media IDs (strings), never populated docs. A bare ID must NOT be
// used as an image src — next/image would request /_next/image?url=<id> and
// get a 400. Return it as a mediaId so the cell renders <MediaThumb>, which
// resolves it through the batched /api/media lookup in mediaResolver.ts.
// Strings that already look like URLs (legacy/direct data) pass through.
type PickedImage = {url: string; alt?: string} | {mediaId: string; alt?: string};

function isLikelyUrl(value: string): boolean {
  return value.startsWith("/") || value.startsWith("http://") || value.startsWith("https://");
}

export function pickImage(row: Row, spec: ImageSpec): PickedImage | null {
  if (spec.kind === "array") {
    const arr = (row as Record<string, unknown>)[spec.field];
    if (!Array.isArray(arr) || arr.length === 0) return null;
    const first = arr[0] as Record<string, unknown>;
    const media = first[spec.imageKey] as MediaDoc | string | undefined;
    return coerceMedia(media);
  }
  // single
  const media = (row as Record<string, unknown>)[spec.field] as MediaDoc | string | undefined;
  return coerceMedia(media);
}

function coerceMedia(media: MediaDoc | string | undefined): PickedImage | null {
  if (typeof media === "string") {
    return isLikelyUrl(media) ? {url: media} : {mediaId: media};
  }
  if (media && typeof media === "object" && media.url) {
    return {url: media.url, alt: media.alt};
  }
  return null;
}

const TONE_BADGE_CLASS: Record<NonNullable<MetaItem["tone"]>, string> = {
  default: "mishran-pill--primary",
  muted: "mishran-pill--muted",
  primary: "mishran-pill--primary",
  gold: "mishran-pill--gold",
  success: "mishran-pill--success",
  danger: "mishran-pill--danger",
};

export function makeProductNameCell(behavior: ProductCellBehavior) {
  return function ProductNameCell({
    cellData,
    rowData,
  }: DefaultCellComponentProps) {
    const row = rowData as Row;
    const image = pickImage(row, behavior.image);
    const meta = behavior.meta(row);
    const badges = behavior.badges?.(row) ?? [];
    const name = (cellData as string | null | undefined) ?? row.name ?? "";

    const thumb =
      image && "mediaId" in image ? (
        <MediaThumb id={image.mediaId} alt={image.alt ?? name} />
      ) : image ? (
        <Image
          src={image.url}
          alt={image.alt ?? name}
          width={48}
          height={48}
          style={{objectFit: "cover", borderRadius: "6px", border: "1px solid var(--t-border)"}}
        />
      ) : (
        <div
          className="mishran-cell-fallback"
          style={{width: 48, height: 48, borderRadius: "6px", background: "var(--t-bg-control)"}}
        />
      );

    return (
      <div style={{display: "flex", alignItems: "center", gap: "0.75rem"}}>
        {thumb}
        <div style={{display: "flex", flexDirection: "column", gap: "0.125rem"}}>
          <span style={{fontWeight: 500, color: "var(--t-text)"}}>{String(name)}</span>
          {meta.length > 0 && (
            <div className="mishran-cell-meta" style={{display: "flex", gap: "0.5rem", fontSize: "0.75rem", color: "var(--t-text-muted)"}}>
              {meta.map((m, i) => {
                const label = typeof m === "string" ? m : m.label;
                return <span key={i}>{label}</span>;
              })}
            </div>
          )}
          {badges.length > 0 && (
            <div style={{display: "flex", gap: "0.25rem"}}>
              {badges.map((b, i) => (
                <span key={i} className={`mishran-pill ${TONE_BADGE_CLASS[b.tone ?? "default"]}`}>
                  {b.label}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };
}

export default makeProductNameCell;
