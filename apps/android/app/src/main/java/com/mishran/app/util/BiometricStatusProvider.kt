// apps/android/app/src/main/java/com/mishran/app/util/BiometricStatusProvider.kt — Task 8.2.
//
// Indirection over [BiometricHelper] so ViewModels can decide whether to prompt
// for biometric unlock without a direct Android [Context] dependency. The real
// impl (provided by di/BiometricModule) delegates to BiometricHelper; unit
// tests pass a plain lambda, e.g. `BiometricStatusProvider { BiometricStatus.Available }`.
package com.mishran.app.util

fun interface BiometricStatusProvider {
    /** Current BIOMETRIC_STRONG availability on this device. */
    fun status(): BiometricStatus
}
