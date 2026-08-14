# apps/android/app/proguard-rules.pro — Task 7.1 / 7.3.
# Release minify (buildTypes.release) keeps the app <25MB. Keep rules for the
# reflection/annotation-driven libs: Moshi, Retrofit, Room, Razorpay. Hilt +
# Compose need no manual rules (R8 handles generated code).

# --- Moshi (reflective KotlinJsonAdapterFactory) ---
# The generated DTOs use moshi-kotlin's reflective adapter (no codegen), so R8
# must retain the @Json field names + the reflective metadata. Keep the
# generated models package wholesale and let Moshi's documented rules handle
# the reflective plumbing.
-keepattributes *Annotation*, InnerClasses
-keep class com.mishran.api.models.** { *; }
-keepclassmembers class * {
    @com.squareup.moshi.* <methods>;
    @com.squareup.moshi.* <fields>;
}
-keep @com.squareup.moshi.JsonQualifier interface *
-keep class com.squareup.moshi.** { *; }
-dontwarn com.squareup.moshi.**
-dontwarn org.jetbrains.annotations.**

# --- Retrofit ---
-keepattributes Signature, Exceptions
-keep,allowobfuscation,allowshrinking interface retrofit2.Call
-keep,allowobfuscation,allowshrinking class retrofit2.Response
-keepclassmembers,allowshrinking,allowobfuscation interface * {
    @retrofit2.http.* <methods>;
}

# --- Room (generated DAO impls; keep entity + Dao by name) ---
-keep class * extends androidx.room.RoomDatabase { <init>(); }
-dontwarn androidx.room.paging.**

# --- Razorpay ---
-keep class com.razorpay.** { *; }
-dontwarn com.razorpay.**

# --- Kotlin metadata ---
-keep class kotlin.Metadata { *; }
