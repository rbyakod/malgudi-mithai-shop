// apps/android/app/src/main/java/com/mishran/app/data/repository/AddressRepository.kt — Task 10.2.
//
// Thin wrapper over the addresses routes. Checkout reads; the account screen
// (later phase) reuses the same repository for create/edit. Errors collapse
// to an empty list / null so checkout degrades to manual pincode entry rather
// than a dead end.
package com.mishran.app.data.repository

import com.mishran.api.models.Address
import com.mishran.api.models.AddressInput
import com.mishran.api.models.ServiceableResponse
import com.mishran.app.data.remote.api.MishranApi
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AddressRepository @Inject constructor(
    private val api: MishranApi,
) {

    /** Saved addresses, default first; empty on any failure (offline-safe). */
    suspend fun listAddresses(): List<Address> = try {
        api.listAddresses().data.items
            .sortedByDescending { it.isDefault == true }
    } catch (e: Exception) {
        emptyList()
    }

    suspend fun createAddress(input: AddressInput): Address? = try {
        api.createAddress(input).data.address
    } catch (e: Exception) {
        null
    }

    /**
     * Pincode serviceability + tier. Hits the catalog route but is checkout's
     * concern: the resolved tier (fresh = Delhi NCR same-day network,
     * shelf = metro shipping) drives which slot picker UI renders.
     */
    suspend fun checkServiceability(pincode: String): ServiceableResponse? = try {
        api.checkPincode(pincode).data
    } catch (e: Exception) {
        null
    }
}
