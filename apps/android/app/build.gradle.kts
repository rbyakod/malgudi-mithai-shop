// apps/android/app/build.gradle.kts — Task 7.1 (Mishran Mobile Apps v1).
//
// Module `:app` config: Compose, Hilt, Retrofit (kotlinx-serialization), Room,
// DataStore, WorkManager, Glance widget, Biometric, Razorpay, Firebase (FCM +
// Crashlytics). minSdk 26 (Android 8.0) covers ~98% of IN devices; target/\
// compile SDK 35.
//
// Deviations from the plan brief (correctness — see root build.gradle.kts):
//   - Kotlin 2.0 Compose: use the org.jetbrains.kotlin.plugin.compose plugin
//     instead of composeOptions.kotlinCompilerExtensionVersion (legacy).
//   - JSON = Moshi (reflective, via moshi-kotlin KotlinJsonAdapterFactory).
//     The OpenAPI-generated Kotlin DTOs (packages/api-contract) target Moshi
//     (@Json/@JsonClass), so Moshi keeps the client + contract drift-free.
//     The data classes are NOT @JsonClass(generateAdapter=true), hence the
//     reflective adapter rather than moshi-kotlin-codegen.
//   - compileOptions Java 17 (AGP 8.5 floor).
plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("com.google.dagger.hilt.android")
    // google-services + crashlytics plugins are applied conditionally below,
    // only when the gitignored google-services.json exists (provisioned by CI
    // from a secret — Task 13.3; see the googleServicesFile block).
    kotlin("kapt")
}

// Task 13.3: Firebase plugins applied only when google-services.json is
// provisioned (CI writes it from a secret before building; the file is
// gitignored). Without it, Firebase deps are inert at runtime — clean
// checkouts still configure and build.
val googleServicesFile = file("google-services.json")
if (googleServicesFile.exists()) {
    apply(plugin = "com.google.gms.google-services")
    apply(plugin = "com.google.firebase.crashlytics")
}

// Runtime-target override for live-API testing without touching the
// committed per-buildType defaults:
//   ./gradlew assembleDebug -PapiBaseUrl=https://mishran.pranavb.com/api/mobile/v1/
// Takes precedence over every build type's base URL (must end in "/").
val apiBaseUrlOverride = (findProperty("apiBaseUrl") as String?)?.let {
    if (it.endsWith("/")) it else "$it/"
}

