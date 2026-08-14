// apps/android/app/src/main/java/com/mishran/app/domain/usecase/GetCatalogUseCase.kt — Task 9.2.
//
// Thin indirection so ViewModels depend on a domain operation, not the
// repository. `force = true` bypasses the stored ETag (pull-to-refresh); the
// default path sends If-None-Match so an unchanged catalog costs one 304.
package com.mishran.app.domain.usecase

import com.mishran.api.models.Product
import com.mishran.app.data.repository.CatalogRepository
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject

class GetCatalogUseCase @Inject constructor(
    private val repository: CatalogRepository,
) {
    /** Cache-first catalog: emits Room rows, then whatever a refresh produced. */
    operator fun invoke(force: Boolean = false): Flow<List<Product>> =
        repository.getCatalog(force)
}
