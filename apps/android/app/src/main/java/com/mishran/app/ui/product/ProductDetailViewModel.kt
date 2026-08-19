// apps/android/app/src/main/java/com/mishran/app/ui/product/ProductDetailViewModel.kt — Task 9.4 / 10.1 / P1 parity / parity batch / B11.
//
// Detail-screen state: one-shot lookup (Room → network fallback → null) over
// the shared UiState lifecycle, plus the quantity stepper (floored at 1 —
// removing items is the cart's job, not the product page's). Since Task 10.1
// the Add-to-cart CTA writes the line into the Room cart and emits `added`
// once it lands — the screen turns that into navigation (pop back).
//
// P1 parity adds the two pack/buy seams:
//   - addToCart/buyNow take the SELECTED pack chip (null = no chips or base
//     pack) so the cart line keys itself and prices itself off the chip.
//   - buyNow is the one-shot flow: same cart write, then `bought` fires and
//     the screen navigates straight to checkout (no cart stop).
//
// Parity batch adds the two serviceability seams (now delegated to the shared
// [DeliveryCheckController] — see DeliveryCheckSection.kt):
//   - "Check delivery": the same GET /catalog/serviceable the checkout uses
//     (via AddressRepository), with the last successful check persisted and
//     restored on later PDP visits without a refetch.
//   - "Ask on WhatsApp": the brand digits from BrandRepository (placeholder
//     fallback handled there) + an English-composed product-facts message
//     built by a pure function so it is unit-testable.
//
// B11 (reviews): once the product resolves, the first page of approved
// reviews (GET /reviews, pageSize 5) loads alongside. Failures and empty
// lists both surface as a null state so the section renders NOTHING — web
// parity, no empty state.
//
// iOS PDP parity adds the same-family cross-sell rail: once the product
// resolves, up to four same-family siblings (current product excluded) load
// cache-first off the shared catalog cache — see CatalogRepository
// .getFamilySiblings. Empty (cold offline cache or a single-product family)
// keeps the rail hidden; failures never surface an error state.
package com.mishran.app.ui.product

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.mishran.api.models.Product
import com.mishran.app.data.remote.api.ReviewsResponse
import com.mishran.app.data.repository.AddressRepository
import com.mishran.app.data.repository.BrandRepository
import com.mishran.app.data.repository.CatalogRepository
import com.mishran.app.data.repository.CartRepository
import com.mishran.app.data.repository.PLACEHOLDER_WHATSAPP_DIGITS
import com.mishran.app.data.repository.ReviewRepository
import com.mishran.app.data.repository.SettingsRepository
import com.mishran.app.ui.common.UiState
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.OffsetDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale
import javax.inject.Inject

/** One review row exactly as the PDP renders it (dates pre-formatted). */
data class ReviewRow(
    val id: String,
    /** Author display name; null renders the localized "Anonymous" label. */
    val authorDisplayName: String?,
    /** "17 Aug 2026"-style label; empty when the wire date fails to parse. */
    val dateLabel: String,
    val rating: Int,
    val body: String,
    val verifiedPurchase: Boolean,
)

/**
 * The PDP's customer-reviews section payload: aggregate over ALL approved
 * reviews plus the (up to 5) rendered rows and how many were left unlisted.
 */
data class ReviewsUi(
    val averageRating: Double,
    val total: Int,
    val rows: List<ReviewRow>,
    val hiddenCount: Int,
)

