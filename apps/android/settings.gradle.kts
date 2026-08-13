// apps/android/settings.gradle.kts
// Mishran Android app — root settings (Task 7.1).
//
// Single-module app (`:app`) + the macrobenchmark test module (Task 12.2).
// Plugin + dependency repositories are declared here so every submodule
// resolves the same Google / Maven Central / JitPack feeds. Razorpay
// Checkout ships on Maven Central; everything else is Google + Maven
// Central.
pluginManagement {
    repositories {
        google {
            content {
                includeGroupByRegex("com\\.android.*")
                includeGroupByRegex("com\\.google.*")
                includeGroupByRegex("androidx.*")
            }
        }
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
        maven { url = uri("https://jitpack.io") }
    }
}

rootProject.name = "Mishran"
include(":app")
include(":macrobenchmark")