android {
    namespace = "com.mishran.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.mishran.app"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        vectorDrawables.useSupportLibrary = true
        // Production base URL (mobile v1 contract). Must end in "/". Overridden
        // to the emulator host-loopback in the debug build type so a local
        // `npm run dev` on :3000 is reachable from the Android emulator.
        buildConfigField(
            "String",
            "API_BASE_URL",
            "\"${apiBaseUrlOverride ?: "https://api.mishran.app/api/mobile/v1/"}\"",
        )
    }

    signingConfigs {
        // Task 13.3: release signing is env-driven — the keystore never lives
        // in the repo. CI decodes the base64 secret to a runner-local file and
        // points MISHRAN_RELEASE_KEYSTORE at it; local builds without the env
        // vars leave this config empty and the release build type falls back
        // to the debug key (assembleRelease still works for size checks).
        create("release") {
            val keystorePath = System.getenv("MISHRAN_RELEASE_KEYSTORE")
            if (keystorePath != null) {
                storeFile = file(keystorePath)
                storePassword = System.getenv("MISHRAN_RELEASE_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("MISHRAN_RELEASE_KEY_ALIAS")
                keyPassword = System.getenv("MISHRAN_RELEASE_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        debug {
            isMinifyEnabled = false
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
            // 10.0.2.2 is the emulator's alias for the host machine's localhost
            // — unless -PapiBaseUrl points elsewhere (live-API smoke runs).
            buildConfigField(
                "String",
                "API_BASE_URL",
                "\"${apiBaseUrlOverride ?: "http://10.0.2.2:3000/api/mobile/v1/"}\"",
            )
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            // Env-gated signing (Task 13.3): real key in CI, debug key locally.
            signingConfig = if (System.getenv("MISHRAN_RELEASE_KEYSTORE") != null) {
                signingConfigs.getByName("release")
            } else {
                signingConfigs.getByName("debug")
            }
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
        // Task 12.2: release-shaped build the macrobenchmark module measures
        // — minified + shrunk like release, debug-signed so it installs on
        // emulators, pointed at the emulator host loopback like debug.
        create("benchmark") {
            isDebuggable = false
            isMinifyEnabled = true
            isShrinkResources = true
            signingConfig = signingConfigs.getByName("debug")
            matchingFallbacks += listOf("release")
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
            buildConfigField(
                "String",
                "API_BASE_URL",
                "\"http://10.0.2.2:3000/api/mobile/v1/\"",
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }
    // Monorepo generated sources, compiled in place (zero duplication, always
    // in sync with packages/*). The plan suggested copy tasks; srcDir is the
    // idiomatic monorepo form.
    //   - brand tokens (full generated/kotlin tree: com.mishran.app.ui.theme).
    //   - api-contract DTOs: ONLY the models/ package is wired, not the
    //     generator's own apis/ + infrastructure/ (which would pull a competing
    //     networking stack). Models are plain @Serializable-via-Moshi data
    //     classes in com.mishran.api.models.
    //   - i18n strings (Android res).
    sourceSets["main"].kotlin.srcDir(
        layout.projectDirectory.dir("../../../packages/brand-tokens/generated/kotlin"),
    )
    sourceSets["main"].kotlin.srcDir(
        layout.projectDirectory.dir("../../../packages/api-contract/generated/kotlin/src/main/kotlin/com/mishran/api/models"),
    )
    sourceSets["main"].res.srcDir(
        layout.projectDirectory.dir("../../../packages/i18n-strings/generated/android"),
    )
    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

dependencies {
    // --- AndroidX core + lifecycle ---
    implementation("androidx.core:core-ktx:1.13.1")
    // AppCompat (per-app locales): AppCompatDelegate.setApplicationLocales
    // backports the API 33 locale store to minSdk 26 via AppCompatActivity.
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.4")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.4")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.4")
    implementation("androidx.activity:activity-compose:1.9.1")

    // --- Compose (BOM keeps artifacts aligned) ---
    // P1 parity: 2024.09.00 pulls compose-material3 1.3.0, whose
    // pulltorefresh package (PullToRefreshBox) the Catalog + Orders screens
    // wrap their lists in.
    implementation(platform("androidx.compose:compose-bom:2024.09.00"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.navigation:navigation-compose:2.7.7")

    // --- Image loading (Task 9.3): Coil for catalog/product imagery ---
    implementation("io.coil-kt:coil-compose:2.6.0")

    // --- Hilt (DI) ---
    implementation("com.google.dagger:hilt-android:2.51.1")
    implementation("androidx.hilt:hilt-navigation-compose:1.2.0")
    kapt("com.google.dagger:hilt-android-compiler:2.51.1")

    // --- Networking: Retrofit + OkHttp + Moshi ---
    // Moshi matches the OpenAPI-generated DTOs (@Json/@JsonClass). Reflective
    // adapter (moshi-kotlin) because the generated data classes are not marked
    // @JsonClass(generateAdapter=true), so codegen would skip them.
    implementation("com.squareup.retrofit2:retrofit:2.11.0")
    implementation("com.squareup.retrofit2:converter-moshi:2.11.0")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.squareup.okhttp3:logging-interceptor:4.12.0")
    implementation("com.squareup.moshi:moshi:1.15.1")
    implementation("com.squareup.moshi:moshi-kotlin:1.15.1")

    // --- Local persistence: Room + DataStore ---
    implementation("androidx.room:room-runtime:2.6.1")
    implementation("androidx.room:room-ktx:2.6.1")
    kapt("androidx.room:room-compiler:2.6.1")
    implementation("androidx.datastore:datastore-preferences:1.1.1")

    // --- Background work + widgets ---
    implementation("androidx.work:work-runtime-ktx:2.9.0")
    // @HiltWorker injection (Task 9.2): the manifest removes WorkManager's
    // default initializer so MishranApp supplies a HiltWorkerFactory instead.
    implementation("androidx.hilt:hilt-work:1.2.0")
    kapt("androidx.hilt:hilt-compiler:1.2.0")
    implementation("androidx.glance:glance-appwidget:1.0.0")

    // --- Biometric (in-app auth gate, Task 8.2) ---
    // 1.2.0 was never released (only 1.2.0-alpha05); 1.1.0 is the stable
    // line and covers the BiometricPrompt API this app uses.
    implementation("androidx.biometric:biometric:1.1.0")
    // BiometricPrompt requires a FragmentActivity host; MainActivity extends it.
    implementation("androidx.fragment:fragment-ktx:1.8.2")
    // Keystore-backed encrypted prefs for the biometric-gated refresh token.
    implementation("androidx.security:security-crypto:1.1.0-alpha06")

    // --- SMS autofill (Task 8.3): Google Play Services SMS Retriever ---
    // No READ_SMS permission — the system matches the app's 11-char signature
    // hash inside the inbound SMS, so the OTP body never reaches the app unless
    // we triggered the listen window. Requires the MSG91 template to append the
    // hash (see AppSignatureHelper + plan open item).
    implementation("com.google.android.gms:play-services-auth-api-phone:18.1.0")

    // --- Payments: Razorpay ---
    implementation("com.razorpay:checkout:1.6.33")

    // --- Firebase (FCM push + Crashlytics); BOM-pinned ---
    implementation(platform("com.google.firebase:firebase-bom:33.1.2"))
    implementation("com.google.firebase:firebase-messaging-ktx")
    implementation("com.google.firebase:firebase-crashlytics-ktx")

    // --- Unit tests (JVM) ---
    testImplementation("junit:junit:4.13.2")
    testImplementation("io.mockk:mockk:1.13.12")
    testImplementation("app.cash.turbine:turbine:1.1.0")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.8.1")
    testImplementation("org.robolectric:robolectric:4.13")

    // --- Instrumented tests (device) ---
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    androidTestImplementation(platform("androidx.compose:compose-bom:2024.09.00"))
    androidTestImplementation("androidx.compose.ui:ui-test-junit4")
    debugImplementation("androidx.compose.ui:ui-tooling")
    debugImplementation("androidx.compose.ui:ui-test-manifest")
}
