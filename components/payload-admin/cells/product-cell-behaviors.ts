import {makeProductNameCell, type ProductCellBehavior} from "./ProductNameCell";

// Per-collection cell behaviors. Verified against actual collection schemas.

export const mithaiBehavior: ProductCellBehavior = {
  image: {kind: "array", field: "images", imageKey: "image"},
  meta: (row) => [
    typeof row.displayPrice === "string" && row.displayPrice ? {label: row.displayPrice} : null,
    typeof row.family === "string" && row.family ? {label: row.family} : null,
  ].filter((x): x is {label: string} => x !== null),
  badges: (row) => {
    const f = row.freshnessStatus;
    if (typeof f !== "string" || !f) return [];
    return [{label: f.replace(/-/g, " "), tone: "gold" as const}];
  },
};

export const qsrBehavior: ProductCellBehavior = {
  image: {kind: "single", field: "image"},
  meta: (row) => [
    typeof row.category === "string" && row.category ? {label: row.category} : null,
  ].filter((x): x is {label: string} => x !== null),
  badges: (row) => {
    if (typeof row.veg !== "boolean") return [];
    return [{label: row.veg ? "Veg" : "Non-veg", tone: row.veg ? "success" : "danger"}];
  },
};

export const snackBehavior: ProductCellBehavior = {
  image: {kind: "array", field: "images", imageKey: "image"},
  meta: (row) => [
    typeof row.msrp === "string" && row.msrp ? {label: row.msrp} : null,
    typeof row.category === "string" && row.category ? {label: row.category} : null,
  ].filter((x): x is {label: string} => x !== null),
  badges: () => [],
};

export const merchBehavior: ProductCellBehavior = {
  image: {kind: "array", field: "images", imageKey: "image"},
  meta: (row) => [
    typeof row.price === "string" && row.price ? {label: row.price} : null,
    typeof row.type === "string" && row.type ? {label: row.type} : null,
  ].filter((x): x is {label: string} => x !== null),
  badges: (row) => {
    const a = row.availability;
    if (typeof a !== "string" || !a) return [];
    return [{label: a, tone: a === "in-stock" ? "success" : "muted"}];
  },
};

export const giftBoxBehavior: ProductCellBehavior = {
  image: {kind: "array", field: "images", imageKey: "image"},
  meta: (row) => [
    typeof row.size === "string" && row.size ? {label: row.size} : null,
  ].filter((x): x is {label: string} => x !== null),
  badges: () => [],
};

export const MithaiProductCell = makeProductNameCell(mithaiBehavior);
export const QsrMenuCell = makeProductNameCell(qsrBehavior);
export const SnackProductCell = makeProductNameCell(snackBehavior);
export const MerchProductCell = makeProductNameCell(merchBehavior);
export const GiftBoxCell = makeProductNameCell(giftBoxBehavior);
