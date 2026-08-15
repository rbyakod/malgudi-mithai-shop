// apps/android/app/src/main/java/com/mishran/app/ui/addresses/AddressesViewModel.kt
//
// Account → Delivery addresses: list, add, set-default, and delete over the
// addresses routes (GET/POST/PATCH/DELETE). Errors surface as a one-line
// message instead of a dead screen.
package com.mishran.app.ui.addresses

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.mishran.api.models.Address
import com.mishran.api.models.AddressInput
import com.mishran.app.data.repository.AddressRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class AddressesUiState(
    val loading: Boolean = true,
    val addresses: List<Address> = emptyList(),
    val message: String? = null,
)

@HiltViewModel
class AddressesViewModel @Inject constructor(
    private val repository: AddressRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(AddressesUiState())
    val state: StateFlow<AddressesUiState> = _state.asStateFlow()

    init {
        refresh()
    }

    fun refresh() {
        viewModelScope.launch {
            val addresses = repository.listAddresses()
            _state.update { it.copy(loading = false, addresses = addresses) }
        }
    }

    /** Create via the form; refreshes the list or reports the failure. */
    fun addAddress(input: AddressInput) {
        viewModelScope.launch {
            val created = repository.createAddress(input)
            if (created == null) {
                _state.update { it.copy(message = "Could not save the address. Try again.") }
            } else {
                _state.update { it.copy(message = null) }
                refresh()
            }
        }
    }

    /** PATCH the address with isDefault=true (server demotes the previous). */
    fun setDefault(address: Address) {
        viewModelScope.launch {
            val updated = repository.updateAddress(
                address.id.orEmpty(),
                address.toInput(isDefault = true),
            )
            if (updated == null) {
                _state.update { it.copy(message = "Could not set the default. Try again.") }
            } else {
                _state.update { it.copy(message = null) }
                refresh()
            }
        }
    }

    /** DELETE the address (owner-scoped); refreshes the list or reports the failure. */
    fun deleteAddress(address: Address) {
        viewModelScope.launch {
            val deleted = repository.deleteAddress(address.id.orEmpty())
            if (!deleted) {
                _state.update { it.copy(message = "Could not delete the address. Try again.") }
            } else {
                _state.update { it.copy(message = null) }
                refresh()
            }
        }
    }

    fun clearMessage() {
        _state.update { it.copy(message = null) }
    }
}

/** Address model → writable input; only the default flag changes on update. */
internal fun Address.toInput(isDefault: Boolean? = this.isDefault): AddressInput = AddressInput(
    line1 = line1.orEmpty(),
    line2 = line2,
    city = city.orEmpty(),
    state = state.orEmpty(),
    pincode = pincode.orEmpty(),
    tag = tag?.let { modelTag ->
        AddressInput.Tag.entries.firstOrNull { it.value == modelTag.value }
    },
    isDefault = isDefault,
)
