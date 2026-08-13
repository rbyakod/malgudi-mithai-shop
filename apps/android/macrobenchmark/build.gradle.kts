// apps/android/macrobenchmark/build.gradle.kts — Task 12.2.
//
// Macrobenchmark module: cold-start + catalog-scroll timing against the
// release-built :app (the "benchmark" build type — minified like release,
// signed with the debug key so it installs on emulators). Runs on a device/
// emulator only; results land in the app's startup/scroll metrics for the
// p95 ≤ 1.5s cold-start budget (plan constraint) and the 5% CI gate.
plugins {
    id("com.android.test")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.mishran.macrobenchmark"
    compileSdk = 35

    defaultConfig {
        minSdk = 26
        targetSdk = 35
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    // Measure the release-shaped app — unminified debug timings are meaningless.
    targetProjectPath = ":app"
    experimentalProperties["android.experimental.self-instrumenting"] = true

    buildTypes {
        create("benchmark") {
            isDebuggable = true
            signingConfig = signingConfigs.getByName("debug")
            matchingFallbacks += listOf("release")
        }
    }
}

dependencies {
    implementation("androidx.benchmark:benchmark-macro-junit4:1.2.4")
    implementation("androidx.test:runner:1.6.1")
    implementation("androidx.test.ext:junit-ktx:1.2.1")
}
