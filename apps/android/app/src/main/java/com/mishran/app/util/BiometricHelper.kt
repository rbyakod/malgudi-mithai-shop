// apps/android/app/src/main/java/com/mishran/app/util/BiometricHelper.kt — Task 8.2.
//
// Availability check for the biometric auth gate. We require BIOMETRIC_STRONG
// (Class 3) because the gate protects a credential; class-2 sensors are not
// trusted to unlock sensitive material.
package com.mishran.app.util

import android.content.Context
import androidx.biometric.BiometricManager

enum class BiometricStatus { Available, NoHardware, NotEnrolled, Unavailable }

object BiometricHelper {

    fun status(context: Context): BiometricStatus {
        val authenticators = BiometricManager.Authenticators.BIOMETRIC_STRONG
        return when (BiometricManager.from(context).canAuthenticate(authenticators)) {
            BiometricManager.BIOMETRIC_SUCCESS -> BiometricStatus.Available
            BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE -> BiometricStatus.NoHardware
            BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED -> BiometricStatus.NotEnrolled
            else -> BiometricStatus.Unavailable
        }
    }
}
