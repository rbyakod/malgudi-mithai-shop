// components/mithai/ProductViewed.tsx
// Tiny client island that fires the `product_viewed` analytics event on
// mount. Rendered by the mithai PDP (a server component), which cannot
// call `track()` directly. Renders nothing — no UI.

"use client";

import {useEffect} from "react";
import {track} from "@/lib/analytics";

type Props = {
  id: string;
  name: string;
};

export function ProductViewed({id, name}: Props) {
  useEffect(() => {
    track("product_viewed", {id, name});
  }, [id, name]);

  return null;
}

export default ProductViewed;
