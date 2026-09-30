// lib/commerce/deliveryLimits.ts
// The range an admin may enter for delivery fees and free-delivery thresholds, in whole rupees. Shared by the
// admin field validation (globals/DeliverySettings.ts) and the rules resolver (deliveryRules.ts), so a value that
// somehow got past the admin form (a script, an import) is still ignored rather than charged to customers.
export const MAX_FEE_RUPEES = 500;
export const MAX_THRESHOLD_RUPEES = 100_000;

/** Payload field validator: empty is allowed (means "use the server value"); otherwise a whole number in range. */
export function validateRupees(max: number) {
  return (value: number | null | undefined): true | string => {
    if (value == null) return true;
    if (typeof value !== "number" || !Number.isInteger(value)) return "Enter a whole number of rupees.";
    if (value < 0 || value > max) return `Enter an amount between ₹0 and ₹${max.toLocaleString("en-IN")}.`;
    return true;
  };
}

/** Rupees to paise, or null when the value is empty or outside the allowed range. */
export function rupeesToPaiseWithin(value: unknown, max: number): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= max ? value * 100 : null;
}
