// apps/android/build.gradle.kts
// Top-level build file — plugins declared once with versions, applied in :app.
// Task 7.1 (Mishran Mobile Apps v1).
//
// Version set rationale (coherent Aug-2024 baseline the plan pins to):
//   - AGP 8.5.2 + Gradle 8.9 (AGP 8.5 requires Gradle >= 8.7)
//   - Kotlin 2.0.21 — IMPORTANT: Kotlin 2.0+ requires the dedicated Compose
//     Compiler Gradle plugin (org.jetbrains.kotlin.plugin.compose) instead of
//     the legacy composeOptions.kotlinCompilerExtensionVersion. The plan brief
//     mixed "Kotlin 2.0" with the legacy knob; corrected here.
//   - Hilt 2.51.1 + Room 2.6.1 via kapt (kept per brief to avoid an
//     unverifiable KSP-version coupling in a source-only build).
plugins {
    id("com.android.application") version "8.5.2" apply false
    id("org.jetbrains.kotlin.android") version "2.0.21" apply false
    id("org.jetbrains.kotlin.plugin.compose") version "2.0.21" apply false
    id("org.jetbrains.kotlin.plugin.serialization") version "2.0.21" apply false
    id("com.google.dagger.hilt.android") version "2.51.1" apply false
}
