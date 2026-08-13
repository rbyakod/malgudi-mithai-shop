# apps/android/app/proguard-rules.pro — Task 7.1.
# Release minify (buildTypes.release) keeps the app <25MB. Keep rules for the
# reflection/annotation-driven libs: kotlinx-serialization, Retrofit, Room,
# Razorpay. Hilt + Compose need no manual rules (R8 handles generated code).

# --- kotlinx-serialization ---
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.**
# Keep @Serializable companions + generated serializers.
-if @kotlinx.serialization.Serializable class **
-keepclassmembers class <1> {
    static <1>$Companion Companion;
}
-if @kotlinx.serialization.Serializable class ** {
    static **$* *;
}
-keepclassmembers class <2>$<3> {
    kotlinx.serialization.KSerializer serializer(...);
}
-keep,includedescriptorclasses class **$$serializer { *; }

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
