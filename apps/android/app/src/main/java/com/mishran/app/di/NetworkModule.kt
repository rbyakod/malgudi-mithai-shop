// apps/android/app/src/main/java/com/mishran/app/di/NetworkModule.kt — Task 7.3.
//
// Hilt graph for networking: Moshi (matching the generated DTOs) -> OkHttp
// (logging + proactive bearer via [AuthInterceptor], reactive refresh on 401 via
// [TokenRefreshAuthenticator]) -> Retrofit (baseUrl from BuildConfig) ->
// MishranApi. Everything is @Singleton so the connection pool, token state, and
// Moshi reflection caches are shared app-wide.
package com.mishran.app.di

import com.mishran.app.BuildConfig
import com.mishran.app.data.remote.api.MishranApi
import com.mishran.app.data.sync.AuthInterceptor
import com.mishran.app.data.sync.TokenRefreshAuthenticator
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory
import java.util.concurrent.TimeUnit
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {

    @Provides
    @Singleton
    fun provideMoshi(): Moshi =
        Moshi.Builder()
            // Reflective adapter: the generated DTO data classes are not
            // annotated @JsonClass(generateAdapter = true), so codegen would
            // skip them. KotlinJsonAdapterFactory covers every Kotlin class.
            .add(KotlinJsonAdapterFactory())
            .build()

    @Provides
    @Singleton
    fun provideOkHttpClient(
        authInterceptor: AuthInterceptor,
        authenticator: TokenRefreshAuthenticator,
    ): OkHttpClient {
        // BODY logging only in debug; release ships NONE so no PII hits logs.
        val logging = HttpLoggingInterceptor().apply {
            level = if (BuildConfig.DEBUG) {
                HttpLoggingInterceptor.Level.BODY
            } else {
                HttpLoggingInterceptor.Level.NONE
            }
        }
        return OkHttpClient.Builder()
            .addInterceptor(authInterceptor)
            .addInterceptor(logging)
            .authenticator(authenticator)
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .build()
    }

    @Provides
    @Singleton
    fun provideRetrofit(client: OkHttpClient, moshi: Moshi): Retrofit =
        Retrofit.Builder()
            .baseUrl(BuildConfig.API_BASE_URL)
            .client(client)
            .addConverterFactory(MoshiConverterFactory.create(moshi))
            .build()

    @Provides
    @Singleton
    fun provideMishranApi(retrofit: Retrofit): MishranApi =
        retrofit.create(MishranApi::class.java)
}