@HiltViewModel
class ProductDetailViewModel @Inject constructor(
    private val repository: CatalogRepository,
    private val cartRepository: CartRepository,
    addressRepository: AddressRepository,
    settingsRepository: SettingsRepository,
    brandRepository: BrandRepository,
    private val reviewRepository: ReviewRepository,
    savedStateHandle: SavedStateHandle,
) : ViewModel() {

    /** Injected from the route — see Routes.PRODUCT ("product/{slug}"). */
    val slug: String = checkNotNull(savedStateHandle["slug"])

    private val _state = MutableStateFlow<UiState<Product>>(UiState.Loading)
    val state: StateFlow<UiState<Product>> = _state.asStateFlow()

    private val _quantity = MutableStateFlow(MIN_QUANTITY)
    val quantity: StateFlow<Int> = _quantity.asStateFlow()

    // ---- "Check delivery" (parity batch; shared controller) --------------

    private val deliveryCheckController = DeliveryCheckController(
        addressRepository = addressRepository,
        settingsRepository = settingsRepository,
        scope = viewModelScope,
    )

    /** The pincode field's text; survives state transitions so "Change" keeps it. */
    val pincode: StateFlow<String> = deliveryCheckController.pincode

    val deliveryCheck: StateFlow<DeliveryCheckState> = deliveryCheckController.deliveryCheck

    /**
     * wa.me digits for the Ask row: the brand number when /brand (or its
     * cache) answers, the placeholder otherwise — the row is always tappable.
     */
    private val _whatsappDigits = MutableStateFlow(PLACEHOLDER_WHATSAPP_DIGITS)
    val whatsappDigits: StateFlow<String> = _whatsappDigits.asStateFlow()

    // ---- Customer reviews (B11) -------------------------------------------

    /** Null while loading, on failure, or when the product has no reviews. */
    private val _reviews = MutableStateFlow<ReviewsUi?>(null)
    val reviews: StateFlow<ReviewsUi?> = _reviews.asStateFlow()

    // ---- Same-family cross-sell rail (iOS PDP parity) ----------------------

    /** Up to 4 same-family siblings; empty keeps the rail hidden. */
    private val _crossSell = MutableStateFlow<List<Product>>(emptyList())
    val crossSell: StateFlow<List<Product>> = _crossSell.asStateFlow()

    init {
        load()
        viewModelScope.launch {
            brandRepository.getSupportContact()?.let { _whatsappDigits.value = it.whatsappDigits }
        }
    }

    fun load() {
        _state.value = UiState.Loading
        viewModelScope.launch {
            val product = repository.getProduct(slug)
            _state.value =
                if (product == null) UiState.Error("That sweet could not be found.")
                else UiState.Success(product)
            // B11: reviews key off the product id, so they can only load once
            // the product resolves. Failure/empty both map to null (hidden).
            if (product != null) {
                _reviews.value = reviewRepository.getProductReviews(product.id)?.toReviewsUi()
                // Cross-sell rides the same resolve trigger (iOS loads both in
                // .task(id: slug)); a repository failure resolves to empty and
                // the rail hides — never an error surface on the PDP.
                _crossSell.value = runCatching {
                    repository.getFamilySiblings(product.family, product.slug)
                }.getOrDefault(emptyList())
            }
        }
    }

    fun onPincodeChange(value: String) = deliveryCheckController.onPincodeChange(value)

    fun checkDelivery() = deliveryCheckController.checkDelivery()

    /** "Change": back to the entry form, pincode kept for editing. */
    fun resetDeliveryCheck() = deliveryCheckController.resetDeliveryCheck()

    fun incrementQuantity() {
        _quantity.value = (_quantity.value + 1).coerceAtMost(MAX_QUANTITY)
    }

    fun decrementQuantity() {
        _quantity.value = (_quantity.value - 1).coerceAtLeast(MIN_QUANTITY)
    }

    /**
     * Write the current (product, quantity, pack) into the cart; emits [added]
     * on landing. [pack] is the selected PDP chip, null when the product
     * offers none — the repository owns the pack → line-id rule.
     */
    fun addToCart(pack: PackSize? = null) {
        val current = _state.value as? UiState.Success<Product> ?: return
        viewModelScope.launch {
            cartRepository.add(current.data, _quantity.value, pack)
            _added.emit(Unit)
        }
    }

    /**
     * One-shot buy: the same cart write as [addToCart], then `bought` fires so
     * the screen skips the cart and navigates straight to checkout.
     */
    fun buyNow(pack: PackSize? = null) {
        val current = _state.value as? UiState.Success<Product> ?: return
        viewModelScope.launch {
            cartRepository.add(current.data, _quantity.value, pack)
            _bought.emit(Unit)
        }
    }

    private val _added = MutableSharedFlow<Unit>(extraBufferCapacity = 1)
    /** Fired once the cart write lands — the screen pops back on this. */
    val added: SharedFlow<Unit> = _added

    private val _bought = MutableSharedFlow<Unit>(extraBufferCapacity = 1)
    /** Fired once the buy-now cart write lands — the screen goes to checkout. */
    val bought: SharedFlow<Unit> = _bought

    private companion object {
        const val MIN_QUANTITY = 1
        // Backstop, not a product rule — the server re-validates at checkout.
        const val MAX_QUANTITY = 20
    }
}

/** How many review rows the PDP lists (one page; the rest becomes "+N more"). */
internal const val REVIEWS_PAGE_SIZE = 5

/**
 * Wire page → section payload. Null (render nothing) when there are no
 * reviews at all or the aggregate is missing — web parity, no empty state.
 * Rows cap at [REVIEWS_PAGE_SIZE]; the surplus collapses into hiddenCount.
 */
internal fun ReviewsResponse.Page.toReviewsUi(): ReviewsUi? {
    if (total == 0 || items.isEmpty()) return null
    val average = averageRating ?: return null
    val rows = items.take(REVIEWS_PAGE_SIZE).map { review ->
        ReviewRow(
            id = review.id,
            authorDisplayName = review.authorDisplayName,
            dateLabel = reviewDateLabel(review.createdAt.orEmpty()),
            rating = review.rating,
            body = review.body.orEmpty(),
            verifiedPurchase = review.verifiedPurchase,
        )
    }
    return ReviewsUi(
        averageRating = average,
        total = total,
        rows = rows,
        hiddenCount = (total - rows.size).coerceAtLeast(0),
    )
}

/**
 * Review date label: ISO instant → "17 Aug 2026" (English month abbreviations
 * — date labels stay locale-stable like the rest of the app's date rows).
 * Unparseable wire values yield "" so the date line simply hides.
 */
internal fun reviewDateLabel(createdAt: String): String = runCatching {
    OffsetDateTime.parse(createdAt).format(REVIEW_DATE_FORMAT)
}.getOrDefault("")

private val REVIEW_DATE_FORMAT: DateTimeFormatter =
    DateTimeFormatter.ofPattern("d MMM yyyy", Locale.ENGLISH)

/** One-decimal aggregate label — "4.5" (and "4.0", not "4"). */
internal fun formatReviewRating(rating: Double): String =
    String.format(Locale.ENGLISH, "%.1f", rating)

/**
 * The "Ask on WhatsApp" prefill: plain English product facts (name, selected
 * pack + its price line, quantity) so it reads the same in every locale — the
 * shop replies in whatever language the customer used to open the chat.
 */
internal fun buildProductWhatsAppMessage(
    product: Product,
    pack: PackSize?,
    quantity: Int,
): String = buildString {
    appendLine("Hi Mishran! Quick question about this sweet:")
    appendLine(product.name)
    pack?.let { appendLine("${it.label} · ${it.priceLabel}") }
        ?: product.displayPrice?.let { appendLine(it) }
    append("Quantity: $quantity")
}
