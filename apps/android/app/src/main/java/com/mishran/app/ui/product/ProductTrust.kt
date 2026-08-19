// apps/android/app/src/main/java/com/mishran/app/ui/product/ProductTrust.kt — iOS PDP parity.
//
// Pure copy-derivation for the PDP's three parity blocks: the trust strip
// under the price (freshness promise · shelf life · lead time · dietary
// tags), the provenance rows (karigar · freshness · shelf life), and the
// sticky buy bar's "qty × price" line. Everything is a total function over
// (Product, already-localized strings) so the render rules — only non-empty
// fields, known values localized / unknown values verbatim — live in one
// testable place; the composables resolve stringResource values and hand
// them in. Verbatim port of the iOS field→copy maps
// (ProductDetailView.swift trustStripItems/provenanceRows), which in turn
// mirror the web MithaiPDP's FRESHNESS_KEY/DIETARY_KEY tables.
package com.mishran.app.ui.product

import com.mishran.api.models.Product
import com.mishran.api.models.Product.FreshnessStatus

/**
 * The localized strings the trust strip derives from. The composables fill
 * this from string resources at render time; tests pass plain strings. The
 * shelf-life entry is a formatter ("{value} shelf life") because the value
 * rides inside the localized phrase.
 */
data class TrustStripCopy(
    val freshDaily: String,
    val freshToOrder: String,
    val frozen: String,
    val shelfLife: (String) -> String,
    val vegetarian: String,
    val sugarFree: String,
)

/**
 * Translated freshness promise for the strip's first slot. Null when the
 * product carries no status; an unknown (admin free-text) status renders
 * verbatim, exactly like the web's FRESHNESS_KEY miss branch.
 */
internal fun freshnessPromise(
    status: FreshnessStatus?,
    copy: TrustStripCopy,
): String? = when (status) {
    FreshnessStatus.madeMinusDaily -> copy.freshDaily
    FreshnessStatus.madeMinusToMinusOrder -> copy.freshToOrder
    FreshnessStatus.batchMinusFrozen -> copy.frozen
    null -> null
}

/** Known dietary tags localize; free-text tags render capitalized verbatim. */
internal fun dietaryTrustLabel(tag: String, copy: TrustStripCopy): String =
    when (tag.lowercase()) {
        "vegetarian" -> copy.vegetarian
        "sugar-free" -> copy.sugarFree
        else -> tag.replaceFirstChar { it.uppercase() }
    }

/**
 * Trust-strip items — only the fields the product actually carries, in the
 * fixed order freshness promise → shelf life → lead time → dietary tags.
 * Empty list means the whole strip hides (no empty placeholders).
 */
internal fun trustStripItems(product: Product, copy: TrustStripCopy): List<String> {
    val items = mutableListOf<String>()
    freshnessPromise(product.freshnessStatus, copy)?.let(items::add)
    product.shelfLife?.takeIf { it.isNotBlank() }?.let { items.add(copy.shelfLife(it)) }
    product.leadTime?.takeIf { it.isNotBlank() }?.let(items::add)
    product.dietaryTags.orEmpty().forEach { items.add(dietaryTrustLabel(it, copy)) }
    return items
}

/** One provenance row: quiet uppercase label over the value. */
data class ProvenanceRow(
    val label: String,
    val value: String,
)

/**
 * Provenance rows — karigar ("Made by <name>"), lead-time freshness, and
 * shelf life — each only when the product's field is non-empty. Production
 * data currently leaves these unset, so an empty return (block hidden) is
 * the expected state, not a bug.
 */
internal fun provenanceRows(
    product: Product,
    karigarLabel: String,
    freshnessLabel: String,
    shelfLifeLabel: String,
): List<ProvenanceRow> = buildList {
    product.karigarName?.takeIf { it.isNotBlank() }?.let {
        add(ProvenanceRow(karigarLabel, it))
    }
    product.leadTime?.takeIf { it.isNotBlank() }?.let {
        add(ProvenanceRow(freshnessLabel, it))
    }
    product.shelfLife?.takeIf { it.isNotBlank() }?.let {
        add(ProvenanceRow(shelfLifeLabel, it))
    }
}

/**
 * The sticky buy bar's second line: "3 × ₹920 / 250g" (quantity × the live
 * price line). Null when there is no price line at all — the bar then shows
 * the name alone, matching iOS's `\(quantity) × \(price)` guard.
 */
internal fun stickyQuantityLine(quantity: Int, priceLine: String?): String? =
    priceLine?.takeIf { it.isNotBlank() }?.let { "$quantity × $it" }
