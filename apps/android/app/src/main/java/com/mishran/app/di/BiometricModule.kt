// apps/android/app/src/main/java/com/mishran/app/di/BiometricModule.kt — Task 8.2.
//
// Hilt wiring for the biometric layer. [SecureTokenStore] needs no @Provides —
// its constructor is already @Inject + @Singleton, so Hilt builds it directly.
// Only [BiometricStatusProvider] is provided here, bridging the
// Context-requiring [BiometricHelper] to the Context-free interface the
// ViewModels depend on.
package com.mishran.app.di

import android.content.Context
import com.mishran.app.util.BiometricHelper
import com.mishran.app.util.BiometricStatusProvider
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object BiometricModule {

    @Provides
    @Singleton
    fun provideBiometricStatusProvider(
        @ApplicationContext context: Context,
    ): BiometricStatusProvider = BiometricStatusProvider { BiometricHelper.status(context) }
}
