// apps/android/app/src/main/java/com/mishran/app/ui/product/PackSizes.kt — P1 parity (pack sizes).
//
// Verbatim Kotlin port of the web reference lib/mithai/packSizes.ts — do not
// re-derive; the two implementations must agree chip-for-chip so a product
// shows the same 250g/500g/1kg options on web and Android.
//
// Commerce (real per-variant pricing) is Phase 8 — until then the catalog
// carries exactly ONE real price per product as a display string, e.g.
// "₹920 / 250g". Reference sweet-shop PDPs show a 250g/500g/1kg selector, so
// for products priced per gram the sibling sizes are derived linearly from
// the single real price (rounded to the nearest ₹10). THE DERIVED NUMBERS ARE
// DISPLAY-ONLY ESTIMATES; the BASE option always keeps the verbatim
// displayPrice so nothing real is rewritten, and checkout re-validates
// server-side against the base product.
//
// Rules (mirroring packSizes.ts):
//   - Price unit is authoritative (it's what the customer actually pays
//     against), not the `weight` field — the two disagree on some scraped
//     products ("130g" weight, "₹399 / pack" price).
//   - Base sizes on the 250g / 500g / 1kg ladder get the full 3-option
//     selector; off-ladder bases (700g, 480 gm, …) keep a single chip —
//     scaling those to made-up neighbors looks worse than not offering them.
//   - Per-pack, bare ("₹455"), or on-request prices never derive: they
//     render the single real chip (or nothing if there's no weight either).
package com.mishran.app.ui.product

import kotlin.math.roundToLong

/** One pack-size option on the PDP. [grams] drives the linear scale when set. */
data class PackSize(
    val label: String,
    val priceLabel: String,
    /** Grams, when the option is gram-priced — used for the linear scale. */
    val grams: Int? = null,
)

private val LADDER = listOf(250, 500, 1000)

/** `/\s*(.+)$` — the unit suffix after the price slash, captured verbatim. */
private val UNIT_SUFFIX_PATTERN = Regex("/\\s*(.+)$")

// "1 kg" / "1kg" / "1 Kg" → 1000; "250g" / "480 gm" / "700 grams" → n.
private val GRAMS_PATTERN =
    Regex("^(\\d+(?:\\.\\d+)?)\\s*(kg|g|gm|grams?)$", RegexOption.IGNORE_CASE)

/** "1 kg" / "1kg" / "1 Kg" → 1000; "250g" / "480 gm" / "700 grams" → n; else null. */
internal fun parseGrams(unit: String): Int? {
    val m = GRAMS_PATTERN.find(unit.trim()) ?: return null
    val value = m.groupValues[1].toDoubleOrNull() ?: return null
    return if (m.groupValues[2].equals("kg", ignoreCase = true)) {
        (value * 1000).roundToLong().toInt()
    } else {
        value.roundToLong().toInt()
    }
}

private fun labelFor(grams: Int): String =
    if (grams >= 1000 && grams % 1000 == 0) "${grams / 1000} kg" else "${grams}g"

// "₹920 / 250g" → 920; "₹1,084 / 500g" → 1084; "₹ on request / pack" → null.
private val PRICE_PATTERN = Regex("^\\d+(\\.\\d+)?$")
private val PRICE_NOISE = Regex("[₹,\\s]")

/** "₹920 / 250g" → 920.0; "₹1,084 / 500g" → 1084.0; "₹ on request / pack" → null. */
internal fun parsePrice(displayPrice: String): Double? {
    val pricePart = displayPrice.substringBefore("/")
    val cleaned = PRICE_NOISE.replace(pricePart, "")
    return if (PRICE_PATTERN.matches(cleaned)) cleaned.toDouble() else null
}

private fun formatRupees(value: Double): String = "₹${groupIndianDigits(value.roundToLong())}"

/**
 * en-IN digit grouping — first 3 digits, then groups of 2 ("1,08,432"), the
 * lakh/crore style the scraped catalog uses. Hand-rolled on purpose:
 * java.text on the desktop JVM (CLDR, single grouping size) formats
 * en-IN as western "108,432" while Android's ICU formats it as "1,08,432",
 * so NumberFormat.getInstance(Locale("en","IN")) would render differently
 * on device than in the JVM unit tests. A pure function pins one answer
 * everywhere.
 */
internal fun groupIndianDigits(value: Long): String {
    if (value < 0) return "-" + groupIndianDigits(-value)
    val digits = value.toString()
    if (digits.length <= 3) return digits
    // Head (everything above the last three digits) groups in 2s from the
    // right: reverse → chunk(2) → join → reverse.
    val head = digits.dropLast(3).reversed().chunked(2).joinToString(",").reversed()
    return "$head,${digits.takeLast(3)}"
}

private fun round10(value: Double): Double = (value / 10).roundToLong() * 10.0

/**
 * Derive the PDP pack-size options from a product's display price + weight.
 * Pure and total — same inputs, same chips, no platform state.
 */
fun derivePackSizes(
    displayPrice: String,
    weight: String? = null,
): List<PackSize> {
    if (displayPrice.isEmpty()) return emptyList()

    // Unit suffix after the price, e.g. "₹920 / 250g" → "250g".
    val unit = UNIT_SUFFIX_PATTERN.find(displayPrice)?.groupValues?.get(1)
    val unitGrams = unit?.let(::parseGrams)
    val basePrice = parsePrice(displayPrice)

    if (unitGrams != null && basePrice != null && unitGrams in LADDER) {
        // Full selector over the ladder, base option verbatim.
        return LADDER.map { grams ->
            if (grams == unitGrams) {
                PackSize(label = labelFor(grams), priceLabel = displayPrice, grams = grams)
            } else {
                PackSize(
                    label = labelFor(grams),
                    priceLabel = "${formatRupees(round10(basePrice * grams / unitGrams))} / ${labelFor(grams)}",
                    grams = grams,
                )
            }
        }
    }

    // No derivation possible — fall back to a single informational chip.
    val trimmedWeight = weight?.trim().orEmpty()
    if (trimmedWeight.isNotEmpty()) return listOf(PackSize(label = trimmedWeight, priceLabel = displayPrice))
    val trimmedUnit = unit?.trim().orEmpty()
    if (trimmedUnit.isNotEmpty()) {
        return listOf(PackSize(label = trimmedUnit, priceLabel = displayPrice))
    }
    return emptyList()
}

/**
 * The chip to preselect: the option carrying the verbatim [displayPrice] (so
 * the page opens on the product's real price), falling back to the first
 * chip. Mirrors BuyModule's base-label resolution on the web.
 */
fun List<PackSize>.basePackFor(displayPrice: String?): PackSize? =
    firstOrNull { it.priceLabel == displayPrice } ?: firstOrNull()
