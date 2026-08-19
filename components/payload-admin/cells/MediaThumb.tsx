"use client";

import Image from "next/image";
import {useEffect, useSyncExternalStore} from "react";
import {getMedia, requestMedia, subscribeToMedia} from "./mediaResolver";

/**
 * 48px product thumbnail for admin list rows whose image relation arrived as
 * a bare ID (depth=0 list queries). Renders the styled fallback until the
 * batched resolver in mediaResolver.ts delivers the media URL.
 */
export function MediaThumb({id, alt}: {id: string; alt: string}) {
  const media = useSyncExternalStore(
    subscribeToMedia,
    () => getMedia(id),
    () => undefined,
  );
  useEffect(() => {
    requestMedia(id);
  }, [id]);

  if (!media) {
    return (
      <div
        className="mishran-cell-fallback"
        style={{width: 48, height: 48, borderRadius: "6px", background: "var(--t-bg-control)"}}
      />
    );
  }
  return (
    <Image
      src={media.url}
      alt={media.alt ?? alt}
      width={48}
      height={48}
      style={{objectFit: "cover", borderRadius: "6px", border: "1px solid var(--t-border)"}}
    />
  );
}

export default MediaThumb;
