"use client";

import {makeProductNameCell} from "./ProductNameCell";
import {mithaiBehavior} from "./product-cell-behaviors";

// Wrapper that the importMap can resolve by string path.
// `product-cell-behaviors.ts` exports the behavior object only; this file
// produces the actual Cell component Payload renders.
export default makeProductNameCell(mithaiBehavior);
