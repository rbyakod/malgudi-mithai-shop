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
//   - +kotlinx-serialization plugin (Retrofit converter needs it).
//   - compileOptions Java 17 (AGP 8.5 floor).
plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("org.jetbrains.kotlin.plugin.serialization")
    id("com.google.dagger.hilt.android")
    // google-services + crashlytics plugins are applied via the release-build
    // flavor once google-services.json is provisioned (Task 11.3 / 13.3). They
    // are intentionally NOT applied in the scaffold so a clean checkout without
    // the gitignored google-services.json still configures.
    kotlin("kapt")
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
    }

    buildTypes {
        debug {
            isMinifyEnabled = false
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
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
    // Monorepo generated sources: brand tokens (Kotlin) + i18n strings (res).
    // Added directly as source roots so they compile in place — zero duplication
    // and always in sync with packages/brand-tokens + packages/i18n-strings
    // (the plan suggested a copy task; srcDir is the idiomatic monorepo form).
    sourceSets["main"].kotlin.srcDir(
        layout.projectDirectory.dir("../../../packages/brand-tokens/generated/kotlin"),
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
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.4")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.4")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.4")
    implementation("androidx.activity:activity-compose:1.9.1")

    // --- Compose (BOM keeps artifacts aligned) ---
    implementation(platform("androidx.compose:compose-bom:2024.08.00"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.navigation:navigation-compose:2.7.7")

    // --- Hilt (DI) ---
    implementation("com.google.dagger:hilt-android:2.51.1")
    implementation("androidx.hilt:hilt-navigation-compose:1.2.0")
    kapt("com.google.dagger:hilt-android-compiler:2.51.1")

    // --- Networking: Retrofit + OkHttp + kotlinx-serialization ---
    implementation("com.squareup.retrofit2:retrofit:2.11.0")
    implementation("com.squareup.retrofit2:converter-kotlinx-serialization:1.0.0")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.squareup.okhttp3:logging-interceptor:4.12.0")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.1")

    // --- Local persistence: Room + DataStore ---
    implementation("androidx.room:room-runtime:2.6.1")
    implementation("androidx.room:room-ktx:2.6.1")
    kapt("androidx.room:room-compiler:2.6.1")
    implementation("androidx.datastore:datastore-preferences:1.1.1")

    // --- Background work + widgets ---
    implementation("androidx.work:work-runtime-ktx:2.9.0")
    implementation("androidx.glance:glance-appwidget:1.0.0")

    // --- Biometric (in-app auth gate, Task 8.2) ---
    implementation("androidx.biometric:biometric:1.2.0")

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
    androidTestImplementation(platform("androidx.compose:compose-bom:2024.08.00"))
    androidTestImplementation("androidx.compose.ui:ui-test-junit4")
    debugImplementation("androidx.compose.ui:ui-tooling")
    debugImplementation("androidx.compose.ui:ui-test-manifest")
}
