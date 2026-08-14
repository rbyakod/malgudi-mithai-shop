// apps/android/app/src/main/java/com/mishran/app/ui/theme/Theme.kt — Task 7.2.
//
// The brand entry point for Compose: MishranTheme selects a color scheme from
// the system dark-mode setting and wires the token-driven typography + shapes.
// Every screen should wrap its content in MishranTheme { ... } rather than
// reaching for MaterialTheme directly, so the brand identity is non-optional.
package com.mishran.app.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable

/**
 * Brand-themed [MaterialTheme]. `darkTheme` defaults to the system setting but
 * is a parameter so previews + instrumented tests can pin a mode.
 *
 * @param darkTheme true → [MishranDarkColorScheme], false → [MishranLightColorScheme].
 * @param dynamicColor intentionally unsupported — Material You would override
 *   the hand-tuned kakvi/saffron palette with the user's wallpaper, which
 *   erases the mithai-boutique identity. Surfaced here so future reviewers
 *   see the choice was deliberate, not an oversight.
 */
@Composable
fun MishranTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    val colorScheme = if (darkTheme) MishranDarkColorScheme else MishranLightColorScheme
    MaterialTheme(
        colorScheme = colorScheme,
        typography = MishranTypography,
        shapes = MishranShapes,
        content = content,
    )
}
